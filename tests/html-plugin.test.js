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

async function compile(config) {
  const compiler = webpack({
    ...config,
    devtool: false,
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
}

test('uses the client-owned HTML document without package metadata', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-html-'));
  const outputPath = join(root, 'dist');

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), 'export const value = 42;\n');
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html lang="cs"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=2" /><meta name="description" content="Client description" /><title>Client title</title></head><body></body></html>\n',
  );

  const config = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: {
      mode: 'development',
    },
    env: {
      APP_NAME: 'Example application',
    },
  })
    .setEntries({ index: join(root, 'index.js') })
    .setOutputPath(outputPath)
    .addHtmlLoader()
    .addHtmlPlugin({ template: join(root, 'index.html') })
    .toConfig();

  await compile(config);

  const html = await readFile(join(outputPath, 'index.html'), 'utf8');

  assert.match(html, /<html lang="cs">/u);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=2" \/>/u);
  assert.match(html, /<meta name="description" content="Client description" \/>/u);
  assert.match(html, /<title>Client title<\/title>/u);
  assert.doesNotMatch(html, /tomaschochola|tooling-webpack/u);
});

test('emits local social images unchanged with hashed absolute URLs', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-social-image-'));
  const outputPath = join(root, 'dist');
  const archivePath = join(root, 'application.zip');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import image from './open-graph.png?resource'; document.body.dataset.image = image;\n");
  await writeFile(join(root, 'open-graph.png'), image);
  await writeFile(
    join(root, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta property="og:image" content="./open-graph.png" />',
      '<meta property="og:image:url" content="./open-graph.png" />',
      '<meta property="og:image:secure_url" content="./open-graph.png" />',
      '<meta name="twitter:image" content="./open-graph.png" />',
      '<meta name="description" content="./not-an-image.png?resource" />',
      '<meta property="og:image" content="https://external.example/image.png" />',
      '<title>Social image</title>',
      '</head>',
      '<body></body>',
      '</html>',
      '',
    ].join('\n'),
  );

  const config = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: {
      mode: 'production',
    },
  })
    .setPublicUrl('https://cdn.example.com/application/')
    .setEntries({ index: join(root, 'index.js') })
    .setOutputPath(outputPath)
    .addHtmlLoader()
    .addAssetQueryRules()
    .addImageMinimizer()
    .addHtmlPlugin({ template: join(root, 'index.html') })
    .addArchivePlugin({ checksum: false, destination: archivePath })
    .toConfig();

  await compile(config);

  const files = await readdir(outputPath);
  const imageFiles = files.filter((filename) => filename.endsWith('.png'));

  assert.equal(imageFiles.length, 1);
  assert.deepEqual(await readFile(join(outputPath, imageFiles[0])), image);

  const html = await readFile(join(outputPath, 'index.html'), 'utf8');
  const expectedUrl = `https://cdn.example.com/application/${imageFiles[0]}`;

  assert.equal(html.split(`content="${expectedUrl}"`).length - 1, 4);
  assert.match(html, /content="\.\/not-an-image\.png\?resource"/u);
  assert.match(html, /content="https:\/\/external\.example\/image\.png"/u);

  const archive = await readFile(archivePath);

  assert.equal(archive.includes(Buffer.from(imageFiles[0])), true);
  assert.equal(archive.includes(Buffer.from(`${imageFiles[0]}?resource`)), false);
});
