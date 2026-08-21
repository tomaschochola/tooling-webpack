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
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import webpack from 'webpack';
import { WebpackConfigBuilder } from '../src/index.js';
import { registerServiceWorker } from '../src/service_worker_registration.js';

function replaceGlobal(context, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  });
  context.after(() => {
    if (descriptor === undefined) {
      delete globalThis[name];
    } else {
      Object.defineProperty(globalThis, name, descriptor);
    }
  });
}

function installBrowserRegistrationHarness(context, controller) {
  const documentListeners = new Map();
  const serviceWorkerListeners = new Map();
  const windowListeners = new Map();
  const calls = {
    register: [],
    reload: 0,
    update: 0,
  };
  const registration = {
    update() {
      calls.update += 1;

      return Promise.resolve();
    },
  };
  const serviceWorker = {
    controller,
    addEventListener(name, listener) {
      serviceWorkerListeners.set(name, listener);
    },
    register(...parameters) {
      calls.register.push(parameters);

      return Promise.resolve(registration);
    },
    removeEventListener(name) {
      serviceWorkerListeners.delete(name);
    },
  };
  const browserDocument = {
    visibilityState: 'visible',
    addEventListener(name, listener) {
      documentListeners.set(name, listener);
    },
  };
  const browserWindow = {
    location: {
      reload() {
        calls.reload += 1;
      },
    },
    addEventListener(name, listener) {
      windowListeners.set(name, listener);
    },
  };

  replaceGlobal(context, 'document', browserDocument);
  replaceGlobal(context, 'navigator', { serviceWorker });
  replaceGlobal(context, 'window', browserWindow);

  return {
    browserDocument,
    calls,
    documentListeners,
    registration,
    serviceWorkerListeners,
    windowListeners,
  };
}

async function compile(config) {
  const compiler = webpack(config);

  try {
    const statistics = await new Promise((resolvePromise, rejectPromise) => {
      compiler.run((error, result) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        if (result === undefined) {
          rejectPromise(new Error('Webpack completed without build statistics.'));

          return;
        }

        resolvePromise(result);
      });
    });

    return statistics;
  } finally {
    await new Promise((resolvePromise, rejectPromise) => {
      compiler.close((error) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        resolvePromise();
      });
    });
  }
}

test('does not register a service worker outside a browser', async () => {
  assert.equal(await registerServiceWorker(), undefined);
});

test('registers and updates a service worker through the native browser API', async (context) => {
  const harness = installBrowserRegistrationHarness(context, {
    scriptURL: '/sw.js',
  });

  assert.equal(await registerServiceWorker({ minimumUpdateIntervalMilliseconds: 0 }), harness.registration);
  assert.deepEqual(harness.calls.register, [['/sw.js', { updateViaCache: 'none' }]]);

  harness.windowListeners.get('focus')();
  harness.windowListeners.get('online')();
  harness.documentListeners.get('visibilitychange')();
  assert.equal(harness.calls.update, 3);

  harness.serviceWorkerListeners.get('controllerchange')();
  harness.serviceWorkerListeners.get('controllerchange')();
  assert.equal(harness.calls.reload, 1);
});

test('does not reload the page when the first service worker takes control', async (context) => {
  const harness = installBrowserRegistrationHarness(context, null);

  await registerServiceWorker();
  harness.serviceWorkerListeners.get('controllerchange')();

  assert.equal(harness.calls.reload, 0);
});

test('retirement worker clears cache storage, unregisters, and reloads scoped clients', async () => {
  const source = await readFile(new URL('../src/service_worker_retirement.js', import.meta.url), 'utf8');

  assert.match(source, /globalThis\.caches\.delete/u);
  assert.match(source, /globalThis\.registration\.unregister/u);
  assert.match(source, /client\.url\.startsWith\(scope\)/u);
  assert.match(source, /client\.navigate\(client\.url\)/u);
  assert.match(source, /globalThis\.skipWaiting/u);
});

test('browser service worker registration entry bundles independently', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-registration-'));
  const outputPath = join(root, 'dist');

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const builder = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: { mode: 'production' },
  })
    .setEntries({
      index: [fileURLToPath(new URL('../src/register_service_worker.js', import.meta.url))],
    })
    .setOutputPath(outputPath)
    .addBabelLoader();
  const base = builder.toConfig();
  const statistics = await compile({
    ...base,
    context: process.cwd(),
    devtool: false,
    mode: 'production',
    output: {
      ...base.output,
      path: outputPath,
      publicPath: '/',
    },
    target: 'web',
  });

  assert.equal(statistics.hasErrors(), false, statistics.toString({ all: false, errorDetails: true, errors: true }));
  assert.equal(packageJson.exports['./register-service-worker'], './src/register_service_worker.js');

  const bundleFilename = statistics.toJson({ all: false, assets: true }).assets.find(({ name }) => name.endsWith('.js')).name;
  const bundle = await readFile(join(outputPath, bundleFilename), 'utf8');

  assert.match(bundle, /updateViaCache/u);
  assert.match(bundle, /serviceWorker/u);
  assert.doesNotMatch(bundle, /workbox-window|class Workbox/u);
  assert.doesNotMatch(bundle, /registration\.unregister/u);
});

test('retirement builder emits only the standalone worker at the stable sw.js path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-retirement-'));
  const outputPath = join(root, 'dist');
  const entry = join(root, 'index.js');

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(entry, 'globalThis.applicationBundle = true;\n');

  const builder = new WebpackConfigBuilder({
    ecmaVersion: 2025,
    argv: { mode: 'production' },
  })
    .setEntries({ index: entry })
    .setOutputPath(outputPath)
    .addServiceWorkerRetirement();
  const base = builder.toConfig();
  const statistics = await compile({
    ...base,
    context: process.cwd(),
    devtool: false,
    mode: 'production',
    output: {
      ...base.output,
      path: outputPath,
      publicPath: '/',
    },
    target: 'web',
  });

  assert.equal(statistics.hasErrors(), false, statistics.toString({ all: false, errorDetails: true, errors: true }));
  assert.equal(await readFile(join(outputPath, 'sw.js'), 'utf8'), await readFile(new URL('../src/service_worker_retirement.js', import.meta.url), 'utf8'));

  const bundleFilename = statistics.toJson({ all: false, assets: true }).assets.find(({ name }) => name.endsWith('.js') && name !== 'sw.js').name;
  const bundle = await readFile(join(outputPath, bundleFilename), 'utf8');

  assert.match(bundle, /applicationBundle/u);
  assert.doesNotMatch(bundle, /registration\.unregister/u);
});
