import type { DTOItem } from '@podverse/helpers/dto';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { addByRssDownloadItemIdText } from './downloadIdText';

/**
 * The partial item a download of one Add by RSS episode is enqueued with. Its channel id is the
 * feed URL, which is how the download manager recognizes Add by RSS rows.
 */
export const addByRssDownloadItem = (
  feedUrl: string,
  itemBundle: AddByRSSMappedFeed['items'][number],
  index: number
): DTOItem | null => {
  const idText = addByRssDownloadItemIdText(feedUrl, itemBundle.item, index);
  const enclosures = itemBundle.enclosures ?? [];
  if (enclosures.length === 0) {
    return null;
  }

  const pubDate =
    itemBundle.item.pub_date instanceof Date
      ? itemBundle.item.pub_date.toISOString()
      : itemBundle.item.pub_date !== null && itemBundle.item.pub_date !== undefined
        ? String(itemBundle.item.pub_date)
        : null;

  // The object holds only the fields download eligibility and the download manager read.
  return {
    id_text: idText,
    pub_date: pubDate,
    title: itemBundle.item.title ?? null,
    live_item: null,
    channel: { id_text: feedUrl },
    item_enclosures: enclosures.map((enclosure) => ({
      type: enclosure.item_enclosure?.type ?? null,
      item_enclosure_sources: (enclosure.item_enclosure_sources ?? []).map((source) => ({
        uri: source.uri,
      })),
    })),
  } as DTOItem;
};
