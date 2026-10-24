import type { SubscriptionSource } from '../../data/repositories';
import type { AddByRssArtistAlbumEntry } from '../home/addByRss/addByRssArtistAlbums';

export type ArtistUnsubscribeChoice = 'artist_only' | 'artist_and_albums';
export type ArtistFollowTarget = { idText: string; source: SubscriptionSource };

/** Verified albums this device follows, in album order, each once. Never the artist. */
export const followedDirectoryArtistAlbums = (input: {
  artistIdText: string;
  verifiedAlbumIdTexts: readonly string[];
  subscribedDirectoryIdTexts: ReadonlySet<string>;
}): ArtistFollowTarget[] => {
  const artistIdText = input.artistIdText.trim();
  const seen = new Set<string>();
  const albums: ArtistFollowTarget[] = [];
  for (const rawIdText of input.verifiedAlbumIdTexts) {
    const idText = rawIdText.trim();
    if (
      idText.length === 0 ||
      idText === artistIdText ||
      seen.has(idText) ||
      !input.subscribedDirectoryIdTexts.has(idText)
    ) {
      continue;
    }
    seen.add(idText);
    albums.push({ idText, source: 'directory' });
  }
  return albums;
};

/**
 * Albums of an Add by RSS artist this device follows: Add by RSS rows that are followed (feed URL
 * as id) and directory albums in `subscribed_channel`. Entry order, each once, never the artist.
 */
export const followedAddByRssArtistAlbums = (input: {
  artistFeedUrl: string;
  albums: readonly AddByRssArtistAlbumEntry[];
  subscribedDirectoryIdTexts: ReadonlySet<string>;
}): ArtistFollowTarget[] => {
  const artistFeedUrl = input.artistFeedUrl.trim();
  const seenFeedUrls = new Set<string>();
  const seenChannelIdTexts = new Set<string>();
  const albums: ArtistFollowTarget[] = [];
  for (const entry of input.albums) {
    if (entry.kind === 'add-by-rss') {
      const feedUrl = entry.feed.feedUrl.trim();
      if (
        feedUrl.length === 0 ||
        feedUrl === artistFeedUrl ||
        entry.feed.followed === false ||
        seenFeedUrls.has(feedUrl)
      ) {
        continue;
      }
      seenFeedUrls.add(feedUrl);
      albums.push({ idText: feedUrl, source: 'addByRss' });
      continue;
    }
    const idText = entry.channelIdText.trim();
    if (
      idText.length === 0 ||
      seenChannelIdTexts.has(idText) ||
      !input.subscribedDirectoryIdTexts.has(idText)
    ) {
      continue;
    }
    seenChannelIdTexts.add(idText);
    albums.push({ idText, source: 'directory' });
  }
  return albums;
};

/** What a choice ends: the artist first, then the albums for Artist and Albums. */
export const artistUnsubscribeTargets = (input: {
  artist: ArtistFollowTarget;
  albums: readonly ArtistFollowTarget[];
  choice: ArtistUnsubscribeChoice;
}): ArtistFollowTarget[] =>
  input.choice === 'artist_only' ? [input.artist] : [input.artist, ...input.albums];

export const unsubscribeArtistBodyKey = (
  count: number
):
  | 'features.unsubscribe_artist.followed_one_album'
  | 'features.unsubscribe_artist.followed_albums' =>
  count === 1
    ? 'features.unsubscribe_artist.followed_one_album'
    : 'features.unsubscribe_artist.followed_albums';
