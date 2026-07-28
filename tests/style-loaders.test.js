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

async function compileStyleSource(root, order) {
  const outputPath = join(root, order);

  let builder = new WebpackConfigBuilder({
    argv: {
      mode: 'development',
    },
  })
    .setEntries({
      index: join(root, 'index.js'),
    })
    .setOutputPath(outputPath);

  builder = order === 'style-assets'
    ? builder.addStyleLoaders().addAssetQueryRules()
    : builder.addAssetQueryRules().addStyleLoaders();

  const base = builder.toConfig();

  const compiler = webpack({
    ...base,
    context: process.cwd(),
    devtool: false,
    mode: 'development',
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

  await writeFile(
    join(root, 'index.js'),
    'import cssSource from \'./style.scss?source\'; process.stdout.write(cssSource);\n',
  );
  await writeFile(
    join(root, 'style.scss'),
    '$color: red;\n\n.example {\n  color: $color;\n}\n',
  );

  for (const order of ['style-assets', 'assets-style']) {
    const { stderr, stdout } = await compileStyleSource(root, order);

    assert.equal(stderr, '');
    assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
    assert.doesNotMatch(stdout, /\$color/u);
  }
});
