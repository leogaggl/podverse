import type { AddByRSSParseStatus, DTOChannel } from '@podverse/helpers';
import { buildAlbumPath, buildDTOChannelImageLoadCandidates } from '@podverse/helpers';

import type { AlbumListItem } from '../../../components/Common/Artist/Album/types';
import type { AddByRSSArtistAlbumEntry } from '../../../utils/addByRSS/publisherLinks';
import { albumListItemFromAddByRSSFeed } from '../../../utils/subscribed/channelListItems';

export type DirectoryAlbumChannels = ReadonlyMap<string, DTOChannel>;

/** Album rows for an Add by RSS artist page, in entry order. */
export const toAddByRSSArtistAlbumListItems = (input: {
  entries: readonly AddByRSSArtistAlbumEntry[];
  directoryChannels: DirectoryAlbumChannels;
  /** Hidden from the list because they sit in the needs-credentials section. */
  needsCredentialsIdTexts: ReadonlySet<string>;
  statusLabel: (status: AddByRSSParseStatus) => string;
  imageSize: number;
}): AlbumListItem[] => {
  const items: AlbumListItem[] = [];
  for (const entry of input.entries) {
    if (entry.kind === 'add_by_rss') {
      const { feed } = entry.source;
      if (input.needsCredentialsIdTexts.has(feed.idText)) {
        continue;
      }
      const item = albumListItemFromAddByRSSFeed(feed);
      if (feed.mappedFeed === undefined && feed.status !== undefined) {
        item.subtitle = input.statusLabel(feed.status);
      }
      items.push(item);
      continue;
    }
    const channel = input.directoryChannels.get(entry.channelIdText);
    items.push({
      id: `directory-${entry.channelIdText}`,
      title: channel?.title ?? entry.title,
      href: buildAlbumPath(entry.channelIdText),
      imageCandidates: channel
        ? buildDTOChannelImageLoadCandidates(channel.channel_images, input.imageSize, 'lesser')
        : undefined,
      subtitle: channel?.channel_about?.author ?? null,
    });
  }
  return items;
};
