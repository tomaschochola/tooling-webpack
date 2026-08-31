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
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import webpack from 'webpack';

import { WebpackConfigBuilder } from '../src/index.js';

test('shares initial modules and injects only each page dependency graph', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-chunks-'));
    const outputPath = join(root, 'dist');

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const sharedValue = Array.from({ length: 4_000 }, (_, index) => `shared-value-${index}`).join('|');

    await writeFile(join(root, 'shared.js'), `export const sharedValue = ${JSON.stringify(sharedValue)};\n`);
    await writeFile(join(root, 'index.js'), "import { sharedValue } from './shared.js'; globalThis.indexValue = sharedValue.length;\n");
    await writeFile(join(root, 'admin.js'), "import { sharedValue } from './shared.js'; globalThis.adminValue = sharedValue.length;\n");

    const config = new WebpackConfigBuilder({ ecmaVersion: 2025, argv: { mode: 'production' } })
        .setContext(root)
        .setTarget('web')
        .setOutputPath(outputPath)
        .optimizeChunks()
        .setEntries({
            admin: './admin.js',
            index: './index.js',
        })
        .addHtmlPlugin({
            chunks: ['index'],
            filename: 'index.html',
            templateContent: '<!doctype html><html><head><title>Index</title></head><body></body></html>',
        })
        .addHtmlPlugin({
            chunks: ['admin'],
            filename: 'admin/index.html',
            templateContent: '<!doctype html><html><head><title>Admin</title></head><body></body></html>',
        })
        .toConfig();
    const compiler = webpack(config);

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

    const { entrypoints } = statistics.toJson({
        all: false,
        entrypoints: true,
    });
    const indexAssets = new Set(entrypoints.index.assets.map(({ name }) => name).filter((name) => name.endsWith('.js')));
    const adminAssets = new Set(entrypoints.admin.assets.map(({ name }) => name).filter((name) => name.endsWith('.js')));
    const sharedAssets = indexAssets.intersection(adminAssets);
    const indexOnlyAssets = indexAssets.difference(adminAssets);
    const adminOnlyAssets = adminAssets.difference(indexAssets);

    assert.equal(indexAssets.size, 3);
    assert.equal(adminAssets.size, 3);
    assert.equal(sharedAssets.size, 2);
    assert.equal(indexOnlyAssets.size, 1);
    assert.equal(adminOnlyAssets.size, 1);

    const indexHtml = await readFile(join(outputPath, 'index.html'), 'utf8');
    const adminHtml = await readFile(join(outputPath, 'admin/index.html'), 'utf8');

    for (const asset of sharedAssets) {
        assert.equal(indexHtml.includes(asset), true);
        assert.equal(adminHtml.includes(asset), true);
    }

    for (const asset of indexOnlyAssets) {
        assert.equal(indexHtml.includes(asset), true);
        assert.equal(adminHtml.includes(asset), false);
    }

    for (const asset of adminOnlyAssets) {
        assert.equal(adminHtml.includes(asset), true);
        assert.equal(indexHtml.includes(asset), false);
    }
});
