import { useEffect, useMemo, useSyncExternalStore } from 'react';

import type { AddByRSSResourceData, DTOItemChapter } from '@podverse/helpers/dto';

import type { MobileAuthRequestContext } from '../data';
import { addByRssRepository, segmentsRepository } from '../data';
import { resolveAddByRssNowPlayingItemSource } from '../lib/addByRss/localResourceData';
import type { AddByRssNowPlayingSectionsSnapshot } from './addByRssNowPlayingSectionsStore';
import {
  addByRssNowPlayingSectionsKey,
  createAddByRssNowPlayingSectionsStore,
  IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS,
} from './addByRssNowPlayingSectionsStore';

/** Chapters and transcript for the Add by RSS item now playing. Cleared on sign-out. */
export const nowPlayingAddByRssSections =
  createAddByRssNowPlayingSectionsStore<MobileAuthRequestContext>({
    fetchSections: (context, source) =>
      segmentsRepository.getAddByRssChaptersAndTranscript(context, {
        feedUrl: source.feedUrl,
        itemBundle: source.itemBundle,
        itemIdText: source.itemIdText,
      }),
    resolveSource: (resourceData) =>
      resolveAddByRssNowPlayingItemSource(resourceData, {
        getFeedByUrl: (feedUrl) => addByRssRepository.getFeedByUrl(feedUrl),
        getMappedFeedByUrl: (feedUrl) => addByRssRepository.getMappedFeedByUrl(feedUrl),
      }),
  });

/**
 * The now-playing Add by RSS sections for this resource. A render never shows the previous
 * item's sections. After a reset, the effect tracks the current item again.
 */
export function useNowPlayingAddByRssSections(
  resourceData: AddByRSSResourceData | null
): AddByRssNowPlayingSectionsSnapshot {
  const snapshot = useSyncExternalStore(
    nowPlayingAddByRssSections.subscribe,
    nowPlayingAddByRssSections.getSnapshot,
    nowPlayingAddByRssSections.getSnapshot
  );
  const key = useMemo(() => addByRssNowPlayingSectionsKey(resourceData), [resourceData]);

  useEffect(() => {
    nowPlayingAddByRssSections.track(resourceData);
  }, [resourceData, snapshot.key]);

  return snapshot.key === key ? snapshot : IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS;
}

/**
 * Chapters already loaded for transport prev/next. Joins a request that is already in flight
 * and never starts one.
 */
export const resolveNowPlayingAddByRssChapters = async (
  context: MobileAuthRequestContext,
  resourceData: AddByRSSResourceData
): Promise<DTOItemChapter[]> => {
  const key = addByRssNowPlayingSectionsKey(resourceData);
  const snapshot = nowPlayingAddByRssSections.getSnapshot();
  if (key === null || snapshot.key !== key) {
    return [];
  }
  if (snapshot.sectionsStatus === 'loading') {
    return (await nowPlayingAddByRssSections.load(context))?.chapters ?? [];
  }
  return snapshot.sections?.chapters ?? [];
};
