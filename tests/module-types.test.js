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

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const moduleDeclarations = await readFile(new URL('../types/modules.d.ts', import.meta.url), 'utf8');

test('publishes the Webpack module declarations through a type-only export', () => {
    assert.deepEqual(packageJson.exports['./modules'], {
        types: './types/modules.d.ts',
    });
    assert.ok(packageJson.files.includes('types'));
});

test('requires an explicit final image generator output type', () => {
    for (const outputType of ['asset', 'inline', 'resource', 'source']) {
        assert.match(moduleDeclarations, new RegExp(`declare module '\\*\\?${outputType}'`, 'u'));
        assert.match(moduleDeclarations, new RegExp(`declare module '\\*&${outputType}'`, 'u'));
    }

    assert.doesNotMatch(moduleDeclarations, /declare module '\\*[?&]as=/u);
});
