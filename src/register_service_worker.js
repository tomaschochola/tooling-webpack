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

/* global __webpack_public_path__:readonly */

import { registerServiceWorker } from './service_worker_registration.js';
import { resolveServiceWorkerScriptURL } from './service_worker_script_url.js';

const browserOrigin = globalThis.window?.location?.origin;
const scriptURL = browserOrigin === undefined ? '/sw.js' : resolveServiceWorkerScriptURL(__webpack_public_path__, browserOrigin);

void registerServiceWorker({ scriptURL });
