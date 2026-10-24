import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_BANNER_NOTIFICATION_ENABLED } from '../notifications/bannerNotificationPolicy';
import { BANNER_NOTIFICATION_PREFS_KEY } from './bannerNotificationPrefs';

const asyncStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const defaultReadItem = async (key: string): Promise<string | null> => {
    return store.has(key) ? (store.get(key) ?? null) : null;
  };
  let readItem = defaultReadItem;

  return {
    store,
    getItem: (key: string): Promise<string | null> => {
      return readItem(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
      store.set(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
      store.delete(key);
    },
    setReadItem: (next: (key: string) => Promise<string | null>): void => {
      readItem = next;
    },
    resetReadItem: (): void => {
      readItem = defaultReadItem;
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      getItem: (key: string) => asyncStorageMock.getItem(key),
      removeItem: (key: string) => asyncStorageMock.removeItem(key),
      setItem: (key: string, value: string) => asyncStorageMock.setItem(key, value),
    },
  };
});

const loadBannerNotificationPrefs = async () => {
  return import('./bannerNotificationPrefs');
};

describe('bannerNotificationPrefs', () => {
  beforeEach(() => {
    asyncStorageMock.store.clear();
    asyncStorageMock.resetReadItem();
    vi.resetModules();
  });

  it('hydrates to the defaults when nothing is stored', async () => {
    const prefs = await loadBannerNotificationPrefs();

    expect(prefs.isBannerNotificationPrefsHydrated()).toBe(false);

    const snapshot = prefs.getBannerNotificationEnabled();
    expect(snapshot).toEqual(DEFAULT_BANNER_NOTIFICATION_ENABLED);
    expect(snapshot).not.toBe(DEFAULT_BANNER_NOTIFICATION_ENABLED);
    expect(prefs.getBannerNotificationEnabled()).toBe(snapshot);
    expect(() => {
      snapshot['new-item'] = false;
    }).toThrow(TypeError);
    expect(prefs.getBannerNotificationEnabled()['new-item']).toBe(true);

    await prefs.hydrateBannerNotificationPrefs();

    expect(prefs.isBannerNotificationPrefsHydrated()).toBe(true);
    expect(prefs.getBannerNotificationEnabled()).toEqual(DEFAULT_BANNER_NOTIFICATION_ENABLED);
  });

  it('keeps a saved kind across a fresh hydrate and leaves the other defaults', async () => {
    const first = await loadBannerNotificationPrefs();
    await first.setBannerNotificationEnabled('livestream-scheduled', true);
    expect(first.isBannerNotificationPrefsHydrated()).toBe(true);

    const raw = asyncStorageMock.store.get(BANNER_NOTIFICATION_PREFS_KEY);
    expect(typeof raw).toBe('string');
    if (typeof raw === 'string') {
      expect(JSON.parse(raw)).toEqual({
        ...DEFAULT_BANNER_NOTIFICATION_ENABLED,
        'livestream-scheduled': true,
      });
    }

    vi.resetModules();
    const second = await loadBannerNotificationPrefs();
    await second.hydrateBannerNotificationPrefs();

    expect(second.getBannerNotificationEnabled()).toEqual({
      ...DEFAULT_BANNER_NOTIFICATION_ENABLED,
      'livestream-scheduled': true,
    });
  });

  it('hydrates to the defaults when the stored value is not JSON', async () => {
    asyncStorageMock.store.set(BANNER_NOTIFICATION_PREFS_KEY, 'not-json');

    const prefs = await loadBannerNotificationPrefs();
    await prefs.hydrateBannerNotificationPrefs();

    expect(prefs.getBannerNotificationEnabled()).toEqual(DEFAULT_BANNER_NOTIFICATION_ENABLED);
  });

  it('keeps a set that happens while hydrate is still reading', async () => {
    const pendingReads: Array<(value: string | null) => void> = [];
    asyncStorageMock.setReadItem(
      () =>
        new Promise((resolve) => {
          pendingReads.push(resolve);
        })
    );

    const prefs = await loadBannerNotificationPrefs();
    const hydrate = prefs.hydrateBannerNotificationPrefs();
    expect(pendingReads).toHaveLength(1);

    await prefs.setBannerNotificationEnabled('livestream-scheduled', true);
    const releaseRead = pendingReads[0];
    if (releaseRead === undefined) {
      throw new Error('hydrate did not read storage');
    }
    releaseRead(JSON.stringify({ 'new-item': false }));
    await hydrate;

    expect(prefs.isBannerNotificationPrefsHydrated()).toBe(true);
    expect(prefs.getBannerNotificationEnabled()).toEqual({
      ...DEFAULT_BANNER_NOTIFICATION_ENABLED,
      'livestream-scheduled': true,
    });
  });
});
