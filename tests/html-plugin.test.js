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

test('default HTML is self-contained', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-html-'));
  const outputPath = join(root, 'dist');

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), 'export const value = 42;\n');

  const config = new WebpackConfigBuilder({
    argv: {
      mode: 'development',
    },
    env: {
      APP_NAME: 'Example application',
    },
  })
    .setEntries({ index: join(root, 'index.js') })
    .setOutputPath(outputPath)
    .addHtmlPlugin()
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

  assert.match(html, /<title>Application<\/title>/u);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/u);
});
