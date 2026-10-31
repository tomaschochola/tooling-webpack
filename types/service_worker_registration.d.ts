export interface ServiceWorkerRegistrationOptions {
    minimumUpdateIntervalMilliseconds?: number;
    onError?: (error: unknown) => void;
    reloadOnUpdate?: boolean;
    scriptURL?: string;
}

export function registerServiceWorker(options?: ServiceWorkerRegistrationOptions): Promise<ServiceWorkerRegistration | undefined>;
