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

  const compiler = webpack({
    ...config,
    devtool: false,
    mode: 'development',
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

  const html = await readFile(join(outputPath, 'index.html'), 'utf8');

  assert.match(html, /<html lang="cs">/u);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=2" \/>/u);
  assert.match(html, /<meta name="description" content="Client description" \/>/u);
  assert.match(html, /<title>Client title<\/title>/u);
  assert.doesNotMatch(html, /tomaschochola|tooling-webpack/u);
});
