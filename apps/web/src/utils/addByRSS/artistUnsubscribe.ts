import { getApiRequestService } from '../../factories/apiRequestService';
import type { AddByRSSArtistFollowedAlbums } from '../../lib/artistUnsubscribe';
import { followedAddByRSSArtistAlbums } from '../../lib/artistUnsubscribe';
import { toAddByRSSComparableFeedUrl } from './listedFeeds';
import type { AddByRSSArtistAlbumEntry } from './publisherLinks';
import { mergeAddByRSSAlbumSources, resolveAddByRSSArtistAlbums } from './publisherLinks';
import {
  getAddByRSSPublisherLink,
  getAllAddByRSSFeeds,
  getAllListedAddByRSSFeeds,
} from './storage';
import type { AddByRSSFeedRecord } from './types';

/** Directory album channels loaded together while checking which ones are followed. */
const DIRECTORY_ALBUM_ID_FETCH_CHUNK = 5;

const directoryChannelIdTextsInOrder = (albums: readonly AddByRSSArtistAlbumEntry[]): string[] => {
  const channelIdTexts: string[] = [];
  const seen = new Set<string>();
  for (const album of albums) {
    if (album.kind !== 'directory' || seen.has(album.channelIdText)) {
      continue;
    }
    seen.add(album.channelIdText);
    channelIdTexts.push(album.channelIdText);
  }
  return channelIdTexts;
};

/**
 * Numeric channel ids for directory albums, a few at a time. A failed load is left out, so that
 * album counts as not followed.
 */
const loadDirectoryChannelIdsByIdText = async (
  channelIdTexts: readonly string[]
): Promise<Map<string, number>> => {
  const directoryChannelIdsByIdText = new Map<string, number>();
  const api = getApiRequestService();
  for (let offset = 0; offset < channelIdTexts.length; offset += DIRECTORY_ALBUM_ID_FETCH_CHUNK) {
    const chunk = channelIdTexts.slice(offset, offset + DIRECTORY_ALBUM_ID_FETCH_CHUNK);
    const results = await Promise.allSettled(
      chunk.map((channelIdText) => api.reqChannelGetByIdOrIdText(channelIdText))
    );
    for (let index = 0; index < results.length; index += 1) {
      const channelIdText = chunk[index];
      const result = results[index];
      if (channelIdText === undefined || result === undefined) {
        continue;
      }
      if (result.status === 'rejected') {
        console.error('Could not load a directory album to check its follow', {
          channelIdText,
          error: result.reason,
        });
        continue;
      }
      directoryChannelIdsByIdText.set(channelIdText, result.value.id);
    }
  }
  return directoryChannelIdsByIdText;
};

/** The albums of `artist` the member follows, read from this browser's stores. */
export const loadAddByRSSArtistFollowedAlbums = async (params: {
  artist: AddByRSSFeedRecord;
  followingChannelIds: ReadonlySet<number>;
}): Promise<AddByRSSArtistFollowedAlbums> => {
  const [followed, listed, link] = await Promise.all([
    getAllAddByRSSFeeds(),
    getAllListedAddByRSSFeeds(),
    getAddByRSSPublisherLink(toAddByRSSComparableFeedUrl(params.artist.feedUrl)),
  ]);
  const albums = resolveAddByRSSArtistAlbums({
    artist: params.artist,
    link,
    sources: mergeAddByRSSAlbumSources(followed, listed),
  });
  const directoryChannelIdTexts = directoryChannelIdTextsInOrder(albums);
  const directoryChannelIdsByIdText =
    params.followingChannelIds.size > 0 && directoryChannelIdTexts.length > 0
      ? await loadDirectoryChannelIdsByIdText(directoryChannelIdTexts)
      : new Map<string, number>();

  return followedAddByRSSArtistAlbums({
    albums,
    directoryChannelIdsByIdText,
    followingChannelIds: params.followingChannelIds,
  });
};
