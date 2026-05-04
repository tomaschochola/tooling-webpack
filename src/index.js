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

export class Webpack {
  env;
  argv;
  config;

  constructor(env, argv) {
    this.env = env;
    this.argv = argv;

    this.config = {
      target: 'browserslist',
      output: {
        filename: 'immutable.[contenthash].js',
        chunkFilename: 'immutable.[contenthash].js',
        assetModuleFilename: 'immutable.[contenthash][ext][query][fragment]',
        clean: true,
        publicPath: '/',
      },
      devtool: this.WEBPACK_MODE === 'production' ? 'hidden-nosources-source-map' : 'eval-source-map',
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
      },
      resolve: {
        extensions: ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.js', '.cjs'],
      },
      plugins: [],
      module: {
        rules: [],
      },
      optimization: {
        removeAvailableModules: this.WEBPACK_MODE === 'production',
        minimizer: [],
      },
    };
  }

  get WEBPACK_BUILD() {
    return this.env.WEBPACK_BUILD ?? false;
  }

  get WEBPACK_WATCH() {
    return this.env.WEBPACK_WATCH ?? false;
  }

  get WEBPACK_SERVE() {
    return this.env.WEBPACK_SERVE ?? false;
  }

  get WEBPACK_MODE() {
    return this.argv.mode ?? 'production';
  }

  get isProduction() {
    return this.WEBPACK_MODE === 'production';
  }

  get NODE_ENV() {
    return this.argv.nodeEnv ?? 'production';
  }

  get APP_ENV() {
    return this.env.APP_ENV ?? this.argv.appEnv ?? process.env.APP_ENV ?? 'production';
  }

  get APP_NAME() {
    return this.env.APP_NAME ?? this.argv.appName ?? process.env.APP_NAME ?? process.env.npm_package_name ?? 'app';
  }

  get APP_VERSION() {
    return this.env.APP_VERSION ?? this.argv.appVersion ?? process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.0';
  }

  replaceConfig(config) {
    this.config = { ...config };

    return this;
  }

  setPublicPath(publicPath) {
    return this.replaceConfig({
      ...this.config,
      output: {
        ...this.config.output,
        publicPath,
      },
    });
  }

  setOutputPath(path) {
    return this.replaceConfig({
      ...this.config,
      output: {
        ...this.config.output,
        path,
      },
    });
  }

  ruleAssetQueries() {
    return this.replaceConfig({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
          {
            resourceQuery: /source/,
            type: 'asset/source',
          },
          {
            resourceQuery: /resource/,
            type: 'asset/resource',
          },
          {
            resourceQuery: /inline/,
            type: 'asset/inline',
          },
          {
            resourceQuery: /asset/,
            type: 'asset',
          },
        ],
      },
    });
  }

  loaderBabel({
    exclude = [
      /node_modules[\\/]core-js/,
      /node_modules[\\/]webpack[\\/]buildin/,
    ],
    ...options
  } = {}) {
    return this.replaceConfig({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
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

  loaderStyles() {
    return this.replaceConfig({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
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

  loaderHtml(options = {}) {
    return this.replaceConfig({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
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

  pluginCopy(options = {}) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new CopyPlugin({
          patterns: [
            {
              from: './public',
              to: '.',
            },
          ],
          ...options,
        }),
      ],
    });
  }

  pluginCopyFrom(from) {
    return this.pluginCopy({
      patterns: [
        {
          from,
          to: '.',
        },
      ],
    });
  }

  pluginHtml(options = {}) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new HtmlWebpackPlugin({
          template: './node_modules/@tomaschochola/tooling-webpack/assets/index.html',
          filename: 'index.html',
          xhtml: true,
          inject: true,
          chunks: 'all',
          publicPath: this.config.output.publicPath,
          ...options,
        }),
      ],
    });
  }

  pluginGzip(options = {}) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
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

  pluginBrotli(options = {}) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
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

  pluginEnvironment(options = {
    WEBPACK_MODE: this.WEBPACK_MODE,
    WEBPACK_BUILD: this.WEBPACK_BUILD,
    WEBPACK_SERVE: this.WEBPACK_SERVE,
    WEBPACK_WATCH: this.WEBPACK_WATCH,
    NODE_ENV: this.NODE_ENV,
    APP_ENV: this.APP_ENV,
    APP_NAME: this.APP_NAME,
    APP_VERSION: this.APP_VERSION,
  }) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new webpack.EnvironmentPlugin({
          ...options,
        }),
      ],
    });
  }

  pluginDefine(options = {
    global: 'globalThis',
  }) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new webpack.DefinePlugin({
          ...options,
        }),
      ],
    });
  }

  setEntry(options = {}) {
    return this.replaceConfig({
      ...this.config,
      entry: {
        ...this.config.entry,
        ...options,
      },
    });
  }

  presetDefaults(options = {}) {
    const {
      loaderTypeScript = false,
      loaderBabel = !loaderTypeScript,
      loaderHtml = true,
      loaderStyles = true,
      minimizerDefaults = true,
      pluginBrotli = true,
      pluginCopy = false,
      pluginDefine = true,
      pluginEnvironment = true,
      pluginGzip = true,
      pluginHtml = false,
      pluginPwa = false,
      ruleAssetQueries = true,
    } = options;

    let webpack = this;

    if (loaderBabel) {
      webpack = webpack.loaderBabel();
    }

    if (loaderTypeScript) {
      webpack = webpack.loaderTypeScript();
    }

    if (pluginEnvironment) {
      webpack = webpack.pluginEnvironment();
    }

    if (pluginDefine) {
      webpack = webpack.pluginDefine();
    }

    if (loaderStyles) {
      webpack = webpack.loaderStyles();
    }

    if (loaderHtml) {
      webpack = webpack.loaderHtml();
    }

    if (ruleAssetQueries) {
      webpack = webpack.ruleAssetQueries();
    }

    if (minimizerDefaults) {
      webpack = webpack.minimizerDefaults();
    }

    if (pluginHtml) {
      webpack = webpack.pluginHtml();
    }

    if (pluginCopy) {
      webpack = webpack.pluginCopy();
    }

    if (webpack.isProduction) {
      if (pluginGzip) {
        webpack = webpack.pluginGzip();
      }

      if (pluginBrotli) {
        webpack = webpack.pluginBrotli();
      }

      if (pluginPwa) {
        webpack = webpack.pluginPwa();
      }
    }

    return webpack;
  }

  minimizerDefaults({ terser = {}, css = {}, html = {}, json = {}, images = {} } = {}) {
    return this.minimizerTerser(terser)
      .minimizerCss(css)
      .minimizerHtml(html)
      .minimizerJson(json)
      .minimizerImages(images);
  }

  minimizerTerser(options = {}) {
    return this.replaceConfig({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
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

  minimizerCss(options = {}) {
    return this.replaceConfig({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
          new CssMinimizerPlugin(options),
        ],
      },
    });
  }

  minimizerHtml(options = {}) {
    return this.replaceConfig({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
          new HtmlMinimizerPlugin(options),
        ],
      },
    });
  }

  minimizerJson(options = {}) {
    return this.replaceConfig({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
          new JsonMinimizerPlugin(options),
        ],
      },
    });
  }

  minimizerImages(options = {}) {
    return this.replaceConfig({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
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

  loaderTypeScript({
    exclude = [
      /node_modules[\\/]core-js/,
      /node_modules[\\/]webpack[\\/]buildin/,
    ],
    compilerOptions = {},
    ...options
  } = {}) {
    return this.replaceConfig({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
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
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    checkJs: false,
                    declaration: false,
                    declarationMap: false,
                    esModuleInterop: true,
                    jsx: this.WEBPACK_MODE === 'production' ? 'react-jsx' : 'react-jsxdev',
                    module: 'preserve',
                    moduleDetection: 'force',
                    moduleResolution: 'bundler',
                    maxNodeModuleJsDepth: 0,
                    resolveJsonModule: true,
                    sourceMap: true,
                    target: 'es2023',
                    isolatedModules: true,
                    verbatimModuleSyntax: true,
                    allowArbitraryExtensions: true,
                    allowImportingTsExtensions: false,
                    noEmit: false,
                    noEmitOnError: true,
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

  pluginPwa(options = {}) {
    return this.replaceConfig({
      ...this.config,
      plugins: [
        ...this.config.plugins,
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

  mergeConfig(callable) {
    return this.replaceConfig({
      ...this.config,
      ...callable(this.env, this.argv, { ...this.config }),
    });
  }

  buildConfig() {
    return { ...this.config };
  }
}
