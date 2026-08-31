/**
 * @file
 * @author Tomáš Chochola <tomaschochola@tomaschochola.cz>
 * @copyright © 2026 Tomáš Chochola <tomaschochola@tomaschochola.cz>
 *
 * @license CC-BY-ND-4.0
 *
 * @see {@link https://creativecommons.org/licenses/by-nd/4.0/} License
 * @see {@link https://github.com/tomaschochola} GitHub Profile
 * @see {@link https://github.com/sponsors/tomaschochola} GitHub Sponsors
 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import webpack from 'webpack';

import { WebpackConfigBuilder } from '../src/index.js';

async function compile(root, outputName, configure, { allowErrors = false } = {}) {
    const outputPath = join(root, outputName);
    const builder = configure(
        new WebpackConfigBuilder({
            ecmaVersion: 2025,
            argv: {
                mode: 'development',
            },
        }),
    )
        .setEntries({
            index: join(root, 'index.js'),
        })
        .setOutputPath(outputPath)
        .setPublicPath('/');
    const base = builder.toConfig();
    const compiler = webpack({
        ...base,
        context: root,
        devtool: false,
        mode: 'development',
        output: {
            ...base.output,
            filename: 'bundle.cjs',
            path: outputPath,
        },
        target: 'web',
    });

    let statistics;

    try {
        statistics = await new Promise((resolvePromise, rejectPromise) => {
            compiler.run((error, result) => {
                if (error !== null && error !== undefined) {
                    rejectPromise(error);

                    return;
                }

                if (result === undefined) {
                    rejectPromise(new Error('Webpack completed without build statistics.'));

                    return;
                }

                resolvePromise(result);
            });
        });
    } finally {
        await new Promise((resolvePromise, rejectPromise) => {
            compiler.close((error) => {
                if (error !== null && error !== undefined) {
                    rejectPromise(error);

                    return;
                }

                resolvePromise();
            });
        });
    }

    if (!allowErrors) {
        assert.equal(
            statistics.hasErrors(),
            false,
            statistics.toString({
                all: false,
                errorDetails: true,
                errors: true,
            }),
        );
    }

    return {
        outputPath,
        statistics,
    };
}

test('emits configured local JSON references through native Webpack asset modules', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-json-references-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import manifest from './manifest.webmanifest'; process.stdout.write(manifest);\n");
    await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red" /></svg>\n');
    await writeFile(join(root, 'maskable icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" /></svg>\n');
    await writeFile(
        join(root, 'manifest.webmanifest'),
        `${JSON.stringify(
            {
                icons: [
                    { src: './icon.svg?as=webp' },
                    { src: '/maskable%20icon.svg' },
                    { src: 'https://cdn.example.com/icon.svg' },
                    { src: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' },
                    { src: '#embedded-icon' },
                ],
                scope: './',
                start_url: './',
            },
            null,
            2,
        )}\n`,
    );

    const { outputPath } = await compile(root, 'dist', (builder) =>
        builder.addImageMinimizer().addWebManifestLoader({
            overrides: [
                {
                    path: ['id'],
                    value: '/application/',
                },
            ],
            resolve: {
                roots: [root],
            },
        }),
    );
    const manifest = JSON.parse(await readFile(join(outputPath, 'manifest.webmanifest'), 'utf8'));
    const emittedFiles = await readdir(outputPath);

    assert.match(manifest.icons[0].src, /^\/immutable\.[a-f0-9]+\.webp$/u);
    assert.match(manifest.icons[1].src, /^\/immutable\.[a-f0-9]+\.svg$/u);
    assert.equal(manifest.icons[2].src, 'https://cdn.example.com/icon.svg');
    assert.equal(manifest.icons[3].src, 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E');
    assert.equal(manifest.icons[4].src, '#embedded-icon');
    assert.equal(manifest.id, '/application/');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.start_url, './');
    assert.ok(emittedFiles.some((filename) => /^immutable\.[a-f0-9]+\.webp$/u.test(filename)));
    assert.ok(emittedFiles.some((filename) => /^immutable\.[a-f0-9]+\.svg$/u.test(filename)));
    assert.equal(
        emittedFiles.some((filename) => filename.includes('__tooling_webpack')),
        false,
    );
});

test('inherits the root compiler public path when HTML imports the JSON asset', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-json-references-html-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), 'export const ready = true;\n');
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head><link rel="manifest" href="./manifest.webmanifest" /></head><body></body></html>\n');
    await writeFile(join(root, 'manifest.webmanifest'), '{"icons":[{"src":"./icon.svg"}]}\n');
    await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" />\n');

    const { outputPath } = await compile(root, 'html', (builder) =>
        builder
            .addHtmlLoader()
            .addJsonReferencesLoader({
                generator: {
                    filename: 'manifest.webmanifest',
                },
                references: [{ path: ['icons', '*', 'src'] }],
                test: /\.webmanifest$/i,
            })
            .addHtmlPlugin({ template: join(root, 'index.html') }),
    );
    const html = await readFile(join(outputPath, 'index.html'), 'utf8');
    const manifest = JSON.parse(await readFile(join(outputPath, 'manifest.webmanifest'), 'utf8'));

    assert.match(html, /href="\/manifest\.webmanifest"/u);
    assert.equal(Object.hasOwn(manifest, 'id'), false);
    assert.match(manifest.icons[0].src, /^\/immutable\.[a-f0-9]+\.svg$/u);
});

test('uses JSON-relative referenced asset URLs with the automatic public path', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-json-references-auto-public-path-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './manifest.webmanifest';\n");
    await writeFile(join(root, 'manifest.webmanifest'), '{"icons":[{"src":"./icon.svg"}]}\n');
    await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" />\n');

    const outputPath = join(root, 'dist');
    const base = new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: { mode: 'production' },
    })
        .setContext(root)
        .setTarget('web')
        .setEntries({ index: './index.js' })
        .setOutputPath(outputPath)
        .addJsonReferencesLoader({
            generator: { filename: 'metadata/manifest.webmanifest' },
            references: [{ path: ['icons', '*', 'src'] }],
            test: /\.webmanifest$/i,
        })
        .toConfig();
    const compiler = webpack(base);

    let statistics;

    try {
        statistics = await new Promise((resolvePromise, rejectPromise) => {
            compiler.run((error, result) => {
                if (error !== null && error !== undefined) {
                    rejectPromise(error);

                    return;
                }

                resolvePromise(result);
            });
        });
    } finally {
        await new Promise((resolvePromise, rejectPromise) => {
            compiler.close((error) => {
                if (error !== null && error !== undefined) {
                    rejectPromise(error);

                    return;
                }

                resolvePromise();
            });
        });
    }

    assert.equal(
        statistics?.hasErrors(),
        false,
        statistics?.toString({
            all: false,
            errorDetails: true,
            errors: true,
        }),
    );

    const manifest = JSON.parse(await readFile(join(outputPath, 'metadata/manifest.webmanifest'), 'utf8'));

    assert.match(manifest.icons[0].src, /^\.\.\/immutable\.[a-f0-9]+\.svg$/u);
});

test('validates JSON reference configuration before changing the builder', () => {
    const builder = new WebpackConfigBuilder({ ecmaVersion: 2025 });

    assert.throws(() => builder.addJsonReferencesLoader(), {
        message: 'JSON references loader test is required.',
    });
    assert.throws(() => builder.addJsonReferencesLoader({ references: [], test: /\.json$/i }), {
        message: 'JSON references must be a non-empty array.',
    });
    assert.throws(
        () =>
            builder.addJsonReferencesLoader({
                references: [{ path: ['icon'] }, { path: ['icon'] }],
                test: /\.json$/i,
            }),
        {
            message: 'JSON reference path at index 1 is duplicated.',
        },
    );
    assert.throws(
        () =>
            builder.addJsonReferencesLoader({
                overrides: [
                    { path: ['id'], value: '/' },
                    { path: ['id'], value: '/application/' },
                ],
                references: [{ path: ['icon'] }],
                test: /\.json$/i,
            }),
        {
            message: 'JSON override path at index 1 is duplicated.',
        },
    );

    assert.doesNotThrow(() =>
        builder
            .addJsonReferencesLoader({
                references: [{ path: ['icon'] }],
                test: /\.json$/i,
            })
            .addJsonReferencesLoader({
                references: [{ path: ['images', '*'] }],
                test: /\.webmanifest$/i,
            }),
    );
});

test('fails closed for missing required paths and unsupported URL schemes', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-json-references-invalid-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './references.json';\n");

    for (const [outputName, document, expectedError] of [
        ['missing', {}, /does not match \$\.icon/u],
        ['scheme', { icon: 'javascript:alert(1)' }, /uses an unsupported URL scheme/u],
    ]) {
        await writeFile(join(root, 'references.json'), JSON.stringify(document));

        const { statistics } = await compile(
            root,
            outputName,
            (builder) =>
                builder.addJsonReferencesLoader({
                    references: [{ path: ['icon'] }],
                    test: /references\.json$/i,
                }),
            { allowErrors: true },
        );

        assert.equal(statistics.hasErrors(), true);
        assert.match(
            statistics.toString({
                all: false,
                errorDetails: true,
                errors: true,
            }),
            expectedError,
        );
    }
});
