import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NotificationCategoryValues } from '@podverse/helpers';

import type { BannerNotificationKind } from '../notifications/bannerNotificationPolicy';
import {
  applyBannerCategoryEnabled,
  BANNER_NOTIFICATION_KINDS,
  isBannerCategoryEnabled,
  resolveBannerNotificationEnabled,
} from '../notifications/bannerNotificationPolicy';

/**
 * Device-local switches for which notification kinds show a banner. Kept across sign-out.
 *
 * Not account data. `clearSession` and the `status === 'anonymous'` reset leave this key in
 * place, so the next person on this phone keeps the same banner choices.
 */

export const BANNER_NOTIFICATION_PREFS_KEY = 'notifications.banner_kinds';

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Frozen snapshot handed to callers. Replaced only when a set or an applied hydrate changes the
 * switches, so a subscriber can use this object as a `useSyncExternalStore` snapshot.
 */
const DEFAULT_SNAPSHOT: Record<BannerNotificationKind, boolean> = Object.freeze(
  resolveBannerNotificationEnabled(null)
);

let snapshot: Record<BannerNotificationKind, boolean> | null = null;
let hydrated = false;
let generation = 0;

const notifyBannerNotificationPrefs = (): void => {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error: unknown) {
      console.warn('Banner notification preference listener failed', error);
    }
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readStoredKindFlags = (
  parsed: Record<string, unknown>
): Partial<Record<BannerNotificationKind, boolean>> => {
  const stored: Partial<Record<BannerNotificationKind, boolean>> = {};
  for (const kind of BANNER_NOTIFICATION_KINDS) {
    const value = parsed[kind];
    if (typeof value === 'boolean') {
      stored[kind] = value;
    }
  }
  return stored;
};

const parseStoredBannerNotificationEnabled = (
  raw: string | null
): Record<BannerNotificationKind, boolean> => {
  if (raw === null) {
    return resolveBannerNotificationEnabled(null);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return resolveBannerNotificationEnabled(null);
    }
    return resolveBannerNotificationEnabled(readStoredKindFlags(parsed));
  } catch {
    return resolveBannerNotificationEnabled(null);
  }
};

/**
 * The current switches. The same frozen object until the next set or applied hydrate, or the
 * frozen defaults while nothing has been stored yet. Callers cannot change the cache through it.
 */
export const getBannerNotificationEnabled = (): Record<BannerNotificationKind, boolean> => {
  return snapshot ?? DEFAULT_SNAPSHOT;
};

export const isBannerNotificationPrefsHydrated = (): boolean => {
  return hydrated;
};

export const subscribeBannerNotificationPrefs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Read the key into the cache. A `set` that lands while this read is in flight wins: the read
 * is dropped and does not notify again.
 */
export const hydrateBannerNotificationPrefs = async (): Promise<void> => {
  generation += 1;
  const generationAtStart = generation;
  const raw = await AsyncStorage.getItem(BANNER_NOTIFICATION_PREFS_KEY);
  if (generation !== generationAtStart) {
    hydrated = true;
    return;
  }

  const resolved = parseStoredBannerNotificationEnabled(raw);
  snapshot = Object.freeze(resolved);
  hydrated = true;
  notifyBannerNotificationPrefs();

  if (raw !== null) {
    const serialized = JSON.stringify(resolved);
    if (serialized !== raw) {
      await AsyncStorage.setItem(BANNER_NOTIFICATION_PREFS_KEY, serialized);
    }
  }
};

/** Update the cache and notify, then write the full map of every kind. */
export const setBannerNotificationEnabled = async (
  kind: BannerNotificationKind,
  enabled: boolean
): Promise<void> => {
  generation += 1;
  const next = { ...getBannerNotificationEnabled() };
  next[kind] = enabled;
  snapshot = Object.freeze(next);
  hydrated = true;
  notifyBannerNotificationPrefs();
  await AsyncStorage.setItem(BANNER_NOTIFICATION_PREFS_KEY, JSON.stringify(next));
};

export const getBannerNotificationCategoryEnabled = (
  category: NotificationCategoryValues
): boolean => {
  return isBannerCategoryEnabled(category, getBannerNotificationEnabled());
};

/** Turn every kind under a category on or off together (Livestream includes Scheduled and Started). */
export const setBannerNotificationCategoryEnabled = async (
  category: NotificationCategoryValues,
  enabled: boolean
): Promise<void> => {
  generation += 1;
  const next = applyBannerCategoryEnabled(category, enabled, getBannerNotificationEnabled());
  snapshot = Object.freeze(next);
  hydrated = true;
  notifyBannerNotificationPrefs();
  await AsyncStorage.setItem(BANNER_NOTIFICATION_PREFS_KEY, JSON.stringify(next));
};
