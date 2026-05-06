import { WebpackConfigBuilder } from '@tomaschochola/tooling-webpack';

// eslint-disable-next-line no-restricted-exports
export default function (env, argv) {
  let tooling = new WebpackConfigBuilder({ env, argv });

  tooling = tooling
    .setEntries({
      index: ['./src/index.ts'],
    })
    .addBabelLoader()
    .addStyleLoaders()
    .addHtmlLoader()
    .addAssetQueryRules()
    .addEnvironmentPlugin({
      WEBPACK_MODE: tooling.webpackMode,
      WEBPACK_BUILD: tooling.webpackBuild,
      WEBPACK_SERVE: tooling.webpackServe,
      WEBPACK_WATCH: tooling.webpackWatch,
      NODE_ENV: tooling.nodeEnv,
      APP_ENV: tooling.appEnv,
      APP_NAME: tooling.appName,
      APP_VERSION: tooling.appVersion,
    })
    .addDefinePlugin()
    .addHtmlPlugin()
    .addPublicCopyPlugin()
    .addTerserMinimizer()
    .addCssMinimizer()
    .addHtmlMinimizer()
    .addJsonMinimizer()
    .addImageMinimizer();

  if (tooling.isProductionMode) {
    tooling = tooling
      .addGzipCompressionPlugin()
      .addBrotliCompressionPlugin()
      .addWorkboxServiceWorkerPlugin();
  }

  return tooling.toConfig();
}
