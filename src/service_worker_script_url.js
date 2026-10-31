export function resolveServiceWorkerScriptURL(publicPath, browserOrigin) {
    return new URL('sw.js', new URL(publicPath, browserOrigin)).pathname;
}
