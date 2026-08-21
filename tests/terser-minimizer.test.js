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
import { test } from 'node:test';

import { WebpackConfigBuilder } from '../src/index.js';

function createTerserPlugin(options, ecmaVersion = 2025) {
  const config = new WebpackConfigBuilder({ ecmaVersion }).addTerserMinimizer(options).toConfig();

  return config.optimization.minimizer[0];
}

test('uses the required ECMAScript output version', () => {
  const plugin = createTerserPlugin();

  assert.deepEqual(plugin.options.minimizer.options, {
    ecma: 2025,
    compress: {
      drop_console: true,
      drop_debugger: true,
      passes: 5,
    },
    format: {
      comments: false,
    },
  });
});

test('merges custom minimizer options with the production defaults', () => {
  const plugin = createTerserPlugin(
    {
      extractComments: true,
      minimizerOptions: {
        ecma: 2015,
        compress: {
          drop_console: false,
          passes: 2,
        },
        format: {
          ascii_only: true,
        },
      },
    },
    2024,
  );

  assert.equal(plugin.options.extractComments, true);
  assert.deepEqual(plugin.options.minimizer.options, {
    ecma: 2024,
    compress: {
      drop_console: false,
      drop_debugger: true,
      passes: 2,
    },
    format: {
      ascii_only: true,
      comments: false,
    },
  });
});
