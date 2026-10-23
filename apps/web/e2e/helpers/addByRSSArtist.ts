import type { Page } from '@playwright/test';

import type { AddByRSSPublisherListedFeed } from '@podverse/helpers';

import type { StubbedParseOutcome } from './addByRSSCredentials';
import { corsHeaders, E2E_API_BASE_URL } from './addByRSSCredentials';
import { E2E_MUSIC_ALBUM_ID_TEXT, E2E_MUSIC_ALBUM_TITLE } from './seedConstants';

/** Fixed fixture guids and URLs. `.example` hosts are never fetched; every parse is stubbed. */
export const ARTIST_FEED_URL = 'https://e2e-rss-artist.example/artist.xml';
export const ARTIST_GUID = 'e2e0a77a-0000-4000-8000-0000000000c1';
export const ARTIST_TITLE = 'E2E RSS Artist';
export const ALBUM_FEED_URL = 'https://e2e-rss-artist.example/album.xml';
export const ALBUM_GUID = 'e2e0a1b0-0000-4000-8000-0000000000c2';
export const ALBUM_TITLE = 'E2E RSS Listed Album';
export const TRACK_TITLE = 'E2E RSS Listed Track';
export const TRACK_GUID = 'e2e-rss-listed-track-1';
export const LIVE_TITLE = 'Listed Live';
export const ALBUM_REQUEST_ID = 'e2e-artist-album-0';
/** The seeded directory artist and album in tools/web/seed-e2e.mjs. */
export const DIRECTORY_ARTIST_GUID = '11111111-2222-4333-8444-555555555502';
export const DIRECTORY_ARTIST_FEED_URL = 'https://e2e-seed-music.example/artist.xml';
export const DIRECTORY_ALBUM_GUID = '11111111-2222-4333-8444-555555555501';
export const DIRECTORY_ALBUM_FEED_URL = 'https://e2e-seed-music.example/album.xml';

const FEED_LINK = 'http://localhost:2111/';
const AUDIO_ENCLOSURE = {
  url: 'http://localhost:2111/audio/audio-001.mp3',
  type: 'audio/mpeg',
  length: 0,
};

/** Partytime-shaped artist feed: a publisher that lists the Add by RSS album and the directory album. */
export const ARTIST_FEED = {
  title: ARTIST_TITLE,
  link: FEED_LINK,
  description: 'E2E Add by RSS artist fixture',
  explicit: false,
  medium: 'publisher',
  guid: ARTIST_GUID,
  items: [],
  podcastRemoteItems: [
    { feedGuid: ALBUM_GUID, feedUrl: ALBUM_FEED_URL, medium: 'music', title: ALBUM_TITLE },
    {
      feedGuid: DIRECTORY_ALBUM_GUID,
      feedUrl: DIRECTORY_ALBUM_FEED_URL,
      medium: 'music',
      title: E2E_MUSIC_ALBUM_TITLE,
    },
  ],
};

/**
 * Partytime-shaped album feed. Its publisher pointer names the seeded directory artist, so it
 * shows on that artist's page; the Add by RSS artist lists it, so the player and track byline
 * name the Add by RSS artist.
 */
export const ALBUM_FEED = {
  title: ALBUM_TITLE,
  link: FEED_LINK,
  description: 'E2E Add by RSS listed album fixture',
  explicit: false,
  medium: 'music',
  guid: ALBUM_GUID,
  podcastPublisher: {
    feedGuid: DIRECTORY_ARTIST_GUID,
    feedUrl: DIRECTORY_ARTIST_FEED_URL,
    medium: 'publisher',
  },
  items: [
    {
      title: TRACK_TITLE,
      guid: TRACK_GUID,
      duration: 61,
      explicit: false,
      enclosure: AUDIO_ENCLOSURE,
      pubDate: '2025-07-02T11:21:52.000Z',
    },
  ],
  podcastLiveItems: [
    {
      guid: 'e2e-rss-listed-live-1',
      title: LIVE_TITLE,
      status: 'live',
      start: '2025-07-02T15:00:00.000Z',
      enclosure: AUDIO_ENCLOSURE,
    },
  ],
};

export const ARTIST_LISTED_FEEDS: AddByRSSPublisherListedFeed[] = [
  {
    kind: 'add_by_rss',
    feedGuid: ALBUM_GUID,
    feedUrl: ALBUM_FEED_URL,
    title: ALBUM_TITLE,
    listedAtChannelLevel: true,
    itemGuids: [],
    requestId: ALBUM_REQUEST_ID,
  },
  {
    kind: 'directory',
    feedGuid: DIRECTORY_ALBUM_GUID,
    feedUrl: DIRECTORY_ALBUM_FEED_URL,
    title: E2E_MUSIC_ALBUM_TITLE,
    listedAtChannelLevel: true,
    itemGuids: [],
    channelIdText: E2E_MUSIC_ALBUM_ID_TEXT,
    channelTitle: E2E_MUSIC_ALBUM_TITLE,
    mediumId: 3,
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Answers status polls for one request id the stubbed artist parse handed out for a listed
 * album. Register after `stubAddByRSSParse`: Playwright runs the newest route first, and other
 * ids fall back to the earlier stub.
 */
export async function stubAddByRSSParseStatusForRequest(
  page: Page,
  params: { requestId: string; feedUrl: string; outcome: StubbedParseOutcome }
): Promise<void> {
  const { requestId, feedUrl, outcome } = params;
  await page.route('**/account/add-by-rss/parse/status/*', async (route) => {
    const routeRequestId = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    if (routeRequestId !== requestId) {
      await route.fallback();
      return;
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route),
        body: JSON.stringify({
          requestId,
          feedUrl,
          updatedAt: new Date().toISOString(),
          ...outcome,
        }),
      });
    } catch {
      // The request was aborted with its page.
    }
  });
}

/**
 * Playing an Add by RSS track records it as now-playing on the account's queue for its medium.
 * Removes that row from every account queue so a later spec's player does not load the track.
 * Best effort: a queue without that row is left as it is.
 */
export async function removeAddByRSSNowPlayingFromQueues(
  page: Page,
  itemGuid: string
): Promise<void> {
  const queuesResponse = await page.request.get(
    `${E2E_API_BASE_URL}/queue/all-for-account/private`
  );
  if (!queuesResponse.ok()) {
    return;
  }
  const queues: unknown = await queuesResponse.json();
  if (!Array.isArray(queues)) {
    return;
  }
  for (const queue of queues) {
    if (!isRecord(queue) || typeof queue['id_text'] !== 'string') {
      continue;
    }
    const queueUrl = `${E2E_API_BASE_URL}/queue/${queue['id_text']}`;
    const nowPlayingResponse = await page.request.get(`${queueUrl}/resources/now-playing`);
    if (!nowPlayingResponse.ok()) {
      continue;
    }
    const nowPlaying: unknown = await nowPlayingResponse.json().catch(() => null);
    if (!isRecord(nowPlaying)) {
      continue;
    }
    const resourceData = nowPlaying['add_by_rss_resource_data'];
    const hashId = nowPlaying['add_by_rss_hash_id'];
    if (isRecord(resourceData) && resourceData['guid'] === itemGuid && typeof hashId === 'string') {
      await page.request.delete(`${queueUrl}/item-add-by-rss/${hashId}`);
    }
  }
}
