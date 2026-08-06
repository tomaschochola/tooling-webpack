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
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { WebpackConfigBuilder } from '../src/index.js';

test('uses dist as the default output path', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.equal(config.output.path, resolve('dist'));
});

test('derives the Webpack runtime target from Browserslist by default', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.equal(config.target, 'browserslist');
});

test('enables only the CSS experiment by default', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.deepEqual(config.experiments, {
    css: true,
  });
});

test('sets compilation environment properties explicitly', () => {
  const config = new WebpackConfigBuilder().setContext('/workspace').setDevtool(false).setTarget(['web', 'es2025']).toConfig();

  assert.equal(config.context, '/workspace');
  assert.equal(config.devtool, false);
  assert.deepEqual(config.target, ['web', 'es2025']);
});

test('does not apply generic bundle-size hints', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.equal(config.performance.hints, false);
});

test('uses live reload without hot module replacement for interactive development', () => {
  const config = new WebpackConfigBuilder().toConfig();

  assert.deepEqual(config.devServer.client, {});
  assert.equal(config.devServer.historyApiFallback, undefined);
  assert.equal(config.devServer.host, '0.0.0.0');
  assert.equal(config.devServer.hot, false);
  assert.equal(config.devServer.liveReload, true);
  assert.equal(config.devServer.webSocketServer, 'ws');
});

test('enables history API fallback without rewriting asset-like paths by default', () => {
  const config = new WebpackConfigBuilder().enableDevServerHistoryApiFallback().toConfig();

  assert.deepEqual(config.devServer.historyApiFallback, {});
});

test('disables all browser-side development server updates for noninteractive serving', () => {
  const config = new WebpackConfigBuilder().setDevServerPort(1234).disableDevServerLiveUpdates().toConfig();

  assert.equal(config.devServer.client, false);
  assert.equal(config.devServer.hot, false);
  assert.equal(config.devServer.liveReload, false);
  assert.equal(config.devServer.port, 1234);
  assert.equal(config.devServer.webSocketServer, false);
});

test('resolves the Node environment from Webpack CLI arguments, the process, then the mode', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'test';

    assert.equal(
      new WebpackConfigBuilder({
        argv: {
          nodeEnv: 'development',
          mode: 'production',
        },
      }).nodeEnv,
      'development',
    );

    assert.equal(
      new WebpackConfigBuilder({
        argv: {
          mode: 'production',
        },
      }).nodeEnv,
      'test',
    );

    delete process.env.NODE_ENV;

    assert.equal(
      new WebpackConfigBuilder({
        argv: {
          mode: 'development',
        },
      }).nodeEnv,
      'development',
    );
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

    assert.equal(
      new WebpackConfigBuilder({
        env: {
          APP_VERSION: '3.0.0',
        },
      }).appVersion,
      '3.0.0',
    );

    assert.equal(new WebpackConfigBuilder().appVersion, '2.0.0');

    process.env.APP_VERSION = '';

    assert.equal(
      new WebpackConfigBuilder({
        env: {
          APP_VERSION: '',
        },
      }).appVersion,
      '1.0.0',
    );

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

test('defines only the explicitly requested compile-time constants', () => {
  const config = new WebpackConfigBuilder()
    .addDefinePlugin({
      TEST_VALUE: JSON.stringify('test'),
    })
    .toConfig();

  assert.deepEqual(config.plugins[0].definitions, {
    TEST_VALUE: '"test"',
  });
});

test('resolves the HTML public path from the final output configuration', () => {
  const setThenAdd = new WebpackConfigBuilder().setPublicPath('./').addHtmlPlugin().toConfig();

  const addThenSet = new WebpackConfigBuilder().addHtmlPlugin().setPublicPath('./').toConfig();

  assert.equal(setThenAdd.output.publicPath, './');
  assert.equal(setThenAdd.plugins[0].options.publicPath, 'auto');
  assert.equal(addThenSet.output.publicPath, './');
  assert.equal(addThenSet.plugins[0].options.publicPath, 'auto');
});

test('resolves the default HTML template relative to the package', () => {
  const config = new WebpackConfigBuilder().addHtmlPlugin().toConfig();

  const expectedTemplate = fileURLToPath(new URL('../assets/index.html', import.meta.url));

  assert.equal(config.plugins[0].options.template, expectedTemplate);
});

test('captures Webpack arguments and environment values at construction', () => {
  const env = {
    APP_NAME: 'Original application',
  };

  const argv = {
    mode: 'development',
  };

  const builder = new WebpackConfigBuilder({
    env,
    argv,
  });

  env.APP_NAME = 'Changed application';
  argv.mode = 'production';

  assert.equal(builder.appName, 'Original application');
  assert.equal(builder.webpackMode, 'development');
});

test('updates configured Terser minimizers when the ECMAScript version changes', () => {
  const setThenAdd = new WebpackConfigBuilder().setEcmaVersion(2022).addTerserMinimizer().toConfig();

  const addThenSet = new WebpackConfigBuilder().addTerserMinimizer().setEcmaVersion(2022).toConfig();

  assert.equal(setThenAdd.optimization.minimizer[0].options.minimizer.options.ecma, 2022);
  assert.equal(addThenSet.optimization.minimizer[0].options.minimizer.options.ecma, 2022);
});

test('precompresses every asset only when compression reduces its size', () => {
  const config = new WebpackConfigBuilder().addGzipCompressionPlugin().addBrotliCompressionPlugin().toConfig();

  const [gzip, brotli] = config.plugins;

  assert.equal(gzip.options.threshold, 0);
  assert.equal(gzip.options.minRatio, 1 - Number.EPSILON);
  assert.equal(brotli.options.threshold, 0);
  assert.equal(brotli.options.minRatio, 1 - Number.EPSILON);
});

test('does not expose a service worker source map by default', () => {
  const config = new WebpackConfigBuilder().addWorkboxServiceWorkerPlugin().toConfig();

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
