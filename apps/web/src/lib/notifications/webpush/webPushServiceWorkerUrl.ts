export const WEB_PUSH_SERVICE_WORKER_PATH = '/webpush-sw.js';

/** Read by `public/webpush-sw.js`; the two must match. */
export const WEB_PUSH_SERVICE_WORKER_API_BASE_PARAM = 'api_base';

export function buildWebPushServiceWorkerUrl(apiBaseUrl: string): string {
  const encodedBase = encodeURIComponent(apiBaseUrl);
  return `${WEB_PUSH_SERVICE_WORKER_PATH}?${WEB_PUSH_SERVICE_WORKER_API_BASE_PARAM}=${encodedBase}`;
}

/**
 * Re-registers the worker when an existing registration's script URL lacks the API base.
 * The same default scope keeps the push subscription.
 */
export async function ensureWebPushServiceWorkerScriptUrl(apiBaseUrl: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      WEB_PUSH_SERVICE_WORKER_PATH
    );
    if (registration === undefined) {
      return;
    }

    const worker = registration.active ?? registration.waiting ?? registration.installing;
    const expectedUrl = new URL(buildWebPushServiceWorkerUrl(apiBaseUrl), window.location.origin)
      .href;
    if (worker !== null && worker.scriptURL === expectedUrl) {
      return;
    }

    await navigator.serviceWorker.register(buildWebPushServiceWorkerUrl(apiBaseUrl));
  } catch (error) {
    console.warn('Could not update the web push service worker URL', error);
  }
}
