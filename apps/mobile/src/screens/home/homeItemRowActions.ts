export type HomeItemActionRow = {
  id: string;
  source?: 'addByRss' | 'directory';
};

/** Download item for a Home Episodes or Tracks row, or undefined when the row has none. */
export const homeItemDownloadItem = <TItem>(
  row: HomeItemActionRow,
  sources: {
    addByRssItemsById: ReadonlyMap<string, { downloadItem: TItem | null }>;
    directoryItemsById: ReadonlyMap<string, TItem>;
  }
): TItem | undefined => {
  if (row.source === 'addByRss') {
    const item = sources.addByRssItemsById.get(row.id);
    if (item === undefined || item.downloadItem === null) {
      return undefined;
    }
    return item.downloadItem;
  }
  return sources.directoryItemsById.get(row.id);
};

/**
 * Public page a directory Home item can share. Add by RSS returns null.
 *
 * A directory livestream's page is the episode page, so it shares that URL.
 */
export const homeItemShareResource = (
  row: HomeItemActionRow,
  mediaType: 'episodes' | 'tracks' | 'livestreams'
): 'episode' | 'track' | null => {
  if (row.source === 'addByRss') {
    return null;
  }
  return mediaType === 'tracks' ? 'track' : 'episode';
};
