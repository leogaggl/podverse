import type { AddByRSSResourceData } from '@podverse/helpers/dto';

import type { AddByRssItemSections } from '../lib/addByRss/itemSections';
import type { AddByRssNowPlayingItemSource } from '../lib/addByRss/localResourceData';
import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
} from '../lib/addByRss/resourceData';

export type AddByRssNowPlayingSectionsStatus = 'error' | 'idle' | 'loaded' | 'loading';
export type AddByRssNowPlayingSourceStatus = 'idle' | 'resolved' | 'resolving' | 'unavailable';

export type AddByRssNowPlayingSectionsSnapshot = {
  key: string | null;
  sections: AddByRssItemSections | null;
  sectionsStatus: AddByRssNowPlayingSectionsStatus;
  source: AddByRssNowPlayingItemSource | null;
  sourceStatus: AddByRssNowPlayingSourceStatus;
};

export const IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS: AddByRssNowPlayingSectionsSnapshot = {
  key: null,
  sections: null,
  sectionsStatus: 'idle',
  source: null,
  sourceStatus: 'idle',
};

/** Store key for the Add by RSS item now playing. Livestreams and an empty target have none. */
export const addByRssNowPlayingSectionsKey = (
  resourceData: AddByRSSResourceData | null
): string | null => {
  if (resourceData === null || isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  return addByRssPlaybackMediaId(resourceData);
};

/**
 * Chapters load on play when the item links a chapters file, the account is signed in, and
 * Offline Mode is off. A transcript-only item waits for an explicit load.
 */
export const shouldAutoLoadAddByRssNowPlayingChapters = (input: {
  isAuthenticated: boolean;
  offlineModeEnabled: boolean;
  snapshot: AddByRssNowPlayingSectionsSnapshot;
}): boolean =>
  input.isAuthenticated &&
  !input.offlineModeEnabled &&
  input.snapshot.sourceStatus === 'resolved' &&
  input.snapshot.sectionsStatus === 'idle' &&
  input.snapshot.source?.sectionUrls?.chaptersFeedUrl !== undefined;

type InFlightSections = {
  generation: number;
  promise: Promise<AddByRssItemSections | null>;
};

/**
 * Chapters and transcript for the Add by RSS item now playing, one item and session at a time.
 * Nothing here is written to disk. A failed fetch stays failed until `load` runs again.
 */
export function createAddByRssNowPlayingSectionsStore<Context>(deps: {
  fetchSections: (
    context: Context,
    source: AddByRssNowPlayingItemSource
  ) => Promise<AddByRssItemSections>;
  resolveSource: (
    resourceData: AddByRSSResourceData
  ) => Promise<AddByRssNowPlayingItemSource | null>;
}) {
  let snapshot = IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS;
  let generation = 0;
  let inFlight: InFlightSections | null = null;
  const listeners = new Set<() => void>();

  const setSnapshot = (next: AddByRssNowPlayingSectionsSnapshot): void => {
    snapshot = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const getSnapshot = (): AddByRssNowPlayingSectionsSnapshot => snapshot;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const track = (resourceData: AddByRSSResourceData | null): void => {
    const key = addByRssNowPlayingSectionsKey(resourceData);
    if (key === snapshot.key) {
      return;
    }

    generation += 1;
    inFlight = null;
    if (key === null || resourceData === null) {
      setSnapshot(IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS);
      return;
    }

    const trackGeneration = generation;
    setSnapshot({
      ...IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS,
      key,
      sourceStatus: 'resolving',
    });
    let started: Promise<AddByRssNowPlayingItemSource | null>;
    try {
      started = Promise.resolve(deps.resolveSource(resourceData));
    } catch (error) {
      started = Promise.reject(error);
    }
    void started.then(
      (source) => {
        if (trackGeneration !== generation) {
          return;
        }
        setSnapshot({
          ...snapshot,
          source,
          sourceStatus: source === null ? 'unavailable' : 'resolved',
        });
      },
      () => {
        if (trackGeneration !== generation) {
          return;
        }
        setSnapshot({
          ...snapshot,
          sourceStatus: 'unavailable',
        });
      }
    );
  };

  const load = (context: Context): Promise<AddByRssItemSections | null> => {
    const source = snapshot.source;
    if (source === null || source.sectionUrls === null) {
      return Promise.resolve(null);
    }
    if (snapshot.sectionsStatus === 'loaded') {
      return Promise.resolve(snapshot.sections);
    }
    if (inFlight !== null && inFlight.generation === generation) {
      return inFlight.promise;
    }

    const loadGeneration = generation;
    setSnapshot({ ...snapshot, sectionsStatus: 'loading' });
    let started: Promise<AddByRssItemSections>;
    try {
      started = Promise.resolve(deps.fetchSections(context, source));
    } catch (error) {
      started = Promise.reject(error);
    }
    const promise = started
      .then(
        (sections) => {
          if (loadGeneration !== generation) {
            return null;
          }
          setSnapshot({
            ...snapshot,
            sections,
            sectionsStatus: 'loaded',
          });
          return sections;
        },
        () => {
          if (loadGeneration !== generation) {
            return null;
          }
          setSnapshot({
            ...snapshot,
            sectionsStatus: 'error',
          });
          return null;
        }
      )
      .finally(() => {
        if (inFlight !== null && inFlight.generation === loadGeneration) {
          inFlight = null;
        }
      });
    inFlight = { generation: loadGeneration, promise };
    return promise;
  };

  const reset = (): void => {
    generation += 1;
    inFlight = null;
    setSnapshot(IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS);
  };

  return { getSnapshot, load, reset, subscribe, track };
}
