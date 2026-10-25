import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { PlaybackTarget } from '@podverse/playback-core';
import type { AddByRSSAdjacentDirection } from '@podverse/playback-core/addByRSSListWalk';
import { resolveAddByRSSAdjacentStep } from '@podverse/playback-core/addByRSSListWalk';

import { addByRssRepository } from '../data';
import type { AddByRssFeedPlayEntry, AddByRssFeedWalk } from '../lib/addByRss/feedWalk';
import { buildAddByRssFeedWalk } from '../lib/addByRss/feedWalk';
import { loadLocalFeed } from '../lib/addByRss/localResourceData';
import { withCanonicalAddByRssFeedUrl } from '../lib/addByRss/resourceData';
import { playbackTargetRowMediaId } from '../lib/playback/buildPlaybackTarget';

export type UseAddByRssFeedWalkParams = {
  activeTargetRef: RefObject<PlaybackTarget | null>;
};

/** A built feed walk, keyed by the playback media id of the Add by RSS item it was built for. */
export type AddByRssFeedWalkState = { mediaId: string; walk: AddByRssFeedWalk };

export type UseAddByRssFeedWalkResult = {
  /** The walk for the Add by RSS item playing, keyed by its playback media id. */
  addByRssFeedWalkRef: RefObject<AddByRssFeedWalkState | null>;
  /** `addByRssFeedWalkRef` as state, so a consumer re-renders once a walk is built or cleared. */
  addByRssFeedWalk: AddByRssFeedWalkState | null;
  /** The playing Add by RSS item has a newer feed item; false while the walk is being built. */
  hasAddByRssNext: boolean;
  /** Synchronous `hasAddByRssNext` for the playing item, from the walk already built. */
  readHasAddByRssNext: () => boolean;
  ensureAddByRssFeedWalk: () => Promise<AddByRssFeedWalk | null>;
  resolveAddByRssAdjacentEntry: (
    direction: AddByRSSAdjacentDirection
  ) => Promise<AddByRssFeedPlayEntry | null>;
  clearAddByRssFeedWalk: () => void;
};

const playingAddByRss = (
  target: PlaybackTarget | null
): { mediaId: string; resourceData: AddByRSSResourceData } | null => {
  if (target === null || target.kind !== 'add-by-rss') {
    return null;
  }
  const mediaId = playbackTargetRowMediaId(target);
  return mediaId === null ? null : { mediaId, resourceData: target.resourceData };
};

const hasNextStep = (walk: AddByRssFeedWalk): boolean =>
  resolveAddByRSSAdjacentStep(walk.context, 'next').kind === 'step';

/** Null when the item names no feed, or this device's copy of the feed cannot be read. */
const loadFeedWalk = async (
  resourceData: AddByRSSResourceData
): Promise<AddByRssFeedWalk | null> => {
  const feedUrl = toNonEmptyTrimmedString(withCanonicalAddByRssFeedUrl(resourceData).feed_url);
  if (feedUrl === null) {
    return null;
  }
  try {
    const loaded = await loadLocalFeed(addByRssRepository, feedUrl);
    if (loaded === null) {
      return null;
    }
    return buildAddByRssFeedWalk(loaded.record, loaded.mappedFeed, resourceData);
  } catch (error) {
    if (__DEV__) {
      console.warn('[playback] Add by RSS feed walk failed', error);
    }
    return null;
  }
};

/**
 * Next and Previous through the playing Add by RSS item's feed, from this device's parsed copy.
 * The walk is rebuilt from the playing item after each load, so a step needs no saved list
 * position: the rebuilt context is the step's `nextContext`, and an item outside the feed has none.
 * A walk built for an item the listener has already left is never stored. Every returned callback
 * is stable.
 */
export function useAddByRssFeedWalk({
  activeTargetRef,
}: UseAddByRssFeedWalkParams): UseAddByRssFeedWalkResult {
  const addByRssFeedWalkRef = useRef<AddByRssFeedWalkState | null>(null);
  const [addByRssFeedWalk, setAddByRssFeedWalk] = useState<AddByRssFeedWalkState | null>(null);
  const inFlightRef = useRef<{
    mediaId: string;
    promise: Promise<AddByRssFeedWalk | null>;
  } | null>(null);
  /** Advanced by every new build and every clear; a build that finishes under a later id is dropped. */
  const buildIdRef = useRef(0);
  const [hasAddByRssNext, setHasAddByRssNext] = useState(false);

  const clearAddByRssFeedWalk = useCallback((): void => {
    buildIdRef.current += 1;
    addByRssFeedWalkRef.current = null;
    setAddByRssFeedWalk(null);
    inFlightRef.current = null;
    setHasAddByRssNext(false);
  }, []);

  const ensureAddByRssFeedWalk = useCallback(async (): Promise<AddByRssFeedWalk | null> => {
    const playing = playingAddByRss(activeTargetRef.current);
    if (playing === null) {
      clearAddByRssFeedWalk();
      return null;
    }
    const stored = addByRssFeedWalkRef.current;
    if (stored !== null && stored.mediaId === playing.mediaId) {
      return stored.walk;
    }
    const inFlight = inFlightRef.current;
    if (inFlight !== null && inFlight.mediaId === playing.mediaId) {
      return inFlight.promise;
    }
    if (stored !== null) {
      addByRssFeedWalkRef.current = null;
      setAddByRssFeedWalk(null);
      setHasAddByRssNext(false);
    }

    buildIdRef.current += 1;
    const buildId = buildIdRef.current;
    const promise = loadFeedWalk(playing.resourceData).then((walk) => {
      if (buildIdRef.current !== buildId) {
        return null;
      }
      inFlightRef.current = null;
      if (walk === null || playingAddByRss(activeTargetRef.current)?.mediaId !== playing.mediaId) {
        return null;
      }
      const built = { mediaId: playing.mediaId, walk };
      addByRssFeedWalkRef.current = built;
      setAddByRssFeedWalk(built);
      setHasAddByRssNext(hasNextStep(walk));
      return walk;
    });
    inFlightRef.current = { mediaId: playing.mediaId, promise };
    return promise;
  }, [activeTargetRef, clearAddByRssFeedWalk]);

  const readHasAddByRssNext = useCallback((): boolean => {
    const playing = playingAddByRss(activeTargetRef.current);
    const stored = addByRssFeedWalkRef.current;
    return (
      playing !== null &&
      stored !== null &&
      stored.mediaId === playing.mediaId &&
      hasNextStep(stored.walk)
    );
  }, [activeTargetRef]);

  const resolveAddByRssAdjacentEntry = useCallback(
    async (direction: AddByRSSAdjacentDirection): Promise<AddByRssFeedPlayEntry | null> => {
      const walk = await ensureAddByRssFeedWalk();
      if (walk === null) {
        return null;
      }
      const step = resolveAddByRSSAdjacentStep(walk.context, direction);
      if (step.kind !== 'step') {
        return null;
      }
      return walk.entries.get(step.idText) ?? null;
    },
    [ensureAddByRssFeedWalk]
  );

  return {
    addByRssFeedWalk,
    addByRssFeedWalkRef,
    clearAddByRssFeedWalk,
    ensureAddByRssFeedWalk,
    hasAddByRssNext,
    readHasAddByRssNext,
    resolveAddByRssAdjacentEntry,
  };
}
