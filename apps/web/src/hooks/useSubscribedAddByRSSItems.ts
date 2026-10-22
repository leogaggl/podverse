'use client';

import { useEffect, useState } from 'react';

import { PAGINATION } from '@podverse/helpers';

import { buildAddByRSSItemsIndex } from '../utils/addByRSS/itemIndex';
import { getAllAddByRSSFeeds, getAllAddByRSSItems } from '../utils/addByRSS/storage';
import type {
  AddByRSSFeedRecord,
  AddByRSSItemIndexItem,
  AddByRSSResourceType,
} from '../utils/addByRSS/types';
import { useReadyAddByRSSFeeds } from './useReadyAddByRSSFeeds';

const NEWEST_ITEM_LIMIT = PAGINATION.DEFAULT_LIMIT;

const EMPTY_ITEMS: AddByRSSItemIndexItem[] = [];

const LOADING_RESULT = { items: EMPTY_ITEMS, isReady: false };
const EMPTY_RESULT = { items: EMPTY_ITEMS, isReady: true };

type ItemRead = {
  feeds: readonly AddByRSSFeedRecord[];
  items: AddByRSSItemIndexItem[];
};

/** Newest first. An item with no publish date (`pubDateMs` 0) sorts after dated items. */
const compareNewestPubDate = (a: AddByRSSItemIndexItem, b: AddByRSSItemIndexItem): number => {
  const aUndated = a.pubDateMs === 0;
  const bUndated = b.pubDateMs === 0;
  if (aUndated && bUndated) {
    return 0;
  }
  if (aUndated) {
    return 1;
  }
  if (bUndated) {
    return -1;
  }
  return b.pubDateMs - a.pubDateMs;
};

const selectNewestItems = (
  indexed: readonly AddByRSSItemIndexItem[],
  readyChannelIds: ReadonlySet<string>
): AddByRSSItemIndexItem[] => {
  const selected = indexed.filter((item) => readyChannelIds.has(item.channelIdText));
  if (selected.length === 0) {
    return EMPTY_ITEMS;
  }
  selected.sort(compareNewestPubDate);
  if (selected.length <= NEWEST_ITEM_LIMIT) {
    return selected;
  }
  return selected.slice(0, NEWEST_ITEM_LIMIT);
};

/**
 * The newest Add by RSS items from ready feeds of the given types on this browser.
 *
 * Rebuilds the on-device item index from every stored feed, then keeps items whose channel is
 * one of those ready feeds. `isReady` stays false until that read finishes. An empty feed list
 * does no index work and follows the feeds hook.
 */
export function useSubscribedAddByRSSItems(resourceTypes: readonly AddByRSSResourceType[]): {
  items: AddByRSSItemIndexItem[];
  isReady: boolean;
} {
  const { feeds, isReady: feedsReady } = useReadyAddByRSSFeeds(resourceTypes);
  const [state, setState] = useState<ItemRead | null>(null);

  useEffect(() => {
    if (!feedsReady || feeds.length === 0) {
      return;
    }

    let cancelled = false;
    const readyChannelIds = new Set(feeds.map((feed) => feed.idText));

    void (async () => {
      try {
        const storedFeeds = await getAllAddByRSSFeeds();
        if (cancelled) {
          return;
        }
        await buildAddByRSSItemsIndex(storedFeeds);
        if (cancelled) {
          return;
        }
        const indexed = await getAllAddByRSSItems();
        if (cancelled) {
          return;
        }
        setState({ feeds, items: selectNewestItems(indexed, readyChannelIds) });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setState({ feeds, items: EMPTY_ITEMS });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [feeds, feedsReady]);

  if (!feedsReady) {
    return LOADING_RESULT;
  }
  if (feeds.length === 0) {
    return EMPTY_RESULT;
  }
  if (state === null || state.feeds !== feeds) {
    return LOADING_RESULT;
  }
  return { items: state.items, isReady: true };
}
