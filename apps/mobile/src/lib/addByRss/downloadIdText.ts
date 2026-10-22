/**
 * Download index id for one add-by-RSS item.
 *
 * Auto-download and the channel Downloaded list both name a finished download by the feed URL
 * plus the item's guid, so the two cannot drift.
 */
export const addByRssDownloadItemIdText = (
  feedUrl: string,
  item: { guid?: string | null; guid_enclosure_url?: string | null },
  index: number
): string => `${feedUrl}::${item.guid ?? item.guid_enclosure_url ?? String(index)}`;
