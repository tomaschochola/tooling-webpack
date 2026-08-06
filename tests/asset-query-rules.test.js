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
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import webpack from 'webpack';
import { WebpackConfigBuilder } from '../src/index.js';

const execute = promisify(execFile);
const loaderDirectory = fileURLToPath(new URL('../node_modules/', import.meta.url));

async function compileSource(root, outputName, configure, mode = 'development') {
  const outputPath = join(root, outputName);

  const builder = configure(
    new WebpackConfigBuilder({
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
    target: 'node',
    output: {
      ...base.output,
      filename: 'bundle.cjs',
      path: outputPath,
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

  assert.equal(
    statistics.hasErrors(),
    false,
    statistics.toString({
      all: false,
      errorDetails: true,
      errors: true,
    }),
  );

  return await execute(process.execPath, [join(outputPath, 'bundle.cjs')]);
}

test('compiles SCSS source independently of builder method order', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-style-loaders-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import cssSource from './style.scss?source'; process.stdout.write(cssSource);\n");
  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  for (const [outputName, configure] of [
    ['style-assets', (builder) => builder.addStyleLoaders().addAssetQueryRules()],
    ['assets-style', (builder) => builder.addAssetQueryRules().addStyleLoaders()],
  ]) {
    const { stderr, stdout } = await compileSource(root, outputName, configure);

    assert.equal(stderr, '');
    assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
    assert.doesNotMatch(stdout, /\$color/u);
  }
});

test('keeps HTML asset queries independent of html-loader and builder method order', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-html-asset-queries-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import htmlSource from './page.html?source'; process.stdout.write(htmlSource);\n");
  await writeFile(join(root, 'page.html'), '<h1>Example</h1>\n');

  for (const [outputName, configure] of [
    ['html-assets', (builder) => builder.addHtmlLoader().addAssetQueryRules()],
    ['assets-html', (builder) => builder.addAssetQueryRules().addHtmlLoader()],
  ]) {
    const { stderr, stdout } = await compileSource(root, outputName, configure);

    assert.equal(stderr, '');
    assert.equal(stdout, '<h1>Example</h1>\n');
  }
});

test('optimizes inline SVG without rasterizing it', async (context) => {
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

  const { stderr, stdout } = await compileSource(root, 'svg-minimizer', (builder) => builder.addAssetQueryRules().addImageMinimizer(), 'production');

  assert.equal(stderr, '');
  assert.match(stdout, /^data:image\/svg\+xml;base64,/u);

  const optimized = Buffer.from(stdout.slice(stdout.indexOf(',') + 1), 'base64').toString();

  assert.match(optimized, /^<svg\b/u);
  assert.doesNotMatch(optimized, /intentionally removable/u);
  assert.ok(Buffer.byteLength(optimized) < Buffer.byteLength(source));
});
