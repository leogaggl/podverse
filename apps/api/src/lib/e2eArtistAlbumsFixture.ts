import type {
  PodcastBatchByFeedGuidResponse,
  PodcastByIdFeed,
  PodcastIndexPodcastByIdResponse,
} from '@podverse/helpers';

/** Fixtures-only Not Yet Added album on the seeded E2E artist (`e2eMusicChnl01`). */
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555504';

/**
 * Below Podcast Index's mock id range (`TEST_PODCAST_INDEX_ID_MIN` = 2147483640) so fixtures
 * mode and that mock never share an id.
 */
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID = 2147483631;

export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL =
  'https://e2e-seed-music.example/album-not-yet-added.xml';

export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE = 'E2E Not Yet Added Album';

/** Same device-reachable artwork URL as `buildE2eUnparsedSearchFeed`. */
const E2E_ARTIST_NOT_YET_ADDED_ALBUM_IMAGE_URL =
  'http://localhost:2111/e2e/images/e2e-embed-channel-art-1400.png';

const buildE2eArtistNotYetAddedAlbumBase = (): PodcastByIdFeed => {
  return {
    id: E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID,
    podcastGuid: E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID,
    medium: 'music',
    title: E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE,
    url: E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL,
    originalUrl: E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL,
    link: '',
    description: '',
    author: 'E2E Music Artist',
    ownerName: 'E2E Music Artist',
    image: E2E_ARTIST_NOT_YET_ADDED_ALBUM_IMAGE_URL,
    artwork: E2E_ARTIST_NOT_YET_ADDED_ALBUM_IMAGE_URL,
    lastUpdateTime: 0,
    lastCrawlTime: 0,
    lastParseTime: 0,
    lastGoodHttpStatusTime: 0,
    lastHttpStatus: 0,
    contentType: '',
    itunesId: 0,
    itunesType: '',
    generator: '',
    language: '',
    explicit: false,
    type: 0,
    dead: 0,
    chash: '',
    episodeCount: 0,
    crawlErrors: 0,
    parseErrors: 0,
    categories: {},
    locked: 0,
    imageUrlHash: 0,
  };
};

export const buildE2eArtistNotYetAddedAlbumFeed =
  (): PodcastBatchByFeedGuidResponse['feeds'][number] => {
    return buildE2eArtistNotYetAddedAlbumBase();
  };

export const buildE2eArtistNotYetAddedAlbumByIdResponse = (): PodcastIndexPodcastByIdResponse => {
  const feed = buildE2eArtistNotYetAddedAlbumBase();
  return {
    status: 'true',
    query: { id: String(feed.id) },
    feed,
    description: 'Found matching feeds.',
  };
};

const guidsMatch = (left: string, right: string): boolean => {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
};

/** Feed for this guid, or null when fixtures mode has no album for it. */
export const findE2eArtistAlbumFeedByGuid = (
  guid: string
): PodcastBatchByFeedGuidResponse['feeds'][number] | null => {
  if (guidsMatch(guid, E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID)) {
    return buildE2eArtistNotYetAddedAlbumFeed();
  }
  return null;
};

/** Feed for this URL, or null when fixtures mode has no album for it. Comparison is exact after trim. */
export const findE2eArtistAlbumFeedByUrl = (
  url: string
): PodcastBatchByFeedGuidResponse['feeds'][number] | null => {
  if (url.trim() === E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL) {
    return buildE2eArtistNotYetAddedAlbumFeed();
  }
  return null;
};
