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

async function retireServiceWorker() {
  const [cacheNames, windowClients] = await Promise.all([
    globalThis.caches.keys(),
    globalThis.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    }),
  ]);
  const scope = globalThis.registration.scope;

  await Promise.allSettled(cacheNames.map((cacheName) => globalThis.caches.delete(cacheName)));
  await globalThis.registration.unregister();
  await Promise.allSettled(windowClients.filter((client) => client.url.startsWith(scope)).map((client) => client.navigate(client.url)));
}

globalThis.addEventListener('install', (event) => {
  event.waitUntil(globalThis.skipWaiting());
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(retireServiceWorker());
});
