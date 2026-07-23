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
import { fileURLToPath, pathToFileURL } from 'node:url';

import { WebpackConfigBuilder } from '../src/index.js';

test('uses the application environment in the default output path', () => {
  const config = new WebpackConfigBuilder({
    env: {
      APP_ENV: 'development',
    },
  }).toConfig();

  const expectedPath = fileURLToPath(new URL('./dist/development/', pathToFileURL(`${process.cwd()}/`)));

  assert.equal(config.output.path, expectedPath);
});
