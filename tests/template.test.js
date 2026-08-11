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
import test from 'node:test';
import createConfig from '../templates/browser_typescript_babel_react.js';

test('copy template keeps development and production behavior explicit', () => {
  const development = createConfig(
    {
      APP_ENV: 'development',
      APP_NAME: 'Example application',
      APP_VERSION: '2.0.0',
    },
    { mode: 'development' },
  );

  const production = createConfig(
    {
      APP_ENV: 'production',
      APP_NAME: 'Example application',
      APP_VERSION: '2.0.0',
    },
    { mode: 'production' },
  );

  assert.deepEqual(development.entry, {
    index: ['./src/index.ts'],
  });
  assert.deepEqual(
    development.plugins.map(({ constructor }) => constructor.name),
    ['DefinePlugin', 'HtmlWebpackPlugin', 'CopyPlugin'],
  );
  assert.deepEqual(
    production.plugins.map(({ constructor }) => constructor.name),
    ['DefinePlugin', 'HtmlWebpackPlugin', 'CopyPlugin', 'CompressionPlugin', 'CompressionPlugin', 'GenerateSW'],
  );
  assert.equal(development.devtool, 'source-map');
  assert.equal(production.devtool, 'hidden-source-map');
});
