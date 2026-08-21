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
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import createMpaConfig from '../scaffolds/browser_mpa.js';
import createReactSpaConfig from '../scaffolds/browser_react_spa.js';
import createSpaConfig from '../scaffolds/browser_spa.js';

function createEnvironmentConfigs(createConfig) {
  const development = createConfig(
    {
      APP_ENV: 'development',
      APP_NAME: 'Example application',
      APP_URL: 'https://development.example.com/',
      APP_VERSION: '2.0.0',
    },
    { mode: 'development' },
  );

  const production = createConfig(
    {
      APP_ENV: 'production',
      APP_NAME: 'Example application',
      APP_URL: 'https://example.com/',
      APP_VERSION: '2.0.0',
    },
    { mode: 'production' },
  );

  const productionPreview = createConfig(
    {
      APP_ENV: 'preview',
      APP_NAME: 'Example application',
      APP_URL: 'https://preview.example.com/',
      APP_VERSION: '2.0.0',
    },
    { mode: 'production' },
  );

  return { development, production, productionPreview };
}

function pluginNames(config) {
  return config.plugins.map(({ constructor }) => constructor.name);
}

test('browser SPA scaffold keeps development and production behavior explicit', () => {
  const { development, production, productionPreview } = createEnvironmentConfigs(createSpaConfig);

  assert.deepEqual(development.entry, {
    index: ['./src/index.ts'],
  });
  assert.deepEqual(production.entry, {
    index: ['./src/service_worker_registration.ts', './src/index.ts'],
  });
  assert.deepEqual(productionPreview.entry, {
    index: ['./src/index.ts'],
  });
  assert.deepEqual(pluginNames(development), ['DefinePlugin', 'HtmlWebpackPlugin', 'ImageMinimizerPlugin']);
  assert.deepEqual(pluginNames(production), ['DefinePlugin', 'HtmlWebpackPlugin', 'ImageMinimizerPlugin', 'CompressionPlugin', 'CompressionPlugin', 'GenerateSW', 'ArchivePlugin']);
  assert.deepEqual(pluginNames(productionPreview), ['DefinePlugin', 'HtmlWebpackPlugin', 'ImageMinimizerPlugin']);
  assert.equal(development.plugins[2].options.minimizer, undefined);
  assert.equal(production.plugins[2].options.minimizer, undefined);
  assert.equal(productionPreview.plugins[2].options.minimizer, undefined);
  assert.equal(development.optimization.runtimeChunk, 'single');
  assert.deepEqual(development.optimization.splitChunks, { chunks: 'all' });

  assert.equal(development.plugins[1].options.template, './src/index.html');

  const workbox = production.plugins.at(-2);
  const [navigateFallbackDenylist] = workbox.config.navigateFallbackDenylist;

  assert.equal(workbox.config.navigateFallback, 'index.html');
  assert.equal(workbox.config.clientsClaim, true);
  assert.equal(workbox.config.skipWaiting, true);
  assert.match('/immutable.1234.png', navigateFallbackDenylist);
  assert.match('/immutable.1234.png?width=640', navigateFallbackDenylist);
  assert.doesNotMatch('/products/123', navigateFallbackDenylist);
  assert.doesNotMatch('/products/123?query=document.pdf', navigateFallbackDenylist);
  assert.equal(development.devtool, 'source-map');
  assert.equal(production.devtool, false);
  assert.equal(productionPreview.devtool, false);
  assert.equal(development.output.publicPath, '/');
  assert.equal(production.output.publicPath, 'https://example.com/');
  assert.equal(productionPreview.output.publicPath, 'https://preview.example.com/');
  assert.deepEqual(development.devServer.historyApiFallback, {});
  assert.deepEqual(production.devServer.historyApiFallback, {});
  assert.deepEqual(productionPreview.devServer.historyApiFallback, {});
});

test('React SPA scaffold uses a TSX entry', () => {
  const { development, production, productionPreview } = createEnvironmentConfigs(createReactSpaConfig);

  assert.deepEqual(development.entry, {
    index: ['./src/index.tsx'],
  });
  assert.deepEqual(production.entry, {
    index: ['./src/service_worker_registration.ts', './src/index.tsx'],
  });
  assert.deepEqual(productionPreview.entry, {
    index: ['./src/index.tsx'],
  });
});

test('browser MPA scaffold emits an HTML document per entry without an SPA fallback', () => {
  const { development, production, productionPreview } = createEnvironmentConfigs(createMpaConfig);

  assert.deepEqual(development.entry, {
    admin: ['./src/admin.ts'],
    index: ['./src/index.ts'],
  });
  assert.deepEqual(production.entry, {
    admin: ['./src/service_worker_registration.ts', './src/admin.ts'],
    index: ['./src/service_worker_registration.ts', './src/index.ts'],
  });
  assert.deepEqual(productionPreview.entry, {
    admin: ['./src/admin.ts'],
    index: ['./src/index.ts'],
  });
  assert.deepEqual(pluginNames(development), ['DefinePlugin', 'HtmlWebpackPlugin', 'HtmlWebpackPlugin', 'ImageMinimizerPlugin']);
  assert.deepEqual(pluginNames(production), [
    'DefinePlugin',
    'HtmlWebpackPlugin',
    'HtmlWebpackPlugin',
    'ImageMinimizerPlugin',
    'CompressionPlugin',
    'CompressionPlugin',
    'GenerateSW',
    'ArchivePlugin',
  ]);
  assert.deepEqual(pluginNames(productionPreview), ['DefinePlugin', 'HtmlWebpackPlugin', 'HtmlWebpackPlugin', 'ImageMinimizerPlugin']);

  const htmlPlugins = development.plugins.filter(({ constructor }) => constructor.name === 'HtmlWebpackPlugin');

  assert.deepEqual(
    htmlPlugins.map(({ options }) => ({
      chunks: options.chunks,
      filename: options.filename,
      template: options.template,
    })),
    [
      {
        chunks: ['index'],
        filename: 'index.html',
        template: './src/index.html',
      },
      {
        chunks: ['admin'],
        filename: 'admin/index.html',
        template: './src/index.html',
      },
    ],
  );
  assert.equal(development.plugins[3].options.minimizer, undefined);
  assert.equal(production.plugins[3].options.minimizer, undefined);
  assert.equal(productionPreview.plugins[3].options.minimizer, undefined);
  assert.equal(development.output.publicPath, '/');
  assert.equal(production.output.publicPath, 'https://example.com/');
  assert.equal(productionPreview.output.publicPath, 'https://preview.example.com/');
  assert.equal(development.optimization.runtimeChunk, 'single');
  assert.deepEqual(development.optimization.splitChunks, { chunks: 'all' });

  const workbox = production.plugins.at(-2);

  assert.equal(workbox.config.navigateFallback, undefined);
  assert.equal(workbox.config.navigateFallbackDenylist, undefined);
  assert.equal(workbox.config.clientsClaim, true);
  assert.equal(workbox.config.skipWaiting, true);
  assert.equal(development.devServer.historyApiFallback, undefined);
  assert.equal(production.devServer.historyApiFallback, undefined);
  assert.equal(productionPreview.devServer.historyApiFallback, undefined);
});

test('provides generic standard, PWA, and service worker scaffolds', async () => {
  const [indexHtml, pwaHtml, manifestSource, registrationSource] = await Promise.all([
    readFile(new URL('../scaffolds/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../scaffolds/pwa.html', import.meta.url), 'utf8'),
    readFile(new URL('../scaffolds/manifest.webmanifest', import.meta.url), 'utf8'),
    readFile(new URL('../scaffolds/service_worker_registration.ts', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource);

  for (const scaffold of [indexHtml, pwaHtml]) {
    assert.match(scaffold, /^<!doctype html>/u);
    assert.match(scaffold, /<html lang="en">/u);
    assert.match(scaffold, /<meta charset="utf-8" \/>/u);
    assert.match(scaffold, /content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/u);
    assert.doesNotMatch(scaffold, /tomaschochola|tooling-webpack|template-react|template-web-components/u);
  }

  assert.match(indexHtml, /<title><\/title>/u);
  assert.match(pwaHtml, /name="application-name"/u);
  assert.match(pwaHtml, /property="og:type"/u);
  assert.match(pwaHtml, /name="twitter:card"/u);
  assert.match(pwaHtml, /content="\.\.\/build\/open-graph\/open-graph\.png"/u);
  assert.match(pwaHtml, /href="\.\/manifest\.webmanifest"/u);
  assert.match(pwaHtml, /href="\.\.\/build\/favicons\/favicon\.ico"/u);
  assert.match(pwaHtml, /href="\.\.\/build\/favicons\/favicon\.svg"/u);
  assert.match(pwaHtml, /type="application\/ld\+json"/u);
  assert.ok(manifest.icons.every(({ src }) => src.startsWith('../build/favicons/')));
  assert.equal(manifest.name, 'Application');
  assert.match(registrationSource, /registerServiceWorker/u);
  assert.doesNotMatch(registrationSource, /enabled|process\.env/u);
  assert.doesNotMatch(manifestSource, /tomaschochola|tooling-webpack|template-react|template-web-components/u);
});
