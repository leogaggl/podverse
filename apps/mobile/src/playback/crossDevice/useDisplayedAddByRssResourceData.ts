/**
 * Add by RSS data for the item on screen: the remote item's copy on this phone, or this phone's
 * own target. One lookup is shared so chapters and sections stay on that same item.
 */
import { useEffect, useSyncExternalStore } from 'react';

import type { AddByRSSResourceData } from '@podverse/helpers/dto';

import { addByRssRepository } from '../../data/repositories/addByRssRepository';
import { findLocalAddByRssResourceDataByHash } from '../../lib/addByRss/localResourceData';
import { usePlaybackRow } from '../PlaybackProvider';
import type { CrossDevicePlayerDisplay } from './crossDevicePlayerDisplay';
import { useCrossDevicePlayerDisplay } from './useCrossDevicePlayerDisplay';

type RemoteAddByRssEntry = {
  hashId: string;
  data: AddByRSSResourceData | null;
};

let remoteAddByRssEntry: RemoteAddByRssEntry | null = null;
let requestedRemoteAddByRssHashId: string | null = null;
let inFlightRemoteAddByRssHashId: string | null = null;

const remoteAddByRssListeners = new Set<() => void>();

const subscribeRemoteAddByRss = (listener: () => void): (() => void) => {
  remoteAddByRssListeners.add(listener);
  return () => {
    remoteAddByRssListeners.delete(listener);
  };
};

const getRemoteAddByRssEntry = (): RemoteAddByRssEntry | null => remoteAddByRssEntry;

const publishRemoteAddByRssEntry = (next: RemoteAddByRssEntry): void => {
  remoteAddByRssEntry = next;
  for (const listener of remoteAddByRssListeners) {
    listener();
  }
};

const finishRemoteAddByRssLookup = (hashId: string, data: AddByRSSResourceData | null): void => {
  if (inFlightRemoteAddByRssHashId === hashId) {
    inFlightRemoteAddByRssHashId = null;
  }
  if (requestedRemoteAddByRssHashId !== hashId) {
    return;
  }
  publishRemoteAddByRssEntry({ hashId, data });
};

const remoteAddByRssHashId = (display: CrossDevicePlayerDisplay): string | null => {
  if (display.kind !== 'remote') {
    return null;
  }
  const { ref } = display.resource;
  if (ref.kind !== 'add_by_rss') {
    return null;
  }
  return ref.add_by_rss_hash_id;
};

/** The phone's own Add by RSS data for a shared hash; null while looking or when not found. */
export function useRemoteAddByRssResourceData(hashId: string | null): AddByRSSResourceData | null {
  const current = useSyncExternalStore(
    subscribeRemoteAddByRss,
    getRemoteAddByRssEntry,
    getRemoteAddByRssEntry
  );

  useEffect(() => {
    if (hashId === null) {
      requestedRemoteAddByRssHashId = null;
      return;
    }

    requestedRemoteAddByRssHashId = hashId;
    if (remoteAddByRssEntry !== null && remoteAddByRssEntry.hashId === hashId) {
      return;
    }
    if (inFlightRemoteAddByRssHashId === hashId) {
      return;
    }

    inFlightRemoteAddByRssHashId = hashId;
    void findLocalAddByRssResourceDataByHash(hashId, addByRssRepository).then(
      (data) => {
        finishRemoteAddByRssLookup(hashId, data);
      },
      () => {
        finishRemoteAddByRssLookup(hashId, null);
      }
    );
  }, [hashId]);

  if (hashId === null || current === null || current.hashId !== hashId) {
    return null;
  }
  return current.data;
}

/** Add by RSS data for the item the player shows: the remote item's local copy, or this phone's target. */
export function useDisplayedAddByRssResourceData(): AddByRSSResourceData | null {
  const display = useCrossDevicePlayerDisplay();
  const { activeTarget } = usePlaybackRow();
  const remoteData = useRemoteAddByRssResourceData(remoteAddByRssHashId(display));
  if (display.kind === 'remote') {
    return remoteData;
  }
  if (activeTarget !== null && activeTarget.kind === 'add-by-rss') {
    return activeTarget.resourceData;
  }
  return null;
}
