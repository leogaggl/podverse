import type { DTOChannel } from '@podverse/helpers';

import { toAddByRSSComparableFeedUrl } from '../utils/addByRSS/listedFeeds';
import type { AddByRSSArtistAlbumEntry } from '../utils/addByRSS/publisherLinks';

/** Which body sentence the unsubscribe-from-artist dialog shows for `count` followed albums. */
export const unsubscribeArtistBodyKey = (
  count: number
): 'unsubscribe_artist.followed_one_album' | 'unsubscribe_artist.followed_albums' =>
  count === 1 ? 'unsubscribe_artist.followed_one_album' : 'unsubscribe_artist.followed_albums';

/**
 * The artist's verified albums the member follows, as `id_text`s in album order, each once.
 * Never the artist itself, never an album with an empty `id_text`.
 */
export const followedDirectoryArtistAlbumIdTexts = (input: {
  artistIdText: string;
  albums: readonly Pick<DTOChannel, 'id' | 'id_text'>[];
  followingChannelIds: ReadonlySet<number>;
}): string[] => {
  const seen = new Set<string>();
  const idTexts: string[] = [];

  for (const album of input.albums) {
    const idText = album.id_text;
    if (idText === '' || idText === input.artistIdText) {
      continue;
    }
    if (!input.followingChannelIds.has(album.id) || seen.has(idText)) {
      continue;
    }
    seen.add(idText);
    idTexts.push(idText);
  }

  return idTexts;
};

/** Albums of an Add by RSS artist the member follows, split by where each follow lives. */
export type AddByRSSArtistFollowedAlbums = {
  addByRSSFeeds: { feedUrl: string; idText: string }[];
  directoryChannelIdTexts: string[];
};

export const countAddByRSSArtistFollowedAlbums = (albums: AddByRSSArtistFollowedAlbums): number =>
  albums.addByRSSFeeds.length + albums.directoryChannelIdTexts.length;

/**
 * Add by RSS entries count when their source is followed (a listed-only album never does).
 * Directory entries count when their channel id is in the account's follows. Entry order, each
 * album once. Add by RSS feeds compare by canonical feed URL, which keeps the scheme.
 */
export const followedAddByRSSArtistAlbums = (input: {
  albums: readonly AddByRSSArtistAlbumEntry[];
  directoryChannelIdsByIdText: ReadonlyMap<string, number>;
  followingChannelIds: ReadonlySet<number>;
}): AddByRSSArtistFollowedAlbums => {
  const addByRSSFeeds: AddByRSSArtistFollowedAlbums['addByRSSFeeds'] = [];
  const directoryChannelIdTexts: string[] = [];
  const seenFeedUrls = new Set<string>();
  const seenDirectoryChannelIdTexts = new Set<string>();

  for (const album of input.albums) {
    if (album.kind === 'add_by_rss') {
      if (!album.source.followed) {
        continue;
      }
      const comparableFeedUrl = toAddByRSSComparableFeedUrl(album.source.feed.feedUrl);
      if (seenFeedUrls.has(comparableFeedUrl)) {
        continue;
      }
      seenFeedUrls.add(comparableFeedUrl);
      addByRSSFeeds.push({
        feedUrl: album.source.feed.feedUrl,
        idText: album.source.feed.idText,
      });
      continue;
    }

    if (seenDirectoryChannelIdTexts.has(album.channelIdText)) {
      continue;
    }
    const channelId = input.directoryChannelIdsByIdText.get(album.channelIdText);
    if (channelId === undefined || !input.followingChannelIds.has(channelId)) {
      continue;
    }
    seenDirectoryChannelIdTexts.add(album.channelIdText);
    directoryChannelIdTexts.push(album.channelIdText);
  }

  return { addByRSSFeeds, directoryChannelIdTexts };
};
