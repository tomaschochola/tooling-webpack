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
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { WebpackConfigBuilder } from '../src/index.js';

test('uses the application environment in the default output path', () => {
  const config = new WebpackConfigBuilder({
    env: {
      APP_ENV: 'development',
    },
  }).toConfig();

  const expectedPath = fileURLToPath(new URL('./dist/development/', pathToFileURL(`${process.cwd()}/`)));

  assert.equal(config.output.path, expectedPath);
});

test('does not opt into unstable future Webpack defaults', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.equal(config.experiments.futureDefaults, false);
});

test('resolves the Node environment from Webpack CLI arguments, the process, then the mode', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'test';

    assert.equal(new WebpackConfigBuilder({
      argv: {
        nodeEnv: 'development',
        mode: 'production',
      },
    }).nodeEnv, 'development');

    assert.equal(new WebpackConfigBuilder({
      argv: {
        mode: 'production',
      },
    }).nodeEnv, 'test');

    delete process.env.NODE_ENV;

    assert.equal(new WebpackConfigBuilder({
      argv: {
        mode: 'development',
      },
    }).nodeEnv, 'development');
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test('resolves the application version from Webpack env, the process, then package metadata', () => {
  const originalAppVersion = process.env.APP_VERSION;
  const originalPackageVersion = process.env.npm_package_version;

  try {
    process.env.APP_VERSION = '2.0.0';
    process.env.npm_package_version = '1.0.0';

    assert.equal(new WebpackConfigBuilder({
      env: {
        APP_VERSION: '3.0.0',
      },
    }).appVersion, '3.0.0');

    assert.equal(new WebpackConfigBuilder().appVersion, '2.0.0');

    process.env.APP_VERSION = '';

    assert.equal(new WebpackConfigBuilder({
      env: {
        APP_VERSION: '',
      },
    }).appVersion, '1.0.0');

    delete process.env.npm_package_version;

    assert.equal(new WebpackConfigBuilder().appVersion, '0.0.0');
  } finally {
    if (originalAppVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = originalAppVersion;
    }

    if (originalPackageVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = originalPackageVersion;
    }
  }
});

test('keeps the global compatibility definition with custom definitions', () => {
  const config = new WebpackConfigBuilder()
    .addDefinePlugin({
      TEST_VALUE: JSON.stringify('test'),
    })
    .toConfig();

  assert.deepEqual(config.plugins[0].definitions, {
    global: 'globalThis',
    TEST_VALUE: '"test"',
  });
});

test('precompresses nontrivial assets whenever compression reduces their size', () => {
  const config = new WebpackConfigBuilder()
    .addGzipCompressionPlugin()
    .addBrotliCompressionPlugin()
    .toConfig();

  const [gzip, brotli] = config.plugins;

  assert.equal(gzip.options.threshold, 1024);
  assert.equal(gzip.options.minRatio, 1 - Number.EPSILON);
  assert.equal(brotli.options.threshold, 1024);
  assert.equal(brotli.options.minRatio, 1 - Number.EPSILON);
});

test('does not expose a service worker source map by default', () => {
  const config = new WebpackConfigBuilder()
    .addWorkboxServiceWorkerPlugin()
    .toConfig();

  assert.equal(config.plugins[0].config.sourcemap, false);
});

test('allows a service worker source map to be enabled explicitly', () => {
  const config = new WebpackConfigBuilder()
    .addWorkboxServiceWorkerPlugin({
      sourcemap: true,
    })
    .toConfig();

  assert.equal(config.plugins[0].config.sourcemap, true);
});
