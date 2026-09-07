import { registerServiceWorker } from '@tomaschochola/tooling-webpack/service-worker-registration';
import source from './image.svg?source';
import resource from './image.svg?as=webp&resource';
import sheet from './style.css?sheet';
import text from './style.scss?text';
import html from './document.html';
import './style.css';
import './style.scss?style';
import './style.sass?link';

export const strings: string[] = [source, resource, text, html];
export const stylesheet: CSSStyleSheet = sheet;
export const registration: Promise<ServiceWorkerRegistration | undefined> = registerServiceWorker({
    minimumUpdateIntervalMilliseconds: 1000,
    reloadOnUpdate: false,
    scriptURL: '/sw.js',
    onError: (error: unknown) => {
        console.error(error);
    },
});

// @ts-expect-error A stylesheet asset must not become an untyped value.
export const invalidSheet: string = sheet;
// @ts-expect-error Asset text is not a numeric value.
export const invalidSource: number = source;
// @ts-expect-error Update intervals must be numbers.
void registerServiceWorker({ minimumUpdateIntervalMilliseconds: '1000' });
// @ts-expect-error Unknown options are not part of the public contract.
void registerServiceWorker({ unexpected: true });
