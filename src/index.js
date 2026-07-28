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

import CompressionPlugin from 'compression-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import HtmlMinimizerPlugin from 'html-minimizer-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import JsonMinimizerPlugin from 'json-minimizer-webpack-plugin';
import { fileURLToPath, pathToFileURL } from 'node:url';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import WorkboxPlugin from 'workbox-webpack-plugin';
import { constants } from 'zlib';

const robotsMetaPattern = /<meta\b(?=[^>]*\sname\s*=\s*(?:"robots"|'robots'|robots(?=[\s/>])))[^>]*>/gi;

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function applyRobotsMeta(html, content, filename) {
  const meta = `<meta name="robots" content="${escapeHtmlAttribute(content)}" />`;

  let found = false;

  const updatedHtml = html.replace(robotsMetaPattern, () => {
    if (found) {
      return '';
    }

    found = true;

    return meta;
  });

  if (found) {
    return updatedHtml;
  }

  if (!(/<\/head\s*>/i).test(updatedHtml)) {
    throw new Error(`Unable to inject robots metadata into "${filename}": missing </head>.`);
  }

  return updatedHtml.replace((/<\/head\s*>/i), `${meta}</head>`);
}

export class RobotsPlugin {
  #metaContent;
  #robotsFilename;
  #robotsText;

  constructor({
    indexable = false,
    metaContent = indexable ? 'index, follow' : 'noindex, nofollow, noarchive, nosnippet, noimageindex',
    robotsFilename = 'robots.txt',
    robotsText = indexable ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n',
  } = {}) {
    this.#metaContent = metaContent;
    this.#robotsFilename = robotsFilename;
    this.#robotsText = robotsText;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RobotsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RobotsPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          for (const asset of compilation.getAssets()) {
            if (!(/\.html?$/i).test(asset.name)) {
              continue;
            }

            const html = asset.source.source().toString();
            const updatedHtml = applyRobotsMeta(html, this.#metaContent, asset.name);

            compilation.updateAsset(asset.name, new compiler.webpack.sources.RawSource(updatedHtml));
          }

          const robotsSource = new compiler.webpack.sources.RawSource(this.#robotsText);

          if (compilation.getAsset(this.#robotsFilename) === undefined) {
            compilation.emitAsset(this.#robotsFilename, robotsSource);

            return;
          }

          compilation.updateAsset(this.#robotsFilename, robotsSource);
        },
      );
    });
  }
}

export class WebpackConfigBuilder {
  #env;
  #argv;
  #config;
  #ecmaVersion;

  constructor({ env = {}, argv = {} } = {}) {
    this.#env = env;
    this.#argv = argv;
    this.#ecmaVersion = 2025;

    this.#config = {
      target: 'browserslist',
      output: {
        filename: 'immutable.[contenthash].js',
        chunkFilename: 'immutable.[contenthash].js',
        assetModuleFilename: 'immutable.[contenthash][ext][query][fragment]',
        clean: true,
        publicPath: '/',
      },
      devtool: this.webpackMode === 'production' ? 'hidden-nosources-source-map' : 'eval-source-map',
      devServer: {
        host: '0.0.0.0',
        port: 3000,
        historyApiFallback: {
          disableDotRule: true,
        },
        headers: {
          'Cache-Control': 'max-age=0, no-store',
        },
        hot: false,
        liveReload: true,
      },
      experiments: {
        futureDefaults: false,
        css: true,
        typescript: false,
        html: false,
      },
      resolve: {
        extensions: ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.js', '.cjs'],
      },
      plugins: [],
      module: {
        rules: [],
      },
      optimization: {
        removeAvailableModules: this.webpackMode === 'production',
        minimizer: [],
      },
    };

    this.setOutputPath();
  }

  get webpackBuild() {
    return this.#env.WEBPACK_BUILD ?? false;
  }

  get webpackWatch() {
    return this.#env.WEBPACK_WATCH ?? false;
  }

  get webpackServe() {
    return this.#env.WEBPACK_SERVE ?? false;
  }

  get webpackMode() {
    return this.#argv.mode ?? 'production';
  }

  get isProductionMode() {
    return this.webpackMode === 'production';
  }

  get nodeEnv() {
    return this.#argv.nodeEnv ?? process.env.NODE_ENV ?? this.webpackMode;
  }

  get appEnv() {
    return this.#env.APP_ENV ?? process.env.APP_ENV ?? 'production';
  }

  get appName() {
    return this.#env.APP_NAME ?? process.env.APP_NAME ?? process.env.npm_package_name ?? 'app';
  }

  get appVersion() {
    return this.#env.APP_VERSION || process.env.APP_VERSION || process.env.npm_package_version || '0.0.0';
  }

  #replaceConfig(config) {
    this.#config = { ...config };

    return this;
  }

  #setExperiment(experiment, enabled) {
    return this.#replaceConfig({
      ...this.#config,
      experiments: {
        ...this.#config.experiments,
        [experiment]: enabled,
      },
    });
  }

  enableCssExperiment() {
    return this.#setExperiment('css', true);
  }

  disableCssExperiment() {
    return this.#setExperiment('css', false);
  }

  enableHtmlExperiment() {
    return this.#setExperiment('html', true);
  }

  disableHtmlExperiment() {
    return this.#setExperiment('html', false);
  }

  enableTypeScriptExperiment() {
    return this.#setExperiment('typescript', true);
  }

  disableTypeScriptExperiment() {
    return this.#setExperiment('typescript', false);
  }

  setPublicPath(publicPath) {
    return this.#replaceConfig({
      ...this.#config,
      output: {
        ...this.#config.output,
        publicPath,
      },
    });
  }

  setEcmaVersion(ecmaVersion) {
    this.#ecmaVersion = ecmaVersion;

    return this;
  }

  setOutputPath(path = new URL(`./dist/${this.appEnv}/`, pathToFileURL(`${process.cwd()}/`))) {
    return this.#replaceConfig({
      ...this.#config,
      output: {
        ...this.#config.output,
        path: path instanceof URL ? fileURLToPath(path) : path,
      },
    });
  }

  setDevServerPort(port) {
    return this.#replaceConfig({
      ...this.#config,
      devServer: {
        ...this.#config.devServer,
        port,
      },
    });
  }

  setDevServerServer(server) {
    return this.#replaceConfig({
      ...this.#config,
      devServer: {
        ...this.#config.devServer,
        server,
      },
    });
  }

  addAssetQueryRules() {
    return this.#replaceConfig({
      ...this.#config,
      module: {
        ...this.#config.module,
        rules: [
          ...this.#config.module.rules,
          {
            resourceQuery: /^\?source$/,
            type: 'asset/source',
          },
          {
            resourceQuery: /^\?resource$/,
            type: 'asset/resource',
          },
          {
            resourceQuery: /^\?inline$/,
            type: 'asset/inline',
          },
          {
            resourceQuery: /^\?asset$/,
            type: 'asset',
          },
        ],
      },
    });
  }

  addBabelLoader({
    exclude = [
      /node_modules[\\/]core-js/,
      /node_modules[\\/]webpack[\\/]buildin/,
    ],
    ...options
  } = {}) {
    return this.#replaceConfig({
      ...this.#config,
      module: {
        ...this.#config.module,
        rules: [
          ...this.#config.module.rules,
          {
            test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
            exclude,
            resourceQuery: { not: [/raw/] },
            use: [
              {
                loader: 'babel-loader',
                options,
              },
            ],
          },
        ],
      },
    });
  }

  addStyleLoaders() {
    return this.#replaceConfig({
      ...this.#config,
      module: {
        ...this.#config.module,
        rules: [
          ...this.#config.module.rules,
          {
            test: /\.(sass|scss|css)$/i,
            resourceQuery: { not: [/raw/] },
            type: 'css/auto',
            use: [
              {
                loader: 'postcss-loader',
              },
              {
                loader: 'sass-loader',
              },
            ],
          },
        ],
      },
    });
  }

  addHtmlLoader(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      module: {
        ...this.#config.module,
        rules: [
          ...this.#config.module.rules,
          {
            test: /\.(html|php)$/i,
            resourceQuery: { not: [/raw/] },
            use: [
              {
                loader: 'html-loader',
                options,
              },
            ],
          },
        ],
      },
    });
  }

  addCopyPlugin(patternsOrOptions) {
    const options = Array.isArray(patternsOrOptions) ? { patterns: patternsOrOptions } : { ...patternsOrOptions };

    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new CopyPlugin({
          ...options,
        }),
      ],
    });
  }

  addPublicCopyPlugin() {
    return this.addCopyPlugin([
      {
        from: './public',
        to: '.',
      },
    ]);
  }

  addCopyFrom(from) {
    return this.addCopyPlugin([
      {
        from,
        to: '.',
      },
    ]);
  }

  addHtmlPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new HtmlWebpackPlugin({
          template: './node_modules/@tomaschochola/tooling-webpack/assets/index.html',
          filename: 'index.html',
          xhtml: true,
          inject: true,
          chunks: 'all',
          publicPath: this.#config.output.publicPath,
          ...options,
        }),
      ],
    });
  }

  addRobotsPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new RobotsPlugin(options),
      ],
    });
  }

  addGzipCompressionPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new CompressionPlugin({
          algorithm: 'gzip',
          compressionOptions: { level: 9 },
          filename: '[path][base].gz[query][fragment]',
          minRatio: 1 - Number.EPSILON,
          threshold: 1024,
          ...options,
        }),
      ],
    });
  }

  addBrotliCompressionPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new CompressionPlugin({
          algorithm: 'brotliCompress',
          compressionOptions: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
          filename: '[path][base].br[query][fragment]',
          minRatio: 1 - Number.EPSILON,
          threshold: 1024,
          ...options,
        }),
      ],
    });
  }

  addEnvironmentPlugin(options) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new webpack.EnvironmentPlugin({
          ...options,
        }),
      ],
    });
  }

  addDefinePlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new webpack.DefinePlugin({
          global: 'globalThis',
          ...options,
        }),
      ],
    });
  }

  setEntries(entries = {}) {
    return this.#replaceConfig({
      ...this.#config,
      entry: { ...entries },
    });
  }

  addEntries(entries = {}) {
    return this.#replaceConfig({
      ...this.#config,
      entry: {
        ...this.#config.entry,
        ...entries,
      },
    });
  }

  addTerserMinimizer({
    minimizerOptions,
    terserOptions,
    ...options
  } = {}) {
    const configuredOptions = minimizerOptions ?? terserOptions ?? {};

    const defaultCompressOptions = {
      drop_console: true,
      drop_debugger: true,
      passes: 5,
    };

    const defaultFormatOptions = {
      comments: false,
    };

    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new TerserPlugin({
            extractComments: false,
            ...options,
            minimizerOptions: {
              ...configuredOptions,
              ecma: this.#ecmaVersion,
              compress: configuredOptions.compress === false
                ? false
                : {
                    ...defaultCompressOptions,
                    ...configuredOptions.compress,
                  },
              format: configuredOptions.format === null
                ? null
                : {
                    ...defaultFormatOptions,
                    ...configuredOptions.format,
                  },
            },
          }),
        ],
      },
    });
  }

  addCssMinimizer(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new CssMinimizerPlugin(options),
        ],
      },
    });
  }

  addHtmlMinimizer(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new HtmlMinimizerPlugin(options),
        ],
      },
    });
  }

  addJsonMinimizer(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new JsonMinimizerPlugin(options),
        ],
      },
    });
  }

  addImageMinimizer(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new ImageMinimizerPlugin({
            minimizer: {
              implementation: ImageMinimizerPlugin.sharpMinify,
              options: {
                encodeOptions: {
                  jpeg: {
                    quality: 100,
                  },
                  webp: {
                    lossless: true,
                    effort: 6,
                  },
                  avif: {
                    lossless: true,
                    effort: 9,
                  },
                  heif: {
                    lossless: true,
                    effort: 9,
                  },
                  jxl: {
                    lossless: true,
                    effort: 9,
                  },
                  jp2: {
                    lossless: true,
                  },
                  tiff: {
                    quality: 100,
                  },
                  png: {
                    effort: 10,
                  },
                  gif: {
                    effort: 10,
                  },
                },
              },
            },
            generator: [
              {
                preset: 'avif',
                type: 'import',
                implementation: ImageMinimizerPlugin.sharpGenerate,
                options: {
                  encodeOptions: {
                    avif: {
                      quality: 60,
                      lossless: false,
                      effort: 9,
                      chromaSubsampling: '4:2:0',
                      bitdepth: 8,
                    },
                  },
                },
              },
              {
                preset: 'webp',
                type: 'import',
                implementation: ImageMinimizerPlugin.sharpGenerate,
                options: {
                  encodeOptions: {
                    webp: {
                      quality: 90,
                      alphaQuality: 100,
                      lossless: false,
                      nearLossless: false,
                      smartSubsample: true,
                      effort: 6,
                      minSize: false,
                      mixed: false,
                      preset: 'default',
                    },
                  },
                },
              },
              {
                preset: 'png',
                type: 'import',
                implementation: ImageMinimizerPlugin.sharpGenerate,
                options: {
                  encodeOptions: {
                    png: {
                      progressive: true,
                      compressionLevel: 9,
                      adaptiveFiltering: true,
                      quality: 100,
                      effort: 10,
                      palette: true,
                      colours: 256,
                      colors: 256,
                      dither: 0.8,
                    },
                  },
                },
              },
              {
                preset: 'jpg',
                type: 'import',
                implementation: ImageMinimizerPlugin.sharpGenerate,
                options: {
                  encodeOptions: {
                    jpg: {
                      quality: 80,
                      progressive: true,
                      chromaSubsampling: '4:4:4',
                      trellisQuantisation: true,
                      overshootDeringing: true,
                      optimiseScans: true,
                      optimizeScans: true,
                      optimiseCoding: true,
                      optimizeCoding: true,
                      quantisationTable: 2,
                      quantizationTable: 2,
                      mozjpeg: true,
                    },
                  },
                },
              },
            ],
            ...options,
          }),
        ],
      },
    });
  }

  addTypeScriptLoader({
    exclude = [
      /node_modules[\\/]core-js/,
      /node_modules[\\/]webpack[\\/]buildin/,
    ],
    compilerOptions = {},
    ...options
  } = {}) {
    return this.#replaceConfig({
      ...this.#config,
      module: {
        ...this.#config.module,
        rules: [
          ...this.#config.module.rules,
          {
            test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
            exclude,
            resourceQuery: { not: [/raw/] },
            use: [
              {
                loader: 'ts-loader',
                options: {
                  onlyCompileBundledFiles: true,
                  allowTsInNodeModules: true,
                  transpileOnly: true,
                  ...options,
                  compilerOptions: {
                    allowArbitraryExtensions: true,
                    allowJs: true,
                    checkJs: false,
                    declaration: false,
                    declarationMap: false,
                    maxNodeModuleJsDepth: 0,
                    module: 'preserve',
                    moduleResolution: 'bundler',
                    noEmit: false,
                    resolveJsonModule: true,
                    sourceMap: true,
                    ...compilerOptions,
                  },
                },
              },
            ],
          },
        ],
      },
    });
  }

  addWorkboxServiceWorkerPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new WorkboxPlugin.GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          swDest: 'sw.js',
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/admin\//,
            /^\/otlp\//,
            /^\/ws\//,
            /\./,
          ],
          ...options,
        }),
      ],
    });
  }

  addIgnoredWarnings(warnings) {
    return this.#replaceConfig({
      ...this.#config,
      ignoreWarnings: [
        ...(this.#config.ignoreWarnings ?? []),
        ...warnings,
      ],
    });
  }

  toConfig() {
    const config = {
      ...this.#config,
      output: { ...this.#config.output },
      devServer: {
        ...this.#config.devServer,
        headers: { ...this.#config.devServer.headers },
      },
      experiments: { ...this.#config.experiments },
      resolve: {
        ...this.#config.resolve,
        extensions: [...this.#config.resolve.extensions],
      },
      plugins: [...this.#config.plugins],
      module: {
        ...this.#config.module,
        rules: [...this.#config.module.rules],
      },
      optimization: {
        ...this.#config.optimization,
        minimizer: [...(this.#config.optimization.minimizer ?? [])],
      },
    };

    if (this.#config.ignoreWarnings !== undefined) {
      config.ignoreWarnings = [...this.#config.ignoreWarnings];
    }

    return config;
  }
}
