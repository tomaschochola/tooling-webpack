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
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import WorkboxPlugin from 'workbox-webpack-plugin';
import { constants } from 'zlib';

import { ArchivePlugin } from './archive_plugin.js';
import { normalizeJsonOverrides, normalizeJsonReferences } from './json_references_loader.js';
import { RobotsPlugin } from './robots_plugin.js';
import { safeSharpGenerate } from './safe_sharp_generate.js';

const require = createRequire(import.meta.url);
const babelLoader = require.resolve('babel-loader');
const defaultCompressionTests = [
  /\.(?:css|csv|html?|ics|md|text|tsv|txt|vtt)(?:[?#].*)?$/i,
  /\.(?:atom|json|jsonld|map|rss|webmanifest|xhtml|xml|xsl)(?:[?#].*)?$/i,
  /\.(?:cjs|js|mjs|wasm)(?:[?#].*)?$/i,
  /\.(?:eot|otf|svg|ttf)(?:[?#].*)?$/i,
];
const defaultWorkboxInclude = [/\.(?:css|html?|js|mjs|wasm|webmanifest|woff2)(?:[?#].*)?$/i, /(?:^|\/)manifest\.json(?:[?#].*)?$/i];
const htmlLoader = require.resolve('html-loader');
const jsonReferenceModuleLoader = fileURLToPath(new URL('./json_reference_module_loader.js', import.meta.url));
const jsonReferencesLoader = fileURLToPath(new URL('./json_references_loader.js', import.meta.url));
const postcssLoader = require.resolve('postcss-loader');
const sassLoader = require.resolve('sass-loader');
const serviceWorkerRegistrationEntry = '@tomaschochola/tooling-webpack/register-service-worker';
const serviceWorkerRetirementSource = fileURLToPath(new URL('./service_worker_retirement.js', import.meta.url));
const supportedEcmaVersions = new Set([5, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
const webpackModes = new Set(['development', 'none', 'production']);
const methodPolicies = new Map([
  ['enableCssExperiment', { duplicate: 'error', operation: 'cssExperiment' }],
  ['disableCssExperiment', { duplicate: 'error', operation: 'cssExperiment' }],
  ['setContext', { duplicate: 'error' }],
  ['setDevtool', { duplicate: 'error' }],
  ['setPublicPath', { duplicate: 'error', operation: 'publicPath' }],
  ['setPublicUrl', { duplicate: 'error', operation: 'publicPath' }],
  ['setTarget', { duplicate: 'error' }],
  ['setOutputPath', { duplicate: 'error' }],
  ['setDevServerPort', { duplicate: 'error' }],
  ['setDevServerServer', { duplicate: 'error' }],
  ['enableDevServerHistoryApiFallback', { duplicate: 'error' }],
  ['disableDevServerLiveUpdates', { duplicate: 'error' }],
  ['addAssetQueryRules', { duplicate: 'skip' }],
  ['addBabelLoader', { duplicate: 'error' }],
  ['addStyleLoaders', { duplicate: 'error' }],
  ['addHtmlLoader', { duplicate: 'error' }],
  ['addJsonReferencesLoader', { duplicate: 'repeat' }],
  ['addCopyPlugin', { duplicate: 'repeat' }],
  ['addPublicCopyPlugin', { duplicate: 'error' }],
  ['addCopyFrom', { duplicate: 'repeat' }],
  ['addServiceWorkerRetirement', { duplicate: 'error', operation: 'serviceWorker' }],
  ['addHtmlPlugin', { duplicate: 'repeat' }],
  ['addRobotsPlugin', { duplicate: 'error' }],
  ['addArchivePlugin', { duplicate: 'error' }],
  ['addGzipCompressionPlugin', { duplicate: 'error' }],
  ['addBrotliCompressionPlugin', { duplicate: 'error' }],
  ['addEnvironmentPlugin', { duplicate: 'repeat' }],
  ['addDefinePlugin', { duplicate: 'repeat' }],
  ['setEntries', { duplicate: 'error' }],
  ['addEntries', { duplicate: 'repeat' }],
  ['optimizeChunks', { duplicate: 'error' }],
  ['addTerserMinimizer', { duplicate: 'error' }],
  ['addCssMinimizer', { duplicate: 'error' }],
  ['addHtmlMinimizer', { duplicate: 'error' }],
  ['addJsonMinimizer', { duplicate: 'error' }],
  ['addImageMinimizer', { duplicate: 'error' }],
  ['addWorkboxServiceWorkerPlugin', { duplicate: 'error', operation: 'serviceWorker' }],
  ['addIgnoredWarnings', { duplicate: 'repeat' }],
]);

function explode(value) {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (typeof value === 'object' && value !== null) {
    return { ...value };
  }

  return value;
}

function entryImportsRequest(entry, request) {
  if (typeof entry === 'string') {
    return entry === request;
  }

  if (Array.isArray(entry)) {
    return entry.some((item) => entryImportsRequest(item, request));
  }

  return typeof entry === 'object' && entry !== null && Object.hasOwn(entry, 'import') && entryImportsRequest(entry.import, request);
}

function assertServiceWorkerRetirementEntries(entries) {
  if (typeof entries === 'object' && entries !== null && Object.values(entries).some((entry) => entryImportsRequest(entry, serviceWorkerRegistrationEntry))) {
    throw new Error(`Service Worker retirement builds must not include the "${serviceWorkerRegistrationEntry}" entry because it would register the retirement worker again.`);
  }
}

function hasQueryFlag(resourceQuery, name) {
  return new URLSearchParams(resourceQuery).get(name) === '';
}

function assertOutputPathSegment(value, name) {
  if (typeof value !== 'string' || value === '.' || value === '..' || !/^[a-z0-9][a-z0-9._-]*$/iu.test(value)) {
    throw new TypeError(`${name} must be a non-empty path segment containing only letters, numbers, dots, underscores, and hyphens.`);
  }

  return value;
}

function assertWebpackMode(value) {
  if (!webpackModes.has(value)) {
    throw new TypeError('Webpack mode must be "development", "none", or "production".');
  }

  return value;
}

function assertEcmaVersion(value) {
  if (!supportedEcmaVersions.has(value)) {
    throw new TypeError('ECMAScript version must be 5 or a year from 2015 through 2025.');
  }

  return value;
}

function parseBoolean(value, name) {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  throw new TypeError(`${name} must be true or false.`);
}

export function normalizePublicUrl(value) {
  const message = 'Public URL must be an absolute HTTPS URL without credentials, query, or fragment and must end with "/".';

  if (typeof value !== 'string' || !value.endsWith('/')) {
    throw new TypeError(message);
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError(message);
  }

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new TypeError(message);
  }

  return url.href;
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function createHtmlVariablesPreprocessor(variables, preprocessor) {
  if (variables === undefined) {
    return preprocessor;
  }

  if (variables === null || typeof variables !== 'object' || Array.isArray(variables)) {
    throw new TypeError('HTML variables must be an object.');
  }

  const normalizedVariables = new Map();

  for (const [name, value] of Object.entries(variables)) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) {
      throw new TypeError(`Invalid HTML variable name: ${name}.`);
    }

    if (typeof value !== 'string') {
      throw new TypeError(`HTML variable ${name} must be a string.`);
    }

    normalizedVariables.set(name, escapeHtml(value));
  }

  return async (content, loaderContext) => {
    const processedContent = preprocessor === undefined ? content : await preprocessor(content, loaderContext);

    return processedContent.replace(/\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/gu, (_token, name) => {
      if (!normalizedVariables.has(name)) {
        throw new TypeError(`Unknown HTML variable: ${name}.`);
      }

      return normalizedVariables.get(name);
    });
  };
}

function createDefaultHtmlSources() {
  const socialImageProperties = new Set(['og:image', 'og:image:secure_url', 'og:image:url']);

  return {
    list: [
      '...',
      {
        attribute: 'content',
        filter: (_tag, _attribute, attributes) => {
          const property = attributes.find(({ name }) => name.toLowerCase() === 'property')?.value.toLowerCase();
          const name = attributes.find((attribute) => attribute.name.toLowerCase() === 'name')?.value.toLowerCase();

          return socialImageProperties.has(property) || name === 'twitter:image';
        },
        tag: 'meta',
        type: 'src',
      },
    ],
  };
}

const assetResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'asset');
const inlineResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'inline');
const linkResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'link');
const resourceResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'resource');
const sheetResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'sheet');
const sourceResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'source');
const styleResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'style');
const textResourceQuery = (resourceQuery) => hasQueryFlag(resourceQuery, 'text');

export class WebpackConfigBuilder {
  #appliedMethods;
  #env;
  #argv;
  #config;
  #ecmaVersion;
  #jsonReferencesLoaderIndex;
  #serviceWorkerRetirement;

  constructor({ ecmaVersion, env = {}, argv = {} } = {}) {
    this.#appliedMethods = new Set();
    this.#env = { ...env };
    this.#argv = { ...argv };
    this.#ecmaVersion = assertEcmaVersion(ecmaVersion);
    this.#jsonReferencesLoaderIndex = 0;
    this.#serviceWorkerRetirement = false;

    this.#config = {
      mode: this.webpackMode,
      target: 'browserslist',
      output: {
        filename: 'immutable.[contenthash].js',
        chunkFilename: 'immutable.[contenthash].js',
        assetModuleFilename: 'immutable.[contenthash][ext][query][fragment]',
        clean: true,
        path: resolve('build', assertWebpackMode(this.webpackMode), assertOutputPathSegment(this.appEnv, 'Application environment')),
        publicPath: 'auto',
      },
      devtool: this.isProduction ? false : 'source-map',
      performance: {
        hints: false,
      },
      devServer: {
        client: {},
        host: '0.0.0.0',
        port: 3000,
        headers: {
          'Cache-Control': 'max-age=0, no-store',
        },
        hot: false,
        liveReload: true,
        webSocketServer: 'ws',
      },
      experiments: {
        css: true,
      },
      resolve: {
        extensions: ['.tsx', '.mts', '.ts', '.cts', '.jsx', '.mjs', '.cjs', '...'],
      },
      plugins: [],
      module: {
        rules: [],
      },
      optimization: {
        removeAvailableModules: this.isProduction,
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

  get isProduction() {
    return this.webpackMode === 'production';
  }

  get isProductionBuild() {
    return this.webpackBuild === true && this.isProduction;
  }

  get nodeEnv() {
    return this.#argv.nodeEnv ?? process.env.NODE_ENV ?? this.webpackMode;
  }

  get appEnv() {
    return this.#env.APP_ENV ?? process.env.APP_ENV ?? this.webpackMode;
  }

  get appIndexable() {
    return parseBoolean(this.#env.APP_INDEXABLE ?? process.env.APP_INDEXABLE ?? false, 'APP_INDEXABLE');
  }

  get appName() {
    return this.#env.APP_NAME ?? process.env.APP_NAME ?? process.env.npm_package_name ?? 'app';
  }

  get appVersion() {
    return this.#env.APP_VERSION || process.env.APP_VERSION || process.env.npm_package_version || '0.0.0';
  }

  #runMethod(method, callback) {
    const policy = methodPolicies.get(method);

    if (policy === undefined) {
      throw new TypeError(`Missing call policy for ${method}().`);
    }

    const operation = policy.operation ?? method;

    if (this.#appliedMethods.has(operation)) {
      if (policy.duplicate === 'skip') {
        return this;
      }

      if (policy.duplicate === 'error') {
        throw new Error(`${method}() cannot be called more than once.`);
      }
    }

    const result = callback();
    this.#appliedMethods.add(operation);

    return result;
  }

  #replaceConfig(config, method) {
    return this.#runMethod(method, () => {
      this.#config = { ...config };

      return this;
    });
  }

  #setCssExperiment(enabled, method) {
    return this.#replaceConfig(
      {
        ...this.#config,
        experiments: {
          ...this.#config.experiments,
          css: enabled,
        },
      },
      method,
    );
  }

  #setPublicPath(publicPath, method) {
    return this.#replaceConfig(
      {
        ...this.#config,
        output: {
          ...this.#config.output,
          publicPath,
        },
      },
      method,
    );
  }

  enableCssExperiment() {
    return this.#setCssExperiment(true, 'enableCssExperiment');
  }

  disableCssExperiment() {
    return this.#setCssExperiment(false, 'disableCssExperiment');
  }

  setContext(context) {
    return this.#replaceConfig(
      {
        ...this.#config,
        context,
      },
      'setContext',
    );
  }

  setDevtool(devtool) {
    return this.#replaceConfig(
      {
        ...this.#config,
        devtool,
      },
      'setDevtool',
    );
  }

  setPublicPath(publicPath) {
    return this.#setPublicPath(publicPath, 'setPublicPath');
  }

  setPublicUrl(publicUrl) {
    return this.#setPublicPath(normalizePublicUrl(publicUrl), 'setPublicUrl');
  }

  setTarget(target) {
    return this.#replaceConfig(
      {
        ...this.#config,
        target: explode(target),
      },
      'setTarget',
    );
  }

  setOutputPath(path = resolve('build', assertWebpackMode(this.webpackMode), assertOutputPathSegment(this.appEnv, 'Application environment'))) {
    return this.#replaceConfig(
      {
        ...this.#config,
        output: {
          ...this.#config.output,
          path: path instanceof URL ? fileURLToPath(path) : path,
        },
      },
      'setOutputPath',
    );
  }

  setDevServerPort(port) {
    return this.#replaceConfig(
      {
        ...this.#config,
        devServer: {
          ...this.#config.devServer,
          port,
        },
      },
      'setDevServerPort',
    );
  }

  setDevServerServer(server) {
    return this.#replaceConfig(
      {
        ...this.#config,
        devServer: {
          ...this.#config.devServer,
          server,
        },
      },
      'setDevServerServer',
    );
  }

  enableDevServerHistoryApiFallback(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        devServer: {
          ...this.#config.devServer,
          historyApiFallback: { ...options },
        },
      },
      'enableDevServerHistoryApiFallback',
    );
  }

  disableDevServerLiveUpdates() {
    return this.#replaceConfig(
      {
        ...this.#config,
        devServer: {
          ...this.#config.devServer,
          client: false,
          hot: false,
          liveReload: false,
          webSocketServer: false,
        },
      },
      'disableDevServerLiveUpdates',
    );
  }

  addAssetQueryRules() {
    return this.#replaceConfig(
      {
        ...this.#config,
        module: {
          ...this.#config.module,
          rules: [
            ...this.#config.module.rules,
            {
              oneOf: [
                {
                  resourceQuery: sourceResourceQuery,
                  type: 'asset/source',
                },
                {
                  resourceQuery: resourceResourceQuery,
                  type: 'asset/resource',
                },
                {
                  resourceQuery: inlineResourceQuery,
                  type: 'asset/inline',
                },
                {
                  resourceQuery: assetResourceQuery,
                  type: 'asset',
                },
              ],
            },
          ],
        },
      },
      'addAssetQueryRules',
    );
  }

  addBabelLoader({ exclude = [/node_modules[\\/]core-js/, /node_modules[\\/]webpack[\\/]buildin/], ...options } = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        module: {
          ...this.#config.module,
          rules: [
            ...this.#config.module.rules,
            {
              test: /\.(tsx|mts|ts|cts|jsx|mjs|js|cjs)$/i,
              exclude,
              use: [
                {
                  loader: babelLoader,
                  options,
                },
              ],
            },
          ],
        },
      },
      'addBabelLoader',
    );
  }

  addStyleLoaders() {
    const loaders = [
      {
        loader: postcssLoader,
      },
      {
        loader: sassLoader,
      },
    ];

    return this.#replaceConfig(
      {
        ...this.#config,
        module: {
          ...this.#config.module,
          rules: [
            ...this.#config.module.rules,
            {
              test: /\.(sass|scss|css)$/i,
              oneOf: [
                {
                  parser: {
                    exportType: 'link',
                  },
                  resourceQuery: linkResourceQuery,
                  type: 'css/auto',
                  use: loaders,
                },
                {
                  parser: {
                    exportType: 'style',
                  },
                  resourceQuery: styleResourceQuery,
                  type: 'css/auto',
                  use: loaders,
                },
                {
                  parser: {
                    exportType: 'text',
                  },
                  resourceQuery: textResourceQuery,
                  type: 'css/auto',
                  use: loaders,
                },
                {
                  parser: {
                    exportType: 'css-style-sheet',
                  },
                  resourceQuery: sheetResourceQuery,
                  type: 'css/auto',
                  use: loaders,
                },
                {
                  resourceQuery: /^$/,
                  type: 'css/auto',
                  use: loaders,
                },
              ],
            },
          ],
        },
      },
      'addStyleLoaders',
    );
  }

  addHtmlLoader({ preprocessor, sources = createDefaultHtmlSources(), variables, ...options } = {}) {
    const htmlPreprocessor = createHtmlVariablesPreprocessor(variables, preprocessor);

    return this.#replaceConfig(
      {
        ...this.#config,
        module: {
          ...this.#config.module,
          rules: [
            ...this.#config.module.rules,
            {
              test: /\.html$/i,
              resourceQuery: /^$/,
              use: [
                {
                  loader: htmlLoader,
                  options: {
                    ...options,
                    ...(htmlPreprocessor === undefined ? {} : { preprocessor: htmlPreprocessor }),
                    sources,
                  },
                },
              ],
            },
          ],
        },
      },
      'addHtmlLoader',
    );
  }

  addJsonReferencesLoader({ exclude, generator, include, overrides = [], references, referencedAssetGenerator, resolve: resolveOptions = {}, test } = {}) {
    if (test === undefined) {
      throw new TypeError('JSON references loader test is required.');
    }

    const normalizedReferences = normalizeJsonReferences(references);
    const normalizedOverrides = normalizeJsonOverrides(overrides);

    if (typeof resolveOptions !== 'object' || resolveOptions === null || Array.isArray(resolveOptions)) {
      throw new TypeError('JSON references loader resolve option must be an object.');
    }

    for (const [name, value] of [
      ['generator', generator],
      ['referencedAssetGenerator', referencedAssetGenerator],
    ]) {
      if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        throw new TypeError(`JSON references loader ${name} option must be an object.`);
      }
    }

    this.addAssetQueryRules();

    const index = this.#jsonReferencesLoaderIndex;
    const referenceQueryFlag = `__tooling_webpack_json_reference_${index}`;
    const assetQueryFlag = `__tooling_webpack_json_asset_${index}`;
    const hasReferenceQuery = (resourceQuery) => new URLSearchParams(resourceQuery).has(referenceQueryFlag);
    const hasAssetQuery = (resourceQuery) => new URLSearchParams(resourceQuery).has(assetQueryFlag);
    const result = this.#replaceConfig(
      {
        ...this.#config,
        module: {
          ...this.#config.module,
          rules: [
            ...this.#config.module.rules,
            {
              resourceQuery: hasReferenceQuery,
              type: 'javascript/auto',
              use: [
                {
                  loader: jsonReferenceModuleLoader,
                  options: {
                    assetQueryFlag,
                    referenceQueryFlag,
                  },
                },
              ],
            },
            {
              generator: {
                filename: 'immutable.[contenthash][ext][fragment]',
                ...referencedAssetGenerator,
              },
              resourceQuery: hasAssetQuery,
              type: 'asset/resource',
            },
            {
              ...(exclude === undefined ? {} : { exclude }),
              ...(generator === undefined ? {} : { generator: { ...generator } }),
              ...(include === undefined ? {} : { include }),
              resourceQuery: /^$/,
              test,
              type: 'asset/resource',
              use: [
                {
                  loader: jsonReferencesLoader,
                  options: {
                    overrides: normalizedOverrides,
                    referenceQueryFlag,
                    references: normalizedReferences,
                    resolve: { ...resolveOptions },
                  },
                },
              ],
            },
          ],
        },
      },
      'addJsonReferencesLoader',
    );

    this.#jsonReferencesLoaderIndex += 1;

    return result;
  }

  addCopyPlugin(patternsOrOptions) {
    const options = Array.isArray(patternsOrOptions) ? { patterns: patternsOrOptions } : { ...patternsOrOptions };

    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new CopyPlugin({
            ...options,
          }),
        ],
      },
      'addCopyPlugin',
    );
  }

  addPublicCopyPlugin() {
    return this.#runMethod('addPublicCopyPlugin', () =>
      this.addCopyPlugin([
        {
          from: './public',
          to: '.',
        },
      ]),
    );
  }

  addCopyFrom(from) {
    return this.#runMethod('addCopyFrom', () =>
      this.addCopyPlugin([
        {
          from,
          to: '.',
        },
      ]),
    );
  }

  addServiceWorkerRetirement() {
    return this.#runMethod('addServiceWorkerRetirement', () => {
      assertServiceWorkerRetirementEntries(this.#config.entry);
      const result = this.addCopyPlugin([
        {
          from: serviceWorkerRetirementSource,
          to: 'sw.js',
        },
      ]);

      this.#serviceWorkerRetirement = true;

      return result;
    });
  }

  addHtmlPlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new HtmlWebpackPlugin({
            filename: 'index.html',
            xhtml: true,
            inject: true,
            chunks: 'all',
            ...options,
          }),
        ],
      },
      'addHtmlPlugin',
    );
  }

  addRobotsPlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [...this.#config.plugins, new RobotsPlugin(options)],
      },
      'addRobotsPlugin',
    );
  }

  addArchivePlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [...this.#config.plugins, new ArchivePlugin(options)],
      },
      'addArchivePlugin',
    );
  }

  addGzipCompressionPlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new CompressionPlugin({
            algorithm: 'gzip',
            compressionOptions: { level: 9, memLevel: 9 },
            filename: '[path][base].gz[query][fragment]',
            minRatio: 1 - Number.EPSILON,
            test: [...defaultCompressionTests],
            threshold: 0,
            ...options,
          }),
        ],
      },
      'addGzipCompressionPlugin',
    );
  }

  addBrotliCompressionPlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new CompressionPlugin({
            algorithm: 'brotliCompress',
            compressionOptions: {
              [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            },
            filename: '[path][base].br[query][fragment]',
            minRatio: 1 - Number.EPSILON,
            test: [...defaultCompressionTests],
            threshold: 0,
            ...options,
          }),
        ],
      },
      'addBrotliCompressionPlugin',
    );
  }

  addEnvironmentPlugin(options) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [...this.#config.plugins, new webpack.EnvironmentPlugin(explode(options))],
      },
      'addEnvironmentPlugin',
    );
  }

  addDefinePlugin(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [...this.#config.plugins, new webpack.DefinePlugin(options)],
      },
      'addDefinePlugin',
    );
  }

  setEntries(entries = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        entry: { ...entries },
      },
      'setEntries',
    );
  }

  addEntries(entries = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        entry: {
          ...this.#config.entry,
          ...entries,
        },
      },
      'addEntries',
    );
  }

  optimizeChunks({ runtimeChunk = 'single', splitChunks = { chunks: 'all' } } = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        optimization: {
          ...this.#config.optimization,
          runtimeChunk: explode(runtimeChunk),
          splitChunks: explode(splitChunks),
        },
      },
      'optimizeChunks',
    );
  }

  addTerserMinimizer(configuration = {}) {
    const { minimizerOptions = {}, ...options } = configuration;

    const defaultCompressOptions = {
      drop_console: true,
      drop_debugger: true,
      passes: 5,
    };

    const defaultFormatOptions = {
      comments: false,
    };

    const resolvedMinimizerOptions = {
      ...minimizerOptions,
      ecma: this.#ecmaVersion,
      compress:
        minimizerOptions.compress === false
          ? false
          : {
              ...defaultCompressOptions,
              ...minimizerOptions.compress,
            },
      format:
        minimizerOptions.format === null
          ? null
          : {
              ...defaultFormatOptions,
              ...minimizerOptions.format,
            },
    };

    const minimizer = new TerserPlugin({
      extractComments: false,
      ...options,
      minimizerOptions: resolvedMinimizerOptions,
    });

    return this.#replaceConfig(
      {
        ...this.#config,
        optimization: {
          ...this.#config.optimization,
          minimizer: [...(this.#config.optimization.minimizer ?? []), minimizer],
        },
      },
      'addTerserMinimizer',
    );
  }

  addCssMinimizer(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        optimization: {
          ...this.#config.optimization,
          minimizer: [...(this.#config.optimization.minimizer ?? []), new CssMinimizerPlugin(options)],
        },
      },
      'addCssMinimizer',
    );
  }

  addHtmlMinimizer(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        optimization: {
          ...this.#config.optimization,
          minimizer: [...(this.#config.optimization.minimizer ?? []), new HtmlMinimizerPlugin(options)],
        },
      },
      'addHtmlMinimizer',
    );
  }

  addJsonMinimizer(options = {}) {
    return this.#replaceConfig(
      {
        ...this.#config,
        optimization: {
          ...this.#config.optimization,
          minimizer: [...(this.#config.optimization.minimizer ?? []), new JsonMinimizerPlugin(options)],
        },
      },
      'addJsonMinimizer',
    );
  }

  addImageMinimizer(options = {}) {
    this.addAssetQueryRules();

    const pluginOptions = {
      generator: [
        {
          preset: 'avif',
          type: 'import',
          implementation: safeSharpGenerate,
          options: {
            rotate: 'auto',
            resize: {
              fastShrinkOnLoad: false,
              fit: 'inside',
              withoutEnlargement: true,
            },
            encodeOptions: {
              avif: {
                quality: 80,
                lossless: false,
                effort: 9,
                chromaSubsampling: '4:4:4',
                bitdepth: 8,
                tune: 'ssim',
              },
            },
          },
        },
        {
          preset: 'webp',
          type: 'import',
          implementation: safeSharpGenerate,
          options: {
            rotate: 'auto',
            resize: {
              fastShrinkOnLoad: false,
              fit: 'inside',
              withoutEnlargement: true,
            },
            encodeOptions: {
              webp: {
                quality: 90,
                alphaQuality: 100,
                nearLossless: true,
                effort: 6,
                exact: true,
              },
            },
          },
        },
        {
          preset: 'png',
          type: 'import',
          implementation: safeSharpGenerate,
          options: {
            rotate: 'auto',
            resize: {
              fastShrinkOnLoad: false,
              fit: 'inside',
              withoutEnlargement: true,
            },
            encodeOptions: {
              png: {
                progressive: false,
                compressionLevel: 9,
                adaptiveFiltering: true,
                palette: false,
              },
            },
          },
        },
        {
          preset: 'jpg',
          type: 'import',
          implementation: safeSharpGenerate,
          options: {
            rotate: 'auto',
            resize: {
              fastShrinkOnLoad: false,
              fit: 'inside',
              withoutEnlargement: true,
            },
            encodeOptions: {
              jpg: {
                quality: 95,
                chromaSubsampling: '4:4:4',
                mozjpeg: true,
              },
            },
          },
        },
        {
          preset: 'jpeg',
          type: 'import',
          implementation: safeSharpGenerate,
          options: {
            rotate: 'auto',
            resize: {
              fastShrinkOnLoad: false,
              fit: 'inside',
              withoutEnlargement: true,
            },
            encodeOptions: {
              jpeg: {
                quality: 95,
                chromaSubsampling: '4:4:4',
                mozjpeg: true,
              },
            },
          },
        },
      ],
      ...options,
    };
    const { generator, minimizer, ...sharedOptions } = pluginOptions;
    const resolvedMinimizer = this.isProduction ? minimizer : undefined;

    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new ImageMinimizerPlugin({
            ...sharedOptions,
            generator,
            minimizer: resolvedMinimizer,
          }),
        ],
      },
      'addImageMinimizer',
    );
  }

  addWorkboxServiceWorkerPlugin(options = {}) {
    const resolvedOptions = { ...options };

    if (resolvedOptions.include === undefined) {
      resolvedOptions.include = [...defaultWorkboxInclude];
    }

    return this.#replaceConfig(
      {
        ...this.#config,
        plugins: [
          ...this.#config.plugins,
          new WorkboxPlugin.GenerateSW({
            cleanupOutdatedCaches: true,
            sourcemap: false,
            swDest: 'sw.js',
            ...resolvedOptions,
          }),
        ],
      },
      'addWorkboxServiceWorkerPlugin',
    );
  }

  addIgnoredWarnings(warnings) {
    return this.#replaceConfig(
      {
        ...this.#config,
        ignoreWarnings: [...(this.#config.ignoreWarnings ?? []), ...warnings],
      },
      'addIgnoredWarnings',
    );
  }

  toConfig() {
    if (this.#serviceWorkerRetirement) {
      assertServiceWorkerRetirementEntries(this.#config.entry);
    }

    const config = {
      ...this.#config,
      output: { ...this.#config.output },
      devServer: {
        ...this.#config.devServer,
        client: this.#config.devServer.client === false ? false : { ...this.#config.devServer.client },
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

    if (this.#config.optimization.runtimeChunk !== undefined) {
      config.optimization.runtimeChunk = explode(this.#config.optimization.runtimeChunk);
    }

    if (this.#config.optimization.splitChunks !== undefined) {
      config.optimization.splitChunks = explode(this.#config.optimization.splitChunks);
    }

    if (this.#config.ignoreWarnings !== undefined) {
      config.ignoreWarnings = [...this.#config.ignoreWarnings];
    }

    if (Array.isArray(this.#config.target)) {
      config.target = [...this.#config.target];
    }

    if (typeof this.#config.devServer.historyApiFallback === 'object') {
      config.devServer.historyApiFallback = {
        ...this.#config.devServer.historyApiFallback,
      };
    }

    return config;
  }
}
