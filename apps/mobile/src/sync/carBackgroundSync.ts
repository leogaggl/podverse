import { AppRegistry, Platform } from 'react-native';

import { createBackgroundAuthDeps } from '../auth/backgroundAuthDeps';
import { nativePlaybackBridge } from '../bridge/nativePlaybackBridge';
import { reprojectCarCacheAll } from '../data/nativeCache/carCacheReproject';
import { accountRepository } from '../data/repositories/accountRepository';
import { channelLiveStatusRepository } from '../data/repositories/channelLiveStatusRepository';
import { playbackOutboxRepository } from '../data/repositories/playbackOutboxRepository';
import { readCachedQueueIds } from '../data/repositories/queueProjectionHelpers';
import { queueRepository } from '../data/repositories/queueRepository';
import { statsRepository } from '../data/repositories/statsRepository';
import type { MobileAuthRequestContext } from '../data/repositories/types';
import { isEffectivelyOffline } from '../net/connectivity';
import { drainPlaybackJournal } from '../playback/drainPlaybackJournal';

let inFlight: Promise<void> | null = null;
let journalDrainInFlight: Promise<void> | null = null;
let carPlayListenerAttached = false;

export type CarSyncIdentity = {
  accountIdText: string | null;
  avQueueIdText: string | null;
  musicQueueIdText: string | null;
};

/**
 * Who the car's listening belongs to, read from the device alone: the stored account and the
 * last-synced queue list. Works with the phone UI closed, so it never waits on React state.
 */
export const resolveCarSyncIdentity = async (): Promise<CarSyncIdentity> => {
  let accountIdText: string | null;
  try {
    accountIdText = (await accountRepository.getSnapshot())?.id_text ?? null;
  } catch {
    accountIdText = null;
  }
  if (accountIdText === null) {
    return { accountIdText: null, avQueueIdText: null, musicQueueIdText: null };
  }
  try {
    return { accountIdText, ...(await readCachedQueueIds()) };
  } catch {
    return { accountIdText, avQueueIdText: null, musicQueueIdText: null };
  }
};

/**
 * Apply the native playback journal for the current identity. Single-flight; the journal's own
 * cursor makes a repeated drain a no-op.
 */
export const drainCarPlaybackJournal = async (): Promise<void> => {
  if (journalDrainInFlight !== null) {
    return journalDrainInFlight;
  }
  journalDrainInFlight = (async () => {
    try {
      await drainPlaybackJournal(await resolveCarSyncIdentity());
    } catch (error) {
      if (__DEV__) {
        console.warn('[car-sync] journal drain failed', error);
      }
    }
  })().finally(() => {
    journalDrainInFlight = null;
  });
  return journalDrainInFlight;
};

/**
 * Network half of a car sync: send what the car recorded, then refresh what the car lists. Each
 * step soft-fails on its own so one failing endpoint cannot hold back the rest.
 */
const refreshForCar = async (
  context: MobileAuthRequestContext,
  identity: CarSyncIdentity
): Promise<void> => {
  if (identity.accountIdText === null || isEffectivelyOffline()) {
    return;
  }
  const accountIdText = identity.accountIdText;
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['outbox', () => playbackOutboxRepository.drain(context, accountIdText)],
    ['listens', () => statsRepository.drainListens(context, accountIdText)],
    ['live', () => channelLiveStatusRepository.refreshFromAccount(context)],
  ];
  for (const queueIdText of [identity.avQueueIdText, identity.musicQueueIdText]) {
    if (queueIdText === null) {
      continue;
    }
    steps.push([
      `queue:${queueIdText}`,
      async () => {
        await queueRepository.getNowPlaying(context, queueIdText);
        await queueRepository.getUpcoming(context, queueIdText);
        await queueRepository.getHistoryPage(context, queueIdText, 1);
      },
    ]);
  }
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (error) {
      if (__DEV__) {
        console.warn(`[car-sync] ${label} refresh failed`, error);
      }
    }
  }
};

/**
 * Shared car background sync: drain the native playback journal, send and refresh over the
 * network when signed in and online, then reproject the car cache. Single-flight. Safe when the
 * phone UI is not visible (CarPlay connect / Android headless).
 */
export const runCarBackgroundSync = async (): Promise<void> => {
  if (inFlight !== null) {
    return inFlight;
  }

  inFlight = (async () => {
    // Reading tokens here also confirms SecureStore is readable while the phone is locked.
    const context = await createBackgroundAuthDeps();

    await drainCarPlaybackJournal();

    const identity = await resolveCarSyncIdentity();
    if (context !== null) {
      await refreshForCar(context, identity);
    }

    try {
      await reprojectCarCacheAll({
        avQueueIdText: identity.avQueueIdText,
        musicQueueIdText: identity.musicQueueIdText,
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
    nativePlaybackBridge.addListener('podverseCarPlayDidConnect', () => {
      void runCarBackgroundSync();
    });
  } catch {
    // The native module is missing outside a device build; a later call may still attach.
    carPlayListenerAttached = false;
  }
};
