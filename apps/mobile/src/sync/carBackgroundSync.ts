import { AppRegistry, NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { createBackgroundAuthDeps } from '../auth/backgroundAuthDeps';
import { reprojectCarCacheAll } from '../data/nativeCache/carCacheReproject';
import { drainPlaybackJournal } from '../playback/drainPlaybackJournal';

let inFlight: Promise<void> | null = null;
let carPlayListenerAttached = false;

/**
 * Shared car background sync: drain the native playback journal, reproject cache, soft-fail
 * refresh hooks. Single-flight. Safe when the phone UI is not visible (CarPlay connect /
 * Android headless).
 */
export const runCarBackgroundSync = async (params?: {
  accountIdText?: string | null;
  avQueueIdText?: string | null;
  musicQueueIdText?: string | null;
}): Promise<void> => {
  if (inFlight !== null) {
    return inFlight;
  }

  inFlight = (async () => {
    // Ensure SecureStore tokens are readable when the phone is locked after first unlock.
    await createBackgroundAuthDeps();
    const accountIdText = params?.accountIdText ?? null;
    const avQueueIdText = params?.avQueueIdText ?? null;

    try {
      await drainPlaybackJournal({
        accountIdText,
        queueIdText: avQueueIdText,
      });
    } catch (error) {
      console.warn('[car-sync] journal drain failed', error);
    }

    try {
      await reprojectCarCacheAll({
        avQueueIdText: params?.avQueueIdText,
        musicQueueIdText: params?.musicQueueIdText,
      });
    } catch (error) {
      console.warn('[car-sync] reproject failed', error);
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

/** Register Android headless task name expected by PodverseCarHeadlessSyncService. */
export const registerCarBackgroundSyncHeadlessTask = (): void => {
  AppRegistry.registerHeadlessTask('PodverseCarBackgroundSync', () => async () => {
    await runCarBackgroundSync();
  });
};

/**
 * iOS: when the CarPlay scene connects, native posts `podverseCarPlayDidConnect`. If JS is alive
 * (background launch), drain + reproject. Soft-fail when the emitter is unavailable.
 */
export const attachCarPlayConnectSyncListener = (): void => {
  if (Platform.OS !== 'ios' || carPlayListenerAttached) {
    return;
  }
  carPlayListenerAttached = true;
  try {
    const module = NativeModules.PodverseMediaEngine;
    if (module === null || module === undefined) {
      return;
    }
    const emitter = new NativeEventEmitter(module);
    emitter.addListener('podverseCarPlayDidConnect', () => {
      void runCarBackgroundSync();
    });
  } catch {
    // Soft-fail: NotificationCenter path may not bridge until Expo module emits.
  }
};
