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
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const generateIcons = fileURLToPath(new URL('../src/generate-icons.js', import.meta.url));
const renderIcon = fileURLToPath(new URL('../src/render-icon.js', import.meta.url));

test('keeps the generate-icons compatibility executable', async () => {
  await assert.rejects(
    async () => await execute(generateIcons),
    {
      code: 2,
      stderr: /Usage: generate-icons SOURCE OUTPUT_DIRECTORY STYLE BACKGROUND/u,
    },
  );
});

test('keeps the render-icon compatibility executable', async () => {
  await assert.rejects(
    async () => await execute(renderIcon),
    {
      code: 2,
      stderr: /Usage: render-icon SOURCE OUTPUT CANVAS_SIZE CONTENT_SIZE BACKGROUND/u,
    },
  );
});
