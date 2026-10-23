import { buildAddByRSSItemsIndex, buildItemIdTextMap, toAddByRSSItemIndexItem } from './itemIndex';
import { getAddByRSSItemGuidKey, listedAddByRSSTrackIndexItems } from './listedFeeds';
import type { AddByRSSArtistTrackRef } from './publisherLinks';
import { getAllAddByRSSFeeds } from './storage';
import type { AddByRSSFeedRecord, AddByRSSItemIndexItem, AddByRSSMappedFeed } from './types';

const indexIdFor = (
  feed: AddByRSSFeedRecord,
  bundle: AddByRSSMappedFeed['items'][number],
  index: number
): string => `${feed.idText}-${getAddByRSSItemGuidKey(feed, bundle, index)}`;

const hasUnindexedItem = (
  refs: readonly AddByRSSArtistTrackRef[],
  map: ReadonlyMap<string, string>
): boolean =>
  refs.some(
    (ref) =>
      ref.source.followed &&
      (ref.source.feed.mappedFeed?.items ?? []).some(
        (bundle, index) => !map.has(indexIdFor(ref.source.feed, bundle, index))
      )
  );

/**
 * Track rows for Add by RSS albums. Followed albums use the items index idTexts (building the
 * index from every followed feed when one is missing); listed albums use their stored idTexts
 * and never enter the index.
 */
export const loadAddByRSSAlbumTrackIndexItems = async (
  refs: readonly AddByRSSArtistTrackRef[]
): Promise<AddByRSSItemIndexItem[]> => {
  let map = await buildItemIdTextMap();
  if (hasUnindexedItem(refs, map)) {
    // The builder replaces the whole index, so it always gets every followed feed.
    await buildAddByRSSItemsIndex(await getAllAddByRSSFeeds());
    map = await buildItemIdTextMap();
  }

  const items: AddByRSSItemIndexItem[] = [];
  for (const ref of refs) {
    const { source, itemGuids } = ref;
    const albumItems = source.followed
      ? (source.feed.mappedFeed?.items ?? []).map((bundle, index) =>
          toAddByRSSItemIndexItem(
            source.feed,
            bundle,
            index,
            map.get(indexIdFor(source.feed, bundle, index))
          )
        )
      : listedAddByRSSTrackIndexItems(source.feed);
    for (const item of albumItems) {
      if (itemGuids === null || itemGuids.has(item.itemGuid.trim())) {
        items.push(item);
      }
    }
  }
  return items;
};
