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
import createMpaInstallableConfig from '../scaffolds/browser_mpa_installable.js';
import createMpaOfflineConfig from '../scaffolds/browser_mpa_offline.js';
import createMpaOfflineImmediateConfig from '../scaffolds/browser_mpa_offline_immediate.js';
import createReactSpaConfig from '../scaffolds/browser_react_spa.js';
import createReactSpaInstallableConfig from '../scaffolds/browser_react_spa_installable.js';
import createReactSpaOfflineConfig from '../scaffolds/browser_react_spa_offline.js';
import createReactSpaOfflineImmediateConfig from '../scaffolds/browser_react_spa_offline_immediate.js';
import createSpaConfig from '../scaffolds/browser_spa.js';
import createSpaInstallableConfig from '../scaffolds/browser_spa_installable.js';
import createSpaOfflineConfig from '../scaffolds/browser_spa_offline.js';
import createSpaOfflineImmediateConfig from '../scaffolds/browser_spa_offline_immediate.js';

function createEnvironmentConfigs(createConfig) {
    const development = createConfig(
        {
            APP_ENV: 'development',
            APP_NAME: 'Example application',
            APP_URL: 'https://development.example.com/',
            APP_VERSION: '2.0.0',
            WEBPACK_BUILD: true,
        },
        { mode: 'development' },
    );

    const production = createConfig(
        {
            APP_ENV: 'production',
            APP_NAME: 'Example application',
            APP_URL: 'https://example.com/',
            APP_VERSION: '2.0.0',
            WEBPACK_BUILD: true,
        },
        { mode: 'production' },
    );

    const productionPreview = createConfig(
        {
            APP_ENV: 'preview',
            APP_NAME: 'Example application',
            APP_URL: 'https://preview.example.com/',
            APP_VERSION: '2.0.0',
            WEBPACK_BUILD: true,
        },
        { mode: 'production' },
    );
    const productionServe = createConfig(
        {
            APP_ENV: 'development',
            APP_NAME: 'Example application',
            APP_URL: 'https://development.example.com/',
            APP_VERSION: '2.0.0',
            WEBPACK_SERVE: true,
        },
        { mode: 'production' },
    );

    return { development, production, productionPreview, productionServe };
}

function findWorkbox(config) {
    return config.plugins.find(({ constructor }) => constructor.name === 'GenerateSW');
}

function hasWebManifestRule(config) {
    return config.module.rules.some(({ test }) => test?.test('application.webmanifest') === true);
}

function assertSpaProfile(createConfig, entry, { immediate = false, installable = false, offline = false } = {}) {
    const { development, production, productionPreview, productionServe } = createEnvironmentConfigs(createConfig);
    const productionEntry = immediate
        ? ['@tomaschochola/tooling-webpack/register-service-worker-immediate', entry]
        : offline
          ? ['@tomaschochola/tooling-webpack/register-service-worker', entry]
          : [entry];

    assert.deepEqual(development.entry, { index: [entry] });
    assert.deepEqual(production.entry, { index: productionEntry });
    assert.deepEqual(productionPreview.entry, { index: productionEntry });
    assert.deepEqual(productionServe.entry, { index: [entry] });
    assert.equal(hasWebManifestRule(production), installable || offline);
    assert.equal(findWorkbox(development), undefined);
    assert.equal(findWorkbox(productionServe), undefined);
    assert.deepEqual(production.devServer.historyApiFallback, { disableDotRule: true });
    assert.equal(production.output.publicPath, 'https://example.com/');

    const workbox = findWorkbox(production);

    if (!offline) {
        assert.equal(workbox, undefined);
        return;
    }

    assert.equal(workbox.config.navigateFallback, 'index.html');
    assert.equal(workbox.config.clientsClaim ?? false, immediate);
    assert.equal(workbox.config.skipWaiting ?? false, immediate);
    assert.equal(
        workbox.config.include.some((pattern) => pattern.test('image.avif')),
        immediate,
    );
}

test('provides explicit browser SPA delivery profiles', () => {
    assertSpaProfile(createSpaConfig, './src/index.ts');
    assertSpaProfile(createSpaInstallableConfig, './src/index.ts', { installable: true });
    assertSpaProfile(createSpaOfflineConfig, './src/index.ts', { offline: true });
    assertSpaProfile(createSpaOfflineImmediateConfig, './src/index.ts', { immediate: true, offline: true });
});

test('provides equivalent React SPA delivery profiles with TSX entries', () => {
    assertSpaProfile(createReactSpaConfig, './src/index.tsx');
    assertSpaProfile(createReactSpaInstallableConfig, './src/index.tsx', { installable: true });
    assertSpaProfile(createReactSpaOfflineConfig, './src/index.tsx', { offline: true });
    assertSpaProfile(createReactSpaOfflineImmediateConfig, './src/index.tsx', { immediate: true, offline: true });
});

test('provides equivalent browser MPA delivery profiles without an SPA fallback', () => {
    for (const [createConfig, profile] of [
        [createMpaConfig, 'standard'],
        [createMpaInstallableConfig, 'installable'],
        [createMpaOfflineConfig, 'offline'],
        [createMpaOfflineImmediateConfig, 'immediate'],
    ]) {
        const { development, production } = createEnvironmentConfigs(createConfig);
        const registrationEntry = profile === 'immediate' ? '@tomaschochola/tooling-webpack/register-service-worker-immediate' : '@tomaschochola/tooling-webpack/register-service-worker';
        const expectedEntry = (entry) => (profile === 'offline' || profile === 'immediate' ? [registrationEntry, entry] : [entry]);

        assert.deepEqual(development.entry, {
            admin: ['./src/admin.ts'],
            index: ['./src/index.ts'],
        });
        assert.deepEqual(production.entry, {
            admin: expectedEntry('./src/admin.ts'),
            index: expectedEntry('./src/index.ts'),
        });
        assert.equal(hasWebManifestRule(production), profile !== 'standard');
        assert.equal(production.devServer.historyApiFallback, undefined);

        const workbox = findWorkbox(production);

        if (profile === 'standard' || profile === 'installable') {
            assert.equal(workbox, undefined);
        } else {
            assert.equal(workbox.config.navigateFallback, undefined);
            assert.equal(workbox.config.clientsClaim ?? false, profile === 'immediate');
            assert.equal(workbox.config.skipWaiting ?? false, profile === 'immediate');
            assert.equal(
                workbox.config.include.some((pattern) => pattern.test('image.avif')),
                profile === 'immediate',
            );
        }
    }
});

test('provides generic standard and PWA scaffolds', async () => {
    const [indexHtml, pwaHtml, manifestSource] = await Promise.all([
        readFile(new URL('../scaffolds/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../scaffolds/pwa.html', import.meta.url), 'utf8'),
        readFile(new URL('../scaffolds/manifest.webmanifest', import.meta.url), 'utf8'),
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
    assert.equal(pwaHtml.split('{{ PUBLIC_URL }}').length - 1, 2);
    assert.match(pwaHtml, /content="\.\.\/build\/open-graph\/open-graph\.png"/u);
    assert.match(pwaHtml, /href="\.\/manifest\.webmanifest"/u);
    assert.match(pwaHtml, /href="\.\.\/build\/favicons\/favicon\.ico"/u);
    assert.match(pwaHtml, /href="\.\.\/build\/favicons\/favicon\.svg"/u);
    assert.match(pwaHtml, /type="application\/ld\+json"/u);
    assert.ok(manifest.icons.every(({ src }) => src.startsWith('../build/favicons/')));
    assert.equal(manifest.id, './');
    assert.equal(manifest.name, 'Application');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.start_url, './');
    assert.doesNotMatch(manifestSource, /tomaschochola|tooling-webpack|template-react|template-web-components/u);
});
