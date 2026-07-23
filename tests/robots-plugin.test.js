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
import { afterEach, test } from 'node:test';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

import { RobotsPlugin } from '../src/index.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true,
  })));
});

async function compile({ html, ...robotsOptions }) {
  const context = await mkdtemp(join(tmpdir(), 'tooling-webpack-robots-'));
  const outputPath = join(context, 'dist');

  temporaryDirectories.push(context);

  await writeFile(join(context, 'index.js'), '');

  const compiler = webpack({
    context,
    entry: './index.js',
    mode: 'development',
    output: {
      path: outputPath,
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'index.html',
        inject: false,
        templateContent: html,
      }),
      new RobotsPlugin(robotsOptions),
    ],
  });

  await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(() => {
      });

      if (error !== null && error !== undefined) {
        reject(error);

        return;
      }

      if (stats?.hasErrors()) {
        reject(new Error(stats.toString({
          all: false,
          errors: true,
        })));

        return;
      }

      resolve();
    });
  });

  return {
    html: await readFile(join(outputPath, 'index.html'), 'utf8'),
    robots: await readFile(join(outputPath, 'robots.txt'), 'utf8'),
  };
}

test('injects non-indexable robots metadata and robots.txt by default', async () => {
  const output = await compile({
    html: '<!doctype html><html><head><title>Test</title></head><body></body></html>',
    indexable: false,
  });

  assert.match(output.html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" \/>/);
  assert.equal(output.robots, 'User-agent: *\nDisallow: /\n');
});

test('updates existing robots metadata without leaving duplicates', async () => {
  const output = await compile({
    html: `<!doctype html>
      <html>
        <head>
          <meta content="noindex" name="robots">
          <meta name='robots' content='nofollow'>
        </head>
        <body></body>
      </html>`,
    indexable: true,
  });

  assert.equal(output.html.match(/name="robots"/g)?.length, 1);
  assert.match(output.html, /<meta name="robots" content="index, follow" \/>/);
  assert.equal(output.robots, 'User-agent: *\nAllow: /\n');
});

test('allows custom robots metadata and robots.txt policies', async () => {
  const output = await compile({
    html: '<!doctype html><html><head></head><body></body></html>',
    metaContent: 'noindex, follow',
    robotsText: 'User-agent: *\nDisallow: /private/\n',
  });

  assert.match(output.html, /<meta name="robots" content="noindex, follow" \/>/);
  assert.equal(output.robots, 'User-agent: *\nDisallow: /private/\n');
});
