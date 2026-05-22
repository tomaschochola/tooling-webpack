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
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import WorkboxPlugin from 'workbox-webpack-plugin';
import { constants } from 'zlib';

export class WebpackConfigBuilder {
  #env;
  #argv;
  #config;

  constructor({ env = {}, argv = {} } = {}) {
    this.#env = env;
    this.#argv = argv;

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
        historyApiFallback: true,
        headers: {
          'Cache-Control': 'max-age=0, no-store',
        },
        hot: false,
        liveReload: true,
      },
      experiments: {
        futureDefaults: true,
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
    return this.#argv.nodeEnv ?? 'production';
  }

  get appEnv() {
    return this.#env.APP_ENV ?? this.#argv.appEnv ?? process.env.APP_ENV ?? 'production';
  }

  get appName() {
    return this.#env.APP_NAME ?? this.#argv.appName ?? process.env.APP_NAME ?? process.env.npm_package_name ?? 'app';
  }

  get appVersion() {
    return this.#env.APP_VERSION ?? this.#argv.appVersion ?? process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.0';
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

  setOutputPath(path) {
    return this.#replaceConfig({
      ...this.#config,
      output: {
        ...this.#config.output,
        path,
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

  addGzipCompressionPlugin(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new CompressionPlugin({
          algorithm: 'gzip',
          compressionOptions: { level: 9 },
          minRatio: Infinity,
          filename: '[path][base].gz[query][fragment]',
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
          minRatio: Infinity,
          filename: '[path][base].br[query][fragment]',
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

  addDefinePlugin(options = {
    global: 'globalThis',
  }) {
    return this.#replaceConfig({
      ...this.#config,
      plugins: [
        ...this.#config.plugins,
        new webpack.DefinePlugin({
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

  addTerserMinimizer(options = {}) {
    return this.#replaceConfig({
      ...this.#config,
      optimization: {
        ...this.#config.optimization,
        minimizer: [
          ...(this.#config.optimization.minimizer ?? []),
          new TerserPlugin({
            extractComments: false,
            terserOptions: {
              ecma: 2023,
              compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 5,
              },
              format: {
                comments: false,
              },
            },
            ...options,
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
