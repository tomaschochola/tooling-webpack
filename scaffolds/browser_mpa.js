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

const pages = [
  {
    entry: ['./src/index.ts'],
    filename: 'index.html',
    name: 'index',
    template: './src/index.html',
  },
  {
    entry: ['./src/admin.ts'],
    filename: 'admin/index.html',
    name: 'admin',
    template: './src/admin.html',
  },
];

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

  const isProductionBuild = tooling.isProductionBuild;

  tooling = isProductionBuild ? tooling.setPublicUrl(publicUrl) : tooling.setPublicPath('/');

  tooling = tooling
    .optimizeChunks()
    .setEntries(Object.fromEntries(pages.map(({ entry, name }) => [name, [...(isProductionBuild ? ['@tomaschochola/tooling-webpack/register-service-worker'] : []), ...entry]])))
    .addBrowserLoaders({
      html: {
        variables: {
          PUBLIC_URL: publicUrl,
        },
      },
    })
    .addWebManifestLoader()
    .addDefinePlugin({
      'process.env.APP_ENV': JSON.stringify(appEnv),
      'process.env.APP_NAME': JSON.stringify(appName),
      'process.env.APP_VERSION': JSON.stringify(appVersion),
    });

  for (const { filename, name, template } of pages) {
    tooling = tooling.addHtmlPlugin({
      chunks: [name],
      filename,
      template,
    });
  }

  tooling = tooling
    .addRobotsPlugin()
    .optimizeAssets();

  if (isProductionBuild) {
    tooling = tooling
      .precompressAssets()
      .addWorkboxServiceWorkerPlugin({
        clientsClaim: true,
        skipWaiting: true,
      })
      .addArchivePlugin();
  }

  return tooling.toConfig();
}
