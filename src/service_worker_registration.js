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

const defaultUpdateIntervalMilliseconds = 60_000;

function reportError(error) {
    console.error('Service Worker operation failed.', error);
}

export async function registerServiceWorker({ minimumUpdateIntervalMilliseconds = defaultUpdateIntervalMilliseconds, onError = reportError, reloadOnUpdate = true, scriptURL = '/sw.js' } = {}) {
    if (!Number.isFinite(minimumUpdateIntervalMilliseconds) || minimumUpdateIntervalMilliseconds < 0) {
        throw new TypeError('Minimum Service Worker update interval must be a non-negative finite number.');
    }

    const browserDocument = globalThis.document;
    const browserNavigator = globalThis.navigator;
    const browserWindow = globalThis.window;

    if (browserDocument === undefined || browserNavigator === undefined || browserWindow === undefined || !('serviceWorker' in browserNavigator)) {
        return undefined;
    }

    const serviceWorkers = browserNavigator.serviceWorker;
    const previousController = serviceWorkers.controller;
    let reloading = false;

    const handleControllerChange = () => {
        if (!reloadOnUpdate || previousController === null || reloading) {
            return;
        }

        reloading = true;
        browserWindow.location.reload();
    };

    serviceWorkers.addEventListener('controllerchange', handleControllerChange);

    let registration;

    try {
        registration = await serviceWorkers.register(scriptURL, {
            updateViaCache: 'none',
        });
    } catch (error) {
        serviceWorkers.removeEventListener('controllerchange', handleControllerChange);
        onError(error);

        return undefined;
    }

    let lastUpdateCheck = Date.now();
    const checkForUpdate = () => {
        const now = Date.now();

        if (now - lastUpdateCheck < minimumUpdateIntervalMilliseconds) {
            return;
        }

        lastUpdateCheck = now;
        void registration.update().catch(onError);
    };

    browserWindow.addEventListener('focus', checkForUpdate);
    browserWindow.addEventListener('online', checkForUpdate);
    browserDocument.addEventListener('visibilitychange', () => {
        if (browserDocument.visibilityState === 'visible') {
            checkForUpdate();
        }
    });

    return registration;
}
