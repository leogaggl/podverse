import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildWebPushServiceWorkerUrl,
  ensureWebPushServiceWorkerScriptUrl,
  WEB_PUSH_SERVICE_WORKER_PATH,
} from './webPushServiceWorkerUrl';

const API_BASE = 'http://localhost:4030/api/v2';

describe('buildWebPushServiceWorkerUrl', () => {
  it('encodes the API base on the service worker script URL', () => {
    expect(buildWebPushServiceWorkerUrl(API_BASE)).toBe(
      '/webpush-sw.js?api_base=http%3A%2F%2Flocalhost%3A4030%2Fapi%2Fv2'
    );
  });
});

describe('ensureWebPushServiceWorkerScriptUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
  });

  it('does not register when there is no existing registration', async () => {
    const register = vi.fn();
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration, register },
    });

    await ensureWebPushServiceWorkerScriptUrl(API_BASE);

    expect(getRegistration).toHaveBeenCalledWith(WEB_PUSH_SERVICE_WORKER_PATH);
    expect(register).not.toHaveBeenCalled();
  });

  it('does not register when the active script URL already matches', async () => {
    const register = vi.fn();
    const expectedUrl = new URL(buildWebPushServiceWorkerUrl(API_BASE), window.location.origin)
      .href;
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          active: { scriptURL: expectedUrl },
          waiting: null,
          installing: null,
        }),
        register,
      },
    });

    await ensureWebPushServiceWorkerScriptUrl(API_BASE);

    expect(register).not.toHaveBeenCalled();
  });

  it('registers once when the active script URL differs', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const currentUrl = new URL(WEB_PUSH_SERVICE_WORKER_PATH, window.location.origin).href;
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          active: { scriptURL: currentUrl },
          waiting: null,
          installing: null,
        }),
        register,
      },
    });

    await ensureWebPushServiceWorkerScriptUrl(API_BASE);

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(buildWebPushServiceWorkerUrl(API_BASE));
  });

  it('resolves and warns when register rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error('register failed'));
    const currentUrl = new URL(WEB_PUSH_SERVICE_WORKER_PATH, window.location.origin).href;
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          active: { scriptURL: currentUrl },
          waiting: null,
          installing: null,
        }),
        register,
      },
    });

    await expect(ensureWebPushServiceWorkerScriptUrl(API_BASE)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Could not update the web push service worker URL',
      expect.any(Error)
    );
  });
});
