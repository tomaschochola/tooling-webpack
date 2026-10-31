/* global __webpack_public_path__:readonly */

import { registerServiceWorker } from './service_worker_registration.js';
import { resolveServiceWorkerScriptURL } from './service_worker_script_url.js';

const browserOrigin = globalThis.window?.location?.origin;
const scriptURL = browserOrigin === undefined ? '/sw.js' : resolveServiceWorkerScriptURL(__webpack_public_path__, browserOrigin);

void registerServiceWorker({ scriptURL });
