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
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import sharp from 'sharp';
import test from 'node:test';
import webpack from 'webpack';
import { WebpackConfigBuilder } from '../src/index.js';

const execute = promisify(execFile);
const loaderDirectory = fileURLToPath(new URL('../node_modules/', import.meta.url));
const animatedGif = Buffer.from('R0lGODlhBAADAPAAAP8AAAAAACH/C05FVFNDQVBFMi4wAwEBAAAh+QQACgAAACwAAAAABAADAAACA4SPVgAh+QQAFAAAACwAAAAABAADAIAAAP8AAAACA4SPVgA7', 'base64');

function getImageGenerator(preset) {
    const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addImageMinimizer().toConfig();
    const plugin = config.plugins.find((candidate) => candidate.constructor.name === 'ImageMinimizerPlugin');

    return plugin.options.generator.find((generator) => generator.preset === preset);
}

async function generateImage(preset, data, filename) {
    const generator = getImageGenerator(preset);

    return generator.implementation(
        {
            data,
            errors: [],
            filename,
            info: {},
            warnings: [],
        },
        generator.options,
    );
}

async function compileSource(root, outputName, configure, mode = 'development', { allowErrors = false, runBundle = true, target = 'node' } = {}) {
    const outputPath = join(root, outputName);

    const builder = configure(
        new WebpackConfigBuilder({
            ecmaVersion: 2025,
            env: mode === 'production' ? { WEBPACK_BUILD: true } : {},
            argv: {
                mode,
            },
        }),
    )
        .setEntries({
            index: join(root, 'index.js'),
        })
        .setOutputPath(outputPath);

    const base = builder.toConfig();

    const compiler = webpack({
        ...base,
        context: process.cwd(),
        devtool: false,
        mode,
        resolveLoader: {
            modules: [loaderDirectory, 'node_modules'],
        },
        target,
        output: {
            ...base.output,
            filename: 'bundle.cjs',
            path: outputPath,
            publicPath: target === 'node' ? '/' : base.output.publicPath,
        },
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
        ...(runBundle && !statistics.hasErrors() ? await execute(process.execPath, [join(outputPath, 'bundle.cjs')]) : { stderr: '', stdout: '' }),
        outputPath,
        statistics,
    };
}

test('resolves extensionless CommonJS JSON imports through the standard Webpack extensions', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-json-resolution-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'package.json'), '{"type":"commonjs"}\n');
    await writeFile(join(root, 'index.js'), "const metadata = require('./metadata'); process.stdout.write(metadata.name);\n");
    await writeFile(join(root, 'metadata.json'), '{"name":"example"}\n');

    const { stderr, stdout } = await compileSource(root, 'json-resolution', (builder) => builder);

    assert.equal(stderr, '');
    assert.equal(stdout, 'example');
});

test('extracts compiled SCSS for default and link exports', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-link-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

    for (const [outputName, request] of [
        ['default', './style.scss'],
        ['link', './style.scss?theme=dark&link'],
    ]) {
        await writeFile(join(root, 'index.js'), `import '${request}';\n`);

        const { outputPath, stderr, stdout } = await compileSource(root, outputName, (builder) => builder.addStyleLoaders(), 'development', {
            runBundle: false,
            target: 'web',
        });

        assert.equal(stderr, '');
        assert.equal(stdout, '');
        assert.equal((await readdir(outputPath)).filter((filename) => filename.endsWith('.css')).length, 1);
    }
});

test('injects compiled SCSS as a style element', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-style-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), ["import './style.scss?style';", ''].join('\n'));
    await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

    const { outputPath, stderr, stdout } = await compileSource(root, 'style', (builder) => builder.addStyleLoaders(), 'development', {
        runBundle: false,
        target: 'web',
    });
    const bundle = await readFile(join(outputPath, 'bundle.cjs'), 'utf8');

    assert.equal(stderr, '');
    assert.equal(stdout, '');
    assert.match(bundle, /document\.createElement\('style'\)/u);
    assert.match(bundle, /\.example \{\\n {2}color: red;/u);
    assert.doesNotMatch(bundle, /\$color/u);
});

test('exports compiled SCSS as text', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-text-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import cssText from './style.scss?text'; process.stdout.write(cssText);\n");
    await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

    const { stderr, stdout } = await compileSource(root, 'text', (builder) => builder.addStyleLoaders());

    assert.equal(stderr, '');
    assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
    assert.doesNotMatch(stdout, /\$color/u);
});

test('exports compiled SCSS as a constructable stylesheet', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-sheet-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), ["import sheet from './style.scss?sheet';", 'process.stdout.write(`${typeof sheet.replaceSync}\n${sheet.cssText}`);', ''].join('\n'));
    await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

    const { stderr, stdout } = await compileSource(root, 'sheet', (builder) => builder.addStyleLoaders());

    assert.equal(stderr, '');
    assert.match(stdout, /^function\n/u);
    assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
    assert.doesNotMatch(stdout, /\$color/u);
});

test('exports CSS as text and a constructable stylesheet', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-css-exports-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(
        join(root, 'index.js'),
        ["import sheet from './style.css?sheet';", "import text from './style.css?text';", 'process.stdout.write(`${typeof sheet.replaceSync}\n${sheet.cssText}\n${text}`);', ''].join('\n'),
    );
    await writeFile(join(root, 'style.css'), '.example {\n  color: red;\n}\n');

    const { stderr, stdout } = await compileSource(root, 'css-exports', (builder) => builder.addStyleLoaders());

    assert.equal(stderr, '');
    assert.match(stdout, /^function\n/u);
    assert.equal(stdout.match(/\.example\s*\{\s*color:\s*red;/gu)?.length, 2);
});

test('exports stylesheet source through the generic asset query', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-queries-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = '$color: red;\n\n.example {\n  color: $color;\n}\n';

    await writeFile(join(root, 'index.js'), "import source from './style.scss?source'; process.stdout.write(source);\n");
    await writeFile(join(root, 'style.scss'), source);

    const { stderr, stdout } = await compileSource(root, 'source', (builder) => builder.addAssetQueryRules().addStyleLoaders());

    assert.equal(stderr, '');
    assert.equal(stdout, source);
});

test('rejects the unsupported raw stylesheet query', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-raw-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './style.scss?raw';\n");
    await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

    const { statistics } = await compileSource(root, 'raw', (builder) => builder.addAssetQueryRules().addStyleLoaders(), 'development', {
        allowErrors: true,
        runBundle: false,
    });

    assert.equal(statistics.hasErrors(), true);
});

test('imports HTML through html-loader without a resource query', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-html-loader-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import htmlSource from './page.html'; process.stdout.write(htmlSource);\n");
    await writeFile(join(root, 'page.html'), '<h1>Example</h1>\n');

    const { stderr, stdout } = await compileSource(root, 'html', (builder) => builder.addHtmlLoader());

    assert.equal(stderr, '');
    assert.equal(stdout, '<h1>Example</h1>\n');
});

test('does not process PHP through html-loader', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-php-loader-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './page.php';\n");
    await writeFile(join(root, 'page.php'), '<h1>Example</h1>\n');

    const { statistics } = await compileSource(root, 'php', (builder) => builder.addHtmlLoader(), 'development', {
        allowErrors: true,
        runBundle: false,
    });

    assert.equal(statistics.hasErrors(), true);
});

test('exports template HTML through the source asset query unchanged', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-template-source-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = '<section data-ref="example">\n  <img src="./image.svg" />\n</section>\n';

    await writeFile(join(root, 'index.js'), "import templateSource from './page.template.html?source'; process.stdout.write(templateSource);\n");
    await writeFile(join(root, 'page.template.html'), source);
    await writeFile(join(root, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" />\n');

    const { stderr, stdout } = await compileSource(root, 'template', (builder) => builder.addAssetQueryRules().addHtmlLoader());

    assert.equal(stderr, '');
    assert.equal(stdout, source);
});

test('does not retain the template query contract', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-template-query-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './page.template.html?template';\n");
    await writeFile(join(root, 'page.template.html'), '<section>Example</section>\n');

    const { statistics } = await compileSource(root, 'template', (builder) => builder.addAssetQueryRules().addHtmlLoader(), 'development', {
        allowErrors: true,
        runBundle: false,
    });

    assert.equal(statistics.hasErrors(), true);
});

test('preserves image resource bytes without an explicit minimizer', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-resource-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">',
        '  <!-- This comment and whitespace must be preserved. -->',
        '  <rect width="100" height="100" fill="#ff0000" />',
        '</svg>',
        '',
    ].join('\n');

    await writeFile(join(root, 'index.js'), "import image from './image.svg?resource'; process.stdout.write(image);\n");
    await writeFile(join(root, 'image.svg'), source);

    const { outputPath, stderr } = await compileSource(root, 'image-resource', (builder) => builder.addAssetQueryRules().addImageMinimizer(), 'production');
    const imageFilename = (await readdir(outputPath, { recursive: true })).find((filename) => filename.endsWith('.svg'));

    assert.equal(stderr, '');
    assert.notEqual(imageFilename, undefined);
    assert.equal(await readFile(join(outputPath, imageFilename), 'utf8'), source);
});

test('optimizes inline SVG only with an explicit minimizer', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-svg-minimizer-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">',
        '  <!-- This comment and whitespace are intentionally removable. -->',
        '  <rect width="100" height="100" fill="#ff0000" />',
        '</svg>',
        '',
    ].join('\n');

    await writeFile(join(root, 'index.js'), "import image from './image.svg?inline'; process.stdout.write(image);\n");
    await writeFile(join(root, 'image.svg'), source);

    const { stderr, stdout } = await compileSource(
        root,
        'svg-minimizer',
        (builder) =>
            builder.addAssetQueryRules().addImageMinimizer({
                minimizer: {
                    implementation: ImageMinimizerPlugin.svgoMinify,
                    options: {
                        encodeOptions: {
                            multipass: true,
                            plugins: ['preset-default'],
                        },
                    },
                },
            }),
        'production',
    );

    assert.equal(stderr, '');
    assert.match(stdout, /^data:image\/svg\+xml;base64,/u);

    const optimized = Buffer.from(stdout.slice(stdout.indexOf(',') + 1), 'base64').toString();

    assert.match(optimized, /^<svg\b/u);
    assert.doesNotMatch(optimized, /intentionally removable/u);
    assert.ok(Buffer.byteLength(optimized) < Buffer.byteLength(source));
});

test('generates every supported image format with an explicit resource output', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red" /></svg>\n');

    for (const mode of ['development', 'production']) {
        for (const format of ['avif', 'webp', 'jpg', 'jpeg', 'png']) {
            await writeFile(join(root, 'index.js'), `import image from './image.svg?width=16&as=${format}&resource'; process.stdout.write(image);\n`);

            const { outputPath, stderr, stdout } = await compileSource(root, `image-generator-${format}-${mode}`, (builder) => builder.addImageMinimizer(), mode);

            assert.equal(stderr, '');
            assert.match(stdout, new RegExp(`^/immutable\\.[a-f0-9]+\\.${format}\\?resource=$`, 'u'));
            assert.ok((await readdir(outputPath, { recursive: true })).some((filename) => filename.endsWith(`.${format}`)));
        }
    }
});

test('preserves animation only in the supported WebP output', async () => {
    assert.equal((await sharp(animatedGif, { animated: true }).metadata()).pages, 2);

    const webp = await generateImage('webp', animatedGif, 'animated.gif');
    const webpMetadata = await sharp(webp.data, { animated: true }).metadata();

    assert.equal(webpMetadata.format, 'webp');
    assert.equal(webpMetadata.pages, 2);
    assert.equal(webpMetadata.loop, 2);
    assert.deepEqual(webpMetadata.delay, [100, 200]);

    for (const preset of ['avif', 'png', 'jpg', 'jpeg']) {
        await assert.rejects(generateImage(preset, animatedGif, 'animated.gif'), new RegExp(`Animated input cannot be safely converted to ${preset.toUpperCase()}`, 'u'));
    }
});

test('preserves transparency in capable formats and rejects unsafe JPEG generation', async () => {
    const source = await sharp({
        create: {
            background: {
                alpha: 0.5,
                b: 200,
                g: 100,
                r: 20,
            },
            channels: 4,
            height: 4,
            width: 4,
        },
    })
        .png()
        .toBuffer();

    for (const preset of ['avif', 'webp', 'png']) {
        const output = await generateImage(preset, source, 'transparent.png');

        assert.equal((await sharp(output.data).metadata()).hasAlpha, true);
        assert.equal((await sharp(output.data).stats()).isOpaque, false);
    }

    for (const preset of ['jpg', 'jpeg']) {
        await assert.rejects(generateImage(preset, source, 'transparent.png'), /Transparent input cannot be safely converted to JPEG/u);
    }
});

test('uses near-lossless WebP for generic high-frequency graphics', async () => {
    const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 12, 34, 56, 210, 120, 5, 240, 10, 180, 1, 250, 90, 90, 1, 250, 180, 240, 10, 5, 120, 210, 56, 34, 12]);
    const source = await sharp(pixels, {
        raw: {
            channels: 3,
            height: 3,
            width: 4,
        },
    })
        .png()
        .toBuffer();
    const output = await generateImage('webp', source, 'graphic.png');
    const decoded = await sharp(output.data).raw().toBuffer();
    let maximumDifference = 0;

    for (let index = 0; index < pixels.length; index += 1) {
        maximumDifference = Math.max(maximumDifference, Math.abs(pixels[index] - decoded[index]));
    }

    assert.ok(maximumDifference <= 1);
});

test('preserves high bit depth only in the generic lossless PNG output', async () => {
    const source = await sharp({
        create: {
            background: '#123456',
            channels: 3,
            height: 4,
            width: 4,
        },
    })
        .toColourspace('rgb16')
        .png()
        .toBuffer();
    const png = await generateImage('png', source, 'high-bit-depth.png');

    assert.equal((await sharp(source).metadata()).bitsPerSample, 16);
    assert.equal((await sharp(png.data).metadata()).bitsPerSample, 16);

    for (const preset of ['avif', 'webp', 'jpg', 'jpeg']) {
        await assert.rejects(generateImage(preset, source, 'high-bit-depth.png'), /High-bit-depth input cannot be safely converted/u);
    }
});

test('generates inline and automatic image outputs explicitly regardless of query parameter order', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-output-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(
        join(root, 'index.js'),
        [
            "import automatic from './image.svg?asset&width=16&as=webp';",
            "import inline from './image.svg?as=webp&width=16&inline';",
            'process.stdout.write(JSON.stringify({ automatic, inline }));',
            '',
        ].join('\n'),
    );
    await writeFile(join(root, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red" /></svg>\n');

    const { stderr, stdout } = await compileSource(root, 'image-generator-output', (builder) => builder.addImageMinimizer(), 'production');
    const output = JSON.parse(stdout);

    assert.equal(stderr, '');
    assert.match(output.automatic, /^data:image\/webp;base64,/u);
    assert.match(output.inline, /^data:image\/webp;base64,/u);
});

test('rejects image generation without an explicit output type', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-output-missing-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await writeFile(join(root, 'index.js'), "import './image.svg?as=webp';\n");
    await writeFile(join(root, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" />\n');

    const { statistics } = await compileSource(root, 'image-generator-output-missing', (builder) => builder.addImageMinimizer(), 'production', {
        allowErrors: true,
        runBundle: false,
    });

    assert.equal(statistics.hasErrors(), true);
});

test('resizes explicit image conversions without cropping or enlargement regardless of query parameter order', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-resize-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = await sharp({
        create: {
            background: '#ff0000',
            channels: 3,
            height: 50,
            width: 100,
        },
    })
        .png()
        .toBuffer();

    await writeFile(
        join(root, 'index.js'),
        [
            "import widthOnly from './image.png?as=png&width=40&resource';",
            "import boundingBox from './image.png?resource&width=40&height=30&as=png';",
            "import noUpscale from './image.png?as=png&width=200&resource';",
            "import vectorUpscale from './logo.svg?as=png&width=128&resource';",
            'process.stdout.write(JSON.stringify({ boundingBox, noUpscale, vectorUpscale, widthOnly }));',
            '',
        ].join('\n'),
    );
    await writeFile(join(root, 'image.png'), source);
    await writeFile(join(root, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16" fill="red" /></svg>\n');

    const { outputPath, stderr, stdout } = await compileSource(root, 'image-generator-resize', (builder) => builder.addImageMinimizer(), 'production');
    const outputUrls = JSON.parse(stdout);

    assert.equal(stderr, '');

    for (const [name, dimensions] of Object.entries({
        boundingBox: { height: 20, width: 40 },
        noUpscale: { height: 50, width: 100 },
        vectorUpscale: { height: 64, width: 128 },
        widthOnly: { height: 20, width: 40 },
    })) {
        assert.match(outputUrls[name], /^\/immutable\.[a-f0-9]+\.png\?resource=$/u);

        const outputUrl = new URL(outputUrls[name], 'https://example.test');
        const metadata = await sharp(await readFile(join(outputPath, outputUrl.pathname.slice(1)))).metadata();

        assert.equal(metadata.width, dimensions.width);
        assert.equal(metadata.height, dimensions.height);
    }
});

test('keeps decoded pixels unchanged when explicitly converting to PNG', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-png-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const pixels = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 255, 0, 0, 0, 255, 127, 63, 31, 192]);
    const source = await sharp(pixels, {
        raw: {
            channels: 4,
            height: 2,
            width: 3,
        },
    })
        .png({ palette: false })
        .toBuffer();

    await writeFile(join(root, 'index.js'), "import image from './image.png?as=png&resource'; process.stdout.write(image);\n");
    await writeFile(join(root, 'image.png'), source);

    const { outputPath, stderr } = await compileSource(root, 'image-generator-png', (builder) => builder.addImageMinimizer(), 'production');
    const outputFilename = (await readdir(outputPath, { recursive: true })).find((filename) => filename.endsWith('.png'));

    assert.equal(stderr, '');
    assert.notEqual(outputFilename, undefined);

    const output = await readFile(join(outputPath, outputFilename));
    const sourcePixels = await sharp(source).raw().toBuffer({ resolveWithObject: true });
    const outputImage = sharp(output);
    const outputPixels = await outputImage.raw().toBuffer({ resolveWithObject: true });

    assert.deepEqual(outputPixels.info, sourcePixels.info);
    assert.deepEqual(outputPixels.data, sourcePixels.data);
    assert.equal((await sharp(output).metadata()).isProgressive, false);
    assert.ok(output.length <= source.length);
});

test('applies EXIF orientation during explicit image conversion', async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-image-generator-orientation-'));

    context.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    const source = await sharp({
        create: {
            background: '#ff0000',
            channels: 3,
            height: 30,
            width: 20,
        },
    })
        .jpeg({ chromaSubsampling: '4:4:4', quality: 100 })
        .withMetadata({ orientation: 6 })
        .toBuffer();

    assert.equal((await sharp(source).metadata()).orientation, 6);

    await writeFile(join(root, 'index.js'), "import image from './image.jpg?as=png&resource'; process.stdout.write(image);\n");
    await writeFile(join(root, 'image.jpg'), source);

    const { outputPath, stderr } = await compileSource(root, 'image-generator-orientation', (builder) => builder.addImageMinimizer(), 'production');
    const outputFilename = (await readdir(outputPath, { recursive: true })).find((filename) => filename.endsWith('.png'));

    assert.equal(stderr, '');
    assert.notEqual(outputFilename, undefined);

    const metadata = await sharp(await readFile(join(outputPath, outputFilename))).metadata();

    assert.equal(metadata.width, 30);
    assert.equal(metadata.height, 20);
    assert.equal(metadata.orientation, undefined);
});
