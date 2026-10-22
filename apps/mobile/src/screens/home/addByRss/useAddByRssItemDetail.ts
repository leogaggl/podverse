import { useCallback, useEffect, useRef, useState } from 'react';

import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { addByRssRepository } from '../../../data/repositories';
import type { AddByRssLiveItemDetail } from '../../../lib/addByRss/liveItemDetail';
import { findAddByRssLiveItemDetail } from '../../../lib/addByRss/liveItemDetail';
import type { MobileAddByRSSFeedRecord } from '../../../prefs/addByRSSFeeds';
import type { AddByRssHomeEpisode } from '../addByRssHomeDetailData';
import { buildAddByRssHomeDetailData } from '../addByRssHomeDetailData';

type AddByRssFeedSelection<T> = {
  errorKey: string | null;
  feed: MobileAddByRSSFeedRecord | null;
  isLoading: boolean;
  mappedFeed: AddByRSSMappedFeed | null;
  reload: () => void;
  selected: T | null;
};

const selectAddByRssHomeEpisode = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  itemKey: string
): AddByRssHomeEpisode | null => {
  const match = buildAddByRssHomeDetailData(feed, mappedFeed).episodeRows.find(
    (row) => row.itemKey === itemKey
  );
  return match ?? null;
};

const selectAddByRssLiveItem = (
  _feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  liveItemKey: string
): AddByRssLiveItemDetail | null => findAddByRssLiveItemDetail(mappedFeed, liveItemKey);

/**
 * The feed and its parsed bundle, plus one value chosen from that bundle.
 *
 * A missing feed or selection is `errors.generic`. A feed that has not been parsed yet is
 * `features.add_by_rss.status_processing`. A newer request ignores a slower one.
 */
function useAddByRssFeedSelection<T>(input: {
  feedIdText: string;
  key: string;
  select: (
    feed: MobileAddByRSSFeedRecord,
    mappedFeed: AddByRSSMappedFeed,
    key: string
  ) => T | null;
}): AddByRssFeedSelection<T> {
  const feedIdText = input.feedIdText;
  const key = input.key;
  const select = input.select;
  const [feed, setFeed] = useState<MobileAddByRSSFeedRecord | null>(null);
  const [mappedFeed, setMappedFeed] = useState<AddByRSSMappedFeed | null>(null);
  const [selected, setSelected] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const routeKey = `${feedIdText}\n${key}`;
  const [loadedKey, setLoadedKey] = useState(routeKey);
  if (loadedKey !== routeKey) {
    setLoadedKey(routeKey);
    setFeed(null);
    setMappedFeed(null);
    setSelected(null);
    setIsLoading(true);
    setErrorKey(null);
  }

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorKey(null);
    try {
      const nextFeed = await addByRssRepository.getFeedByIdText(feedIdText);
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (nextFeed === null) {
        setFeed(null);
        setMappedFeed(null);
        setSelected(null);
        setErrorKey('errors.generic');
        return;
      }

      const nextMappedFeed = await addByRssRepository.getMappedFeedByUrl(nextFeed.feedUrl);
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (nextMappedFeed === null) {
        setFeed(nextFeed);
        setMappedFeed(null);
        setSelected(null);
        setErrorKey('features.add_by_rss.status_processing');
        return;
      }

      const nextSelected = select(nextFeed, nextMappedFeed, key);
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (nextSelected === null) {
        setFeed(nextFeed);
        setMappedFeed(nextMappedFeed);
        setSelected(null);
        setErrorKey('errors.generic');
        return;
      }

      setFeed(nextFeed);
      setMappedFeed(nextMappedFeed);
      setSelected(nextSelected);
      setErrorKey(null);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setFeed(null);
      setMappedFeed(null);
      setSelected(null);
      setErrorKey('errors.generic');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [feedIdText, key, select]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { errorKey, feed, isLoading, mappedFeed, reload, selected };
}

/**
 * The feed, its parsed bundle, and one item of it, read from the device for an item page.
 */
export function useAddByRssItemDetail(input: { feedIdText: string; itemKey: string }): {
  errorKey: string | null;
  feed: MobileAddByRSSFeedRecord | null;
  isLoading: boolean;
  item: AddByRssHomeEpisode | null;
  mappedFeed: AddByRSSMappedFeed | null;
  reload: () => void;
} {
  const { errorKey, feed, isLoading, mappedFeed, reload, selected } = useAddByRssFeedSelection({
    feedIdText: input.feedIdText,
    key: input.itemKey,
    select: selectAddByRssHomeEpisode,
  });

  return { errorKey, feed, isLoading, item: selected, mappedFeed, reload };
}

/**
 * The feed, its parsed bundle, and one livestream of it, read from the device.
 */
export function useAddByRssLiveItemDetail(input: {
  feedIdText: string;
  liveItemKey: string;
}): {
  errorKey: string | null;
  feed: MobileAddByRSSFeedRecord | null;
  isLoading: boolean;
  liveItem: AddByRssLiveItemDetail | null;
  mappedFeed: AddByRSSMappedFeed | null;
  reload: () => void;
} {
  const { errorKey, feed, isLoading, mappedFeed, reload, selected } = useAddByRssFeedSelection({
    feedIdText: input.feedIdText,
    key: input.liveItemKey,
    select: selectAddByRssLiveItem,
  });

  return { errorKey, feed, isLoading, liveItem: selected, mappedFeed, reload };
}
