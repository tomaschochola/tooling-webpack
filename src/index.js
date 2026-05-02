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
      target: ['web', 'es2020'],
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

  get NODE_ENV() {
    return this.argv.nodeEnv ?? 'production';
  }

  get APP_ENV() {
    return this.env.APP_ENV ?? this.argv.appEnv ?? process.env.APP_ENV ?? null;
  }

  get APP_NAME() {
    return this.env.APP_NAME ?? this.argv.appName ?? process.env.APP_NAME ?? process.env.npm_package_name ?? null;
  }

  get APP_VERSION() {
    return this.env.APP_VERSION ?? this.argv.appVersion ?? process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.0';
  }

  replace(config) {
    this.config = { ...config };

    return this;
  }

  public(publicPath) {
    return this.replace({
      ...this.config,
      output: {
        ...this.config.output,
        publicPath,
      },
    });
  }

  output(path) {
    return this.replace({
      ...this.config,
      output: {
        ...this.config.output,
        path,
      },
    });
  }

  queries() {
    return this.replace({
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

  babel(options = {}) {
    return this.replace({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
          {
            test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
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

  styles() {
    return this.replace({
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

  htmlLoader(options = {}) {
    return this.replace({
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

  copy(options = {}) {
    return this.replace({
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

  from(from) {
    return this.copy({
      patterns: [
        {
          from,
          to: '.',
        },
      ],
    });
  }

  html(options = {}) {
    return this.replace({
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

  gzip(options = {}) {
    return this.replace({
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

  brotli(options = {}) {
    return this.replace({
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

  environment(options = {
    WEBPACK_MODE: this.WEBPACK_MODE,
    WEBPACK_BUILD: this.WEBPACK_BUILD,
    WEBPACK_SERVE: this.WEBPACK_SERVE,
    WEBPACK_WATCH: this.WEBPACK_WATCH,
    NODE_ENV: this.NODE_ENV,
    APP_ENV: this.APP_ENV,
    APP_NAME: this.APP_NAME,
    APP_VERSION: this.APP_VERSION,
  }) {
    return this.replace({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new webpack.EnvironmentPlugin({
          ...options,
        }),
      ],
    });
  }

  define(options = {
    global: 'globalThis',
  }) {
    return this.replace({
      ...this.config,
      plugins: [
        ...this.config.plugins,
        new webpack.DefinePlugin({
          ...options,
        }),
      ],
    });
  }

  entry(options = {}) {
    return this.replace({
      ...this.config,
      entry: {
        ...this.config.entry,
        ...options,
      },
    });
  }

  browserslist(options = {}) {
    return this.replace({
      ...this.config,
      target: 'browserslist',
      ...options,
    });
  }

  defaults(options = {}) {
    const {
      brotli = true,
      copy = false,
      define = true,
      environment = true,
      gzip = true,
      html = false,
      htmlLoader = true,
      minimizers = true,
      pwa = false,
      queries = true,
      styles = true,
    } = options;

    const useTypescript = options.babel === true ? false : options.typescript === true || options.babel === false;
    const useBabel = !useTypescript;
    const useBrowserslist = useBabel;

    let webpack = this;

    if (useBrowserslist) {
      webpack = webpack.browserslist();
    }

    if (useBabel) {
      webpack = webpack.babel();
    }

    if (useTypescript) {
      webpack = webpack.typescript();
    }

    if (environment) {
      webpack = webpack.environment();
    }

    if (define) {
      webpack = webpack.define();
    }

    if (styles) {
      webpack = webpack.styles();
    }

    if (htmlLoader) {
      webpack = webpack.htmlLoader();
    }

    if (queries) {
      webpack = webpack.queries();
    }

    if (minimizers) {
      webpack = webpack.minimizers();
    }

    if (html) {
      webpack = webpack.html();
    }

    if (copy) {
      webpack = webpack.copy();
    }

    if (webpack.WEBPACK_MODE === 'production') {
      if (gzip) {
        webpack = webpack.gzip();
      }

      if (brotli) {
        webpack = webpack.brotli();
      }

      if (pwa) {
        webpack = webpack.pwa();
      }
    }

    return webpack;
  }

  minimizers({ terser = {}, css = {}, html = {}, json = {}, images = {} } = {}) {
    return this.minimizeTerser(terser)
      .minimizeCss(css)
      .minimizeHtml(html)
      .minimizeJson(json)
      .minimizeImages(images);
  }

  minimizeTerser(options = {}) {
    return this.replace({
      ...this.config,
      optimization: {
        ...this.config.optimization,
        minimizer: [
          ...(this.config.optimization.minimizer ?? []),
          new TerserPlugin({
            extractComments: false,
            terserOptions: {
              ecma: 2020,
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

  minimizeCss(options = {}) {
    return this.replace({
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

  minimizeHtml(options = {}) {
    return this.replace({
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

  minimizeJson(options = {}) {
    return this.replace({
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

  minimizeImages(options = {}) {
    return this.replace({
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

  typescript({ compilerOptions = {}, ...options } = {}) {
    return this.replace({
      ...this.config,
      module: {
        ...this.config.module,
        rules: [
          ...this.config.module.rules,
          {
            test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
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
                    declaration: false,
                    declarationMap: false,
                    esModuleInterop: true,
                    jsx: this.WEBPACK_MODE === 'production' ? 'react-jsx' : 'react-jsxdev',
                    module: 'preserve',
                    moduleResolution: 'bundler',
                    resolveJsonModule: true,
                    sourceMap: true,
                    target: 'es2020',
                    isolatedModules: true,
                    verbatimModuleSyntax: true,
                    allowArbitraryExtensions: true,
                    allowImportingTsExtensions: false,
                    noEmit: false,
                    noEmitOnError: false,
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

  pwa(options = {}) {
    return this.replace({
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

  merge(callable) {
    return this.replace({
      ...this.config,
      ...callable(this.env, this.argv, { ...this.config }),
    });
  }

  build() {
    return { ...this.config };
  }
}
