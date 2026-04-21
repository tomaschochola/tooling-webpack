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
      },
      experiments: {
        futureDefaults: true,
      },
      resolve: {
        extensions: ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.js', '.cjs'],
      },
      plugins: [],
      module: {
        rules: [
          {
            test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
            resourceQuery: { not: [/raw/] },
            use: [
              {
                loader: 'babel-loader',
              },
            ],
          },
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
          {
            test: /\.(html|php)$/i,
            resourceQuery: { not: [/raw/] },
            use: [
              {
                loader: 'html-loader',
              },
            ],
          },
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
      optimization: {
        removeAvailableModules: this.WEBPACK_MODE === 'production',
        minimizer: [
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
          }),
          new CssMinimizerPlugin(),
          new HtmlMinimizerPlugin(),
          new JsonMinimizerPlugin(),
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
          }),
        ],
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

  replace(config) {
    this.config = { ...config };

    return this;
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
          publicPath: '/',
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
    return this.replace(this.env, this.argv, callable(this.env, this.argv, { ...this.config }));
  }

  build() {
    return { ...this.config };
  }
}
