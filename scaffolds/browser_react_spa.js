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

import { normalizePublicUrl, WebpackConfigBuilder } from '@tomaschochola/tooling-webpack';

export default function (env = {}, argv = {}) {
  let tooling = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    env,
    argv,
  });

  const appEnv = tooling.appEnv;
  const appName = tooling.appName;
  const appVersion = tooling.appVersion;
  const publicUrl = normalizePublicUrl(env.APP_URL);

  const isProduction = tooling.isProduction;

  tooling = isProduction ? tooling.setPublicUrl(publicUrl) : tooling.setPublicPath('/');

  tooling = tooling
    .setDevtool(isProduction ? false : 'source-map')
    .enableDevServerHistoryApiFallback()
    .optimizeChunks()
    .setEntries({
      index: [...(isProduction ? ['@tomaschochola/tooling-webpack/register-service-worker'] : []), './src/index.tsx'],
    })
    .addBabelLoader()
    .addStyleLoaders()
    .addHtmlLoader({
      variables: {
        PUBLIC_URL: publicUrl,
      },
    })
    .addJsonReferencesLoader({
      generator: {
        filename: 'manifest.webmanifest',
      },
      references: [
        { path: ['icons', '*', 'src'] },
        { path: ['screenshots', '*', 'src'], required: false },
        { path: ['shortcuts', '*', 'icons', '*', 'src'], required: false },
        { path: ['file_handlers', '*', 'icons', '*', 'src'], required: false },
      ],
      test: /\.webmanifest$/i,
    })
    .addAssetQueryRules()
    .addDefinePlugin({
      'process.env.APP_ENV': JSON.stringify(appEnv),
      'process.env.APP_NAME': JSON.stringify(appName),
      'process.env.APP_VERSION': JSON.stringify(appVersion),
    })
    .addHtmlPlugin({
      template: './src/index.html',
    })
    .addTerserMinimizer()
    .addCssMinimizer()
    .addHtmlMinimizer()
    .addJsonMinimizer()
    .addImageMinimizer();

  if (isProduction) {
    tooling = tooling
      .addGzipCompressionPlugin()
      .addBrotliCompressionPlugin()
      .addWorkboxServiceWorkerPlugin({
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/[^?]*\.[a-z0-9]{1,16}(?:\?[^/]*)?$/i],
        skipWaiting: true,
      })
      .addArchivePlugin();
  }

  return tooling.toConfig();
}
