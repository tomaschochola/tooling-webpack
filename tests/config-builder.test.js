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

import { normalizePublicUrl, WebpackConfigBuilder } from '../src/index.js';

test('requires a supported ECMAScript output version', () => {
  for (const ecmaVersion of [undefined, null, 6, 2014, 2026, '2025']) {
    assert.throws(() => new WebpackConfigBuilder({ ecmaVersion }), {
      name: 'TypeError',
    });
  }

  for (const ecmaVersion of [5, 2015, 2025]) {
    assert.doesNotThrow(() => new WebpackConfigBuilder({ ecmaVersion }));
  }
});

test('separates default build output by Webpack mode and application environment', () => {
  const config = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: {
      mode: 'production',
    },
    env: {
      APP_ENV: 'preview',
    },
  }).toConfig();

  assert.equal(config.output.path, resolve('build', 'production', 'preview'));
});

test('rejects unsafe default output path segments', () => {
  for (const appEnv of ['', '.', '..', '../preview', '/tmp', 'preview/test']) {
    assert.throws(
      () =>
        new WebpackConfigBuilder({
          ecmaVersion: 2025,
          argv: {
            mode: 'production',
          },
          env: {
            APP_ENV: appEnv,
          },
        }),
      {
        name: 'TypeError',
      },
    );
  }

  assert.throws(
    () =>
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: {
          mode: 'custom',
        },
      }),
    {
      name: 'TypeError',
    },
  );
});

test('derives the public path from the deployment location by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.equal(config.output.publicPath, 'auto');
});

test('sets an absolute HTTPS public URL for externally consumed asset URLs', () => {
  const root = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicUrl('https://example.com/').toConfig();
  const subpath = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicUrl('https://cdn.example.com/application/').toConfig();

  assert.equal(root.output.publicPath, 'https://example.com/');
  assert.equal(subpath.output.publicPath, 'https://cdn.example.com/application/');
});

test('normalizes public URLs independently for other deployment metadata', () => {
  assert.equal(normalizePublicUrl('https://EXAMPLE.com/application/'), 'https://example.com/application/');
});

test('rejects public URLs that are not safe absolute deployment bases', () => {
  for (const publicUrl of [
    undefined,
    null,
    '/',
    'http://example.com/',
    'https://user@example.com/',
    'https://example.com/application',
    'https://example.com/?version=1',
    'https://example.com/#fragment',
  ]) {
    assert.throws(() => new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicUrl(publicUrl), {
      name: 'TypeError',
    });
  }
});

test('derives the Webpack runtime target from Browserslist by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.equal(config.target, 'browserslist');
});

test('disables source maps in production mode by default', () => {
  const production = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: {
      WEBPACK_BUILD: true,
    },
    argv: {
      mode: 'production',
    },
  }).toConfig();
  const development = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: {
      mode: 'development',
    },
  }).toConfig();
  const productionServe = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: {
      WEBPACK_SERVE: true,
    },
    argv: {
      mode: 'production',
    },
  }).toConfig();

  assert.equal(production.devtool, false);
  assert.equal(development.devtool, 'source-map');
  assert.equal(productionServe.devtool, false);
});

test('distinguishes production compilation from production build output', () => {
  const developmentBuild = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: { WEBPACK_BUILD: true },
    argv: { mode: 'development' },
  });
  const productionConfiguration = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: { mode: 'production' },
  });
  const productionBuild = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: { WEBPACK_BUILD: true },
    argv: { mode: 'production' },
  });
  const productionServe = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: { WEBPACK_SERVE: true },
    argv: { mode: 'production' },
  });
  const productionWatch = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env: { WEBPACK_WATCH: true },
    argv: { mode: 'production' },
  });

  assert.equal(developmentBuild.isProduction, false);
  assert.equal(developmentBuild.isProductionBuild, false);
  assert.equal(productionConfiguration.isProduction, true);
  assert.equal(productionConfiguration.isProductionBuild, false);
  assert.equal(productionBuild.isProduction, true);
  assert.equal(productionBuild.isProductionBuild, true);
  assert.equal(productionServe.isProduction, true);
  assert.equal(productionServe.isProductionBuild, false);
  assert.equal(productionWatch.isProduction, true);
  assert.equal(productionWatch.isProductionBuild, false);
});

test('enables only the CSS experiment by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.deepEqual(config.experiments, {
    css: true,
  });
});

test('rejects duplicate one-shot configuration methods without changing their first result', () => {
  const builder = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicPath('/');

  assert.throws(() => builder.setPublicPath('/application/'), {
    message: 'setPublicPath() cannot be called more than once.',
  });
  assert.equal(builder.toConfig().output.publicPath, '/');
});

test('treats relative and absolute public path setters as the same one-shot operation', () => {
  const relative = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicPath('/');
  const absolute = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicUrl('https://example.com/');

  assert.throws(() => relative.setPublicUrl('https://example.com/'), {
    message: 'setPublicUrl() cannot be called more than once.',
  });
  assert.throws(() => absolute.setPublicPath('/'), {
    message: 'setPublicPath() cannot be called more than once.',
  });
  assert.equal(relative.toConfig().output.publicPath, '/');
  assert.equal(absolute.toConfig().output.publicPath, 'https://example.com/');
});

test('treats opposite CSS experiment methods as the same one-shot operation', () => {
  const builder = new WebpackConfigBuilder({
    ecmaVersion: 2025,
  }).disableCssExperiment();

  assert.throws(() => builder.enableCssExperiment(), {
    message: 'enableCssExperiment() cannot be called more than once.',
  });
  assert.equal(builder.toConfig().experiments.css, false);
});

test('allows repeatable additive methods to be called more than once', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addEntries({ index: './src/index.js' }).addEntries({ admin: './src/admin.js' }).toConfig();

  assert.deepEqual(config.entry, {
    index: './src/index.js',
    admin: './src/admin.js',
  });
});

test('does not register a method whose plugin construction failed', () => {
  const builder = new WebpackConfigBuilder({ ecmaVersion: 2025 });

  assert.throws(() => builder.addArchivePlugin({ format: 'rar' }), {
    name: 'TypeError',
  });
  assert.doesNotThrow(() => builder.addArchivePlugin());
});

test('extends the standard Webpack module extensions', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.deepEqual(config.resolve.extensions, ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.cjs', '...']);
});

test('sets compilation environment properties explicitly', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setContext('/workspace').setDevtool(false).setTarget(['web', 'es2025']).toConfig();

  assert.equal(config.context, '/workspace');
  assert.equal(config.devtool, false);
  assert.deepEqual(config.target, ['web', 'es2025']);
});

test('does not apply generic bundle-size hints', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.equal(config.performance.hints, false);
});

test('uses live reload without hot module replacement for interactive development', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).toConfig();

  assert.deepEqual(config.devServer.client, {});
  assert.equal(config.devServer.historyApiFallback, undefined);
  assert.equal(config.devServer.host, '0.0.0.0');
  assert.equal(config.devServer.hot, false);
  assert.equal(config.devServer.liveReload, true);
  assert.equal(config.devServer.static, false);
  assert.equal(config.devServer.webSocketServer, 'ws');
});

test('enables history API fallback without rewriting asset-like paths by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).enableDevServerHistoryApiFallback().toConfig();

  assert.deepEqual(config.devServer.historyApiFallback, {});
});

test('disables all browser-side development server updates for noninteractive serving', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setDevServerPort(1234).disableDevServerLiveUpdates().toConfig();

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
        ecmaVersion: 2025,
        argv: {
          nodeEnv: 'development',
          mode: 'production',
        },
      }).nodeEnv,
      'development',
    );

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: {
          mode: 'production',
        },
      }).nodeEnv,
      'test',
    );

    delete process.env.NODE_ENV;

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
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

test('resolves the application environment from Webpack env, the process, then the mode', () => {
  const originalAppEnv = process.env.APP_ENV;

  try {
    process.env.APP_ENV = 'staging';

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: {
          mode: 'development',
        },
        env: {
          APP_ENV: 'preview',
        },
      }).appEnv,
      'preview',
    );

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: {
          mode: 'development',
        },
      }).appEnv,
      'staging',
    );

    delete process.env.APP_ENV;

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: { mode: 'development' },
      }).appEnv,
      'development',
    );
    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        argv: { mode: 'production' },
      }).appEnv,
      'production',
    );
  } finally {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
  }
});

test('resolves application indexability strictly from Webpack env or the process', () => {
  const originalAppIndexable = process.env.APP_INDEXABLE;

  try {
    process.env.APP_INDEXABLE = 'true';

    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025 }).appIndexable, true);
    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025, env: { APP_INDEXABLE: false } }).appIndexable, false);
    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025, env: { APP_INDEXABLE: 'false' } }).appIndexable, false);
    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025, env: { APP_INDEXABLE: true } }).appIndexable, true);
    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025, env: { APP_INDEXABLE: 'true' } }).appIndexable, true);

    assert.throws(() => new WebpackConfigBuilder({ ecmaVersion: 2025, env: { APP_INDEXABLE: 'yes' } }).appIndexable, {
      message: 'APP_INDEXABLE must be true or false.',
      name: 'TypeError',
    });

    delete process.env.APP_INDEXABLE;

    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025 }).appIndexable, false);
  } finally {
    if (originalAppIndexable === undefined) {
      delete process.env.APP_INDEXABLE;
    } else {
      process.env.APP_INDEXABLE = originalAppIndexable;
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
        ecmaVersion: 2025,
        env: {
          APP_VERSION: '3.0.0',
        },
      }).appVersion,
      '3.0.0',
    );

    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025 }).appVersion, '2.0.0');

    process.env.APP_VERSION = '';

    assert.equal(
      new WebpackConfigBuilder({
        ecmaVersion: 2025,
        env: {
          APP_VERSION: '',
        },
      }).appVersion,
      '1.0.0',
    );

    delete process.env.npm_package_version;

    assert.equal(new WebpackConfigBuilder({ ecmaVersion: 2025 }).appVersion, '0.0.0');
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
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 })
    .addDefinePlugin({
      TEST_VALUE: JSON.stringify('test'),
    })
    .toConfig();

  assert.deepEqual(config.plugins[0].definitions, {
    TEST_VALUE: '"test"',
  });
});

test('preserves EnvironmentPlugin input forms without retaining mutable inputs', () => {
  const names = ['NODE_ENV', 'DEBUG'];
  const defaults = {
    APP_ENV: 'production',
  };
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addEnvironmentPlugin(names).addEnvironmentPlugin(defaults).addEnvironmentPlugin('CI').toConfig();

  names.push('CHANGED');
  defaults.APP_ENV = 'changed';

  assert.deepEqual(config.plugins[0].keys, ['NODE_ENV', 'DEBUG']);
  assert.deepEqual(config.plugins[0].defaultValues, {});
  assert.deepEqual(config.plugins[1].keys, ['APP_ENV']);
  assert.deepEqual(config.plugins[1].defaultValues, {
    APP_ENV: 'production',
  });
  assert.deepEqual(config.plugins[2].keys, ['CI']);
  assert.deepEqual(config.plugins[2].defaultValues, {});
});

test('resolves the HTML public path from the final output configuration', () => {
  const setThenAdd = new WebpackConfigBuilder({ ecmaVersion: 2025 }).setPublicPath('./').addHtmlPlugin().toConfig();

  const addThenSet = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlPlugin().setPublicPath('./').toConfig();

  assert.equal(setThenAdd.output.publicPath, './');
  assert.equal(setThenAdd.plugins[0].options.publicPath, 'auto');
  assert.equal(addThenSet.output.publicPath, './');
  assert.equal(addThenSet.plugins[0].options.publicPath, 'auto');
});

test('delegates HTML template selection and accepts custom template content', () => {
  const defaultConfig = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlPlugin().toConfig();
  const templateContent = '<!doctype html><html lang="cs"><head><title>Example</title></head><body></body></html>';
  const customConfig = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlPlugin({ templateContent }).toConfig();

  assert.equal(defaultConfig.plugins[0].userOptions.template, undefined);
  assert.equal(defaultConfig.plugins[0].userOptions.templateContent, undefined);
  assert.equal(customConfig.plugins[0].userOptions.template, undefined);
  assert.equal(customConfig.plugins[0].userOptions.templateContent, templateContent);
});

test('extends HTML sources with social images while allowing callers to replace the defaults', () => {
  const defaults = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlLoader().toConfig();
  const disabled = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlLoader({ sources: false }).toConfig();
  const sources = defaults.module.rules[0].use[0].options.sources;
  const socialImage = sources.list[1];

  assert.equal(sources.list[0], '...');
  assert.equal(socialImage.tag, 'meta');
  assert.equal(socialImage.attribute, 'content');
  assert.equal(socialImage.type, 'src');
  assert.equal(socialImage.filter('meta', 'content', [{ name: 'property', value: 'og:image' }]), true);
  assert.equal(socialImage.filter('meta', 'content', [{ name: 'name', value: 'twitter:image' }]), true);
  assert.equal(socialImage.filter('meta', 'content', [{ name: 'property', value: 'og:image:alt' }]), false);
  assert.equal(disabled.module.rules[0].use[0].options.sources, false);
});

test('substitutes escaped HTML variables after a custom preprocessor', async () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 })
    .addHtmlLoader({
      preprocessor: (content) => content.replace('{{ SOURCE }}', '{{ PUBLIC_URL }}'),
      variables: {
        PUBLIC_URL: 'https://example.com/?left=1&right="two"',
      },
    })
    .toConfig();
  const preprocessor = config.module.rules[0].use[0].options.preprocessor;

  assert.equal(await preprocessor('<link href="{{ SOURCE }}" />', {}), '<link href="https://example.com/?left=1&amp;right=&quot;two&quot;" />');
});

test('rejects invalid and unknown HTML variables', async () => {
  for (const variables of [null, [], { lower_case: 'value' }, { PUBLIC_URL: 42 }]) {
    assert.throws(() => new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlLoader({ variables }), {
      name: 'TypeError',
    });
  }

  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addHtmlLoader({ variables: {} }).toConfig();
  const preprocessor = config.module.rules[0].use[0].options.preprocessor;

  await assert.rejects(() => preprocessor('<link href="{{ UNKNOWN }}" />', {}), {
    message: 'Unknown HTML variable: UNKNOWN.',
    name: 'TypeError',
  });
});

test('captures Webpack arguments and environment values at construction', () => {
  const env = {
    APP_NAME: 'Original application',
  };

  const argv = {
    mode: 'development',
  };

  const builder = new WebpackConfigBuilder({ ecmaVersion: 2025, env, argv });

  env.APP_NAME = 'Changed application';
  argv.mode = 'production';

  assert.equal(builder.appName, 'Original application');
  assert.equal(builder.webpackMode, 'development');
});

test('optimizes browser chunks with overridable isolated settings', () => {
  const defaults = new WebpackConfigBuilder({ ecmaVersion: 2025 }).optimizeChunks().toConfig();
  const runtimeChunk = {
    name: 'runtime',
  };
  const splitChunks = {
    chunks: 'all',
    minSize: 40_000,
  };
  const builder = new WebpackConfigBuilder({
    ecmaVersion: 2025,
  }).optimizeChunks({ runtimeChunk, splitChunks });
  const custom = builder.toConfig();

  runtimeChunk.name = 'changed';
  splitChunks.minSize = 0;

  assert.equal(defaults.optimization.runtimeChunk, 'single');
  assert.deepEqual(defaults.optimization.splitChunks, {
    chunks: 'all',
  });
  assert.deepEqual(custom.optimization.runtimeChunk, {
    name: 'runtime',
  });
  assert.deepEqual(custom.optimization.splitChunks, {
    chunks: 'all',
    minSize: 40_000,
  });

  custom.optimization.runtimeChunk.name = 'returned config changed';
  custom.optimization.splitChunks.minSize = 1;

  assert.deepEqual(builder.toConfig().optimization.runtimeChunk, {
    name: 'runtime',
  });
  assert.deepEqual(builder.toConfig().optimization.splitChunks, {
    chunks: 'all',
    minSize: 40_000,
  });
});

test('passes the constructor ECMAScript version to Terser regardless of per-plugin options', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2022 })
    .addTerserMinimizer({
      minimizerOptions: {
        ecma: 2015,
      },
    })
    .toConfig();

  assert.equal(config.optimization.minimizer[0].options.minimizer.options.ecma, 2022);
});

test('configures the canonical browser asset optimizers', () => {
  const builder = new WebpackConfigBuilder({ ecmaVersion: 2025 }).optimizeAssets();
  const config = builder.toConfig();

  assert.deepEqual(
    config.optimization.minimizer.map(({ constructor }) => constructor.name),
    ['TerserPlugin', 'CssMinimizerPlugin', 'HtmlMinimizerPlugin', 'JsonMinimizerPlugin'],
  );
  assert.equal(config.plugins[0].constructor.name, 'ImageMinimizerPlugin');
  assert.throws(() => builder.optimizeAssets(), {
    message: 'optimizeAssets() cannot be called more than once.',
  });
});

test('precompresses compressible web assets only when compression reduces their size', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addGzipCompressionPlugin().addBrotliCompressionPlugin().toConfig();

  const [gzip, brotli] = config.plugins;

  assert.deepEqual(gzip.options.compressionOptions, {
    level: 9,
    memLevel: 9,
  });
  assert.equal(gzip.options.threshold, 0);
  assert.equal(gzip.options.minRatio, 1 - Number.EPSILON);
  assert.equal(brotli.options.threshold, 0);
  assert.equal(brotli.options.minRatio, 1 - Number.EPSILON);

  for (const filename of ['index.html', 'application.js', 'styles.css', 'data.json', 'image.svg', 'font.ttf', 'module.wasm', 'manifest.webmanifest', 'source.js.map']) {
    assert.equal(
      gzip.options.test.some((pattern) => pattern.test(filename)),
      true,
    );
    assert.equal(
      brotli.options.test.some((pattern) => pattern.test(filename)),
      true,
    );
  }

  for (const filename of ['document.pdf', 'image.avif', 'image.jpg', 'image.png', 'font.woff2', 'archive.zip', 'audio.mp3', 'video.mp4']) {
    assert.equal(
      gzip.options.test.some((pattern) => pattern.test(filename)),
      false,
    );
    assert.equal(
      brotli.options.test.some((pattern) => pattern.test(filename)),
      false,
    );
  }
});

test('shares idempotent output query rules across assets and image generators', () => {
  const assetFirst = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addAssetQueryRules().addImageMinimizer().addAssetQueryRules().toConfig();
  const imageFirst = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addImageMinimizer().addAssetQueryRules().toConfig();

  for (const config of [assetFirst, imageFirst]) {
    assert.equal(config.module.rules.length, 1);
    assert.deepEqual(
      config.module.rules[0].oneOf.map(({ type }) => type),
      ['asset/source', 'asset/resource', 'asset/inline', 'asset'],
    );

    const resourceCondition = config.module.rules[0].oneOf[1].resourceQuery;

    assert.equal(resourceCondition('?resource'), true);
    assert.equal(resourceCondition('?as=webp&resource'), true);
    assert.equal(resourceCondition('?resource&as=webp'), true);
    assert.equal(resourceCondition('?resource=true'), false);
    assert.equal(resourceCondition('?inline'), false);
  }
});

test('does not configure automatic image minimization implicitly', () => {
  const config = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: { mode: 'production' },
  })
    .addImageMinimizer()
    .toConfig();

  assert.equal(config.plugins[0].options.minimizer, undefined);
});

test('uses quality-first defaults for explicit image conversions', () => {
  const config = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: { mode: 'production' },
  })
    .addImageMinimizer()
    .toConfig();
  const generators = Object.fromEntries(config.plugins[0].options.generator.map((generator) => [generator.preset, generator]));

  for (const generator of Object.values(generators)) {
    assert.equal(generator.options.rotate, 'auto');
    assert.deepEqual(generator.options.resize, {
      fastShrinkOnLoad: false,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  assert.deepEqual(generators.avif.options.encodeOptions.avif, {
    quality: 80,
    lossless: false,
    effort: 9,
    chromaSubsampling: '4:4:4',
    bitdepth: 8,
    tune: 'ssim',
  });
  assert.deepEqual(generators.webp.options.encodeOptions.webp, {
    quality: 90,
    alphaQuality: 100,
    nearLossless: true,
    effort: 6,
    exact: true,
  });
  assert.deepEqual(generators.png.options.encodeOptions.png, {
    progressive: false,
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: false,
  });
  assert.deepEqual(generators.jpg.options.encodeOptions.jpg, {
    quality: 95,
    chromaSubsampling: '4:4:4',
    mozjpeg: true,
  });
  assert.deepEqual(generators.jpeg.options.encodeOptions.jpeg, generators.jpg.options.encodeOptions.jpg);
});

test('does not expose a service worker source map by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin().toConfig();

  assert.equal(config.plugins[0].config.sourcemap, false);
});

test('keeps generated and retirement service workers mutually exclusive', () => {
  const retirement = new WebpackConfigBuilder({
    ecmaVersion: 2025,
  }).addServiceWorkerRetirement();
  const generated = new WebpackConfigBuilder({
    ecmaVersion: 2025,
  }).addWorkboxServiceWorkerPlugin();

  assert.throws(() => retirement.addWorkboxServiceWorkerPlugin(), {
    message: 'addWorkboxServiceWorkerPlugin() cannot be called more than once.',
  });
  assert.throws(() => generated.addServiceWorkerRetirement(), {
    message: 'addServiceWorkerRetirement() cannot be called more than once.',
  });
});

test('rejects the canonical registration entry from retirement builds regardless of static entry shape or call order', () => {
  const registrationEntry = '@tomaschochola/tooling-webpack/register-service-worker';
  const expected = {
    message: `Service Worker retirement builds must not include the "${registrationEntry}" entry because it would register the retirement worker again.`,
  };
  const entries = [{ index: registrationEntry }, { index: [registrationEntry, './src/index.js'] }, { index: { import: [registrationEntry, './src/index.js'] } }];

  for (const entry of entries) {
    assert.throws(() => new WebpackConfigBuilder({ ecmaVersion: 2025 }).setEntries(entry).addServiceWorkerRetirement(), expected);
  }

  const retirementBeforeEntries = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addServiceWorkerRetirement().setEntries({ index: { import: registrationEntry } });

  assert.throws(() => retirementBeforeEntries.toConfig(), expected);
});

test('does not activate or claim existing service worker clients by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin().toConfig();

  assert.equal(config.plugins[0].config.clientsClaim, undefined);
  assert.equal(config.plugins[0].config.skipWaiting, undefined);
});

test('supports explicit immediate service worker activation and client claiming', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 })
    .addWorkboxServiceWorkerPlugin({
      clientsClaim: true,
      skipWaiting: true,
    })
    .toConfig();

  assert.equal(config.plugins[0].config.clientsClaim, true);
  assert.equal(config.plugins[0].config.skipWaiting, true);
});

test('precaches application shell assets by default', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin().toConfig();
  const include = config.plugins[0].config.include;

  for (const asset of [
    'index.html',
    'admin/index.html',
    'immutable.1234.js',
    'immutable.1234.mjs',
    'immutable.1234.css',
    'immutable.1234.wasm',
    'manifest.webmanifest',
    'manifest.json',
    'immutable.1234.woff2',
  ]) {
    assert.equal(
      include.some((condition) => condition.test(asset)),
      true,
      `${asset} should be precached`,
    );
  }

  for (const asset of ['data.json', 'immutable.1234.png', 'immutable.1234.svg', 'immutable.1234.woff', 'immutable.1234.mp4', 'immutable.1234.js.map', 'immutable.1234.js.br']) {
    assert.equal(
      include.some((condition) => condition.test(asset)),
      false,
      `${asset} should not be precached`,
    );
  }
});

test('allows the default Workbox precache selection to be replaced or narrowed', () => {
  const include = [/\.html$/];
  const exclude = [/\.png$/];
  const included = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin({ include }).toConfig();
  const excluded = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin({ exclude }).toConfig();

  assert.equal(included.plugins[0].config.include, include);
  assert.equal(excluded.plugins[0].config.exclude, exclude);
  assert.ok(Array.isArray(excluded.plugins[0].config.include));
});

test('does not impose an application navigation fallback or file size limit', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 }).addWorkboxServiceWorkerPlugin().toConfig();

  assert.equal(config.plugins[0].config.maximumFileSizeToCacheInBytes, undefined);
  assert.equal(config.plugins[0].config.navigateFallback, undefined);
  assert.equal(config.plugins[0].config.navigateFallbackDenylist, undefined);
});

test('allows immediate service worker activation to be enabled explicitly', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 })
    .addWorkboxServiceWorkerPlugin({
      clientsClaim: true,
      include: [],
      skipWaiting: true,
    })
    .toConfig();

  assert.equal(config.plugins[0].config.clientsClaim, true);
  assert.equal(config.plugins[0].config.skipWaiting, true);
});

test('allows a service worker source map to be enabled explicitly', () => {
  const config = new WebpackConfigBuilder({ ecmaVersion: 2025 })
    .addWorkboxServiceWorkerPlugin({
      include: [],
      sourcemap: true,
    })
    .toConfig();

  assert.equal(config.plugins[0].config.sourcemap, true);
});
