import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '@podverse/helpers';
import { convertParsedRSSFeedToCompat, Phase4LiveStatus } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import { toAddByRssLiveItemPlaybackResourceData } from './domain';
import { toAddByRssFeedLiveRows, toAddByRssLiveRows } from './liveRows';
import { addByRssPlaybackMediaId } from './resourceData';

const feed = (): MobileAddByRSSFeedRecord => ({
  enclosureUrl: null,
  feedUrl: 'https://example.com/show.xml',
  id: 1,
  idText: 'rss-live',
  imageUrl: 'https://example.com/art.jpg',
  latestItemPubDateMs: null,
  playbackPosition: '0',
  resourceType: 'podcasts',
  title: 'Show Name',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const liveItem = (
  guid: string,
  title: string,
  status: Phase4LiveStatus,
  start: string,
  end?: string
) => ({
  contentLinks: [],
  enclosure: { length: 1, type: 'audio/mpeg', url: `https://example.com/${guid}.mp3` },
  ...(end !== undefined ? { end: new Date(end) } : {}),
  guid,
  start: new Date(start),
  status,
  title,
});

describe('toAddByRssLiveRows', () => {
  it('keeps live and scheduled rows, drops ended, and stamps the playback id', () => {
    const record = feed();
    const mappedFeed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [],
      link: 'https://example.com',
      podcastLiveItems: [
        liveItem('on-air', 'On Air', Phase4LiveStatus.Live, '2026-06-01T15:00:00.000Z'),
        liveItem('later', 'Later', Phase4LiveStatus.Pending, '2026-06-02T15:00:00.000Z'),
        liveItem('over', 'Over', Phase4LiveStatus.Ended, '2026-05-01T15:00:00.000Z'),
      ],
      title: 'Show Name',
    });

    const rows = toAddByRssLiveRows(record, mappedFeed, new Date('2026-06-01T12:00:00.000Z'));
    const live = rows.find((row) => row.target.liveIndex === 0);
    const pending = rows.find((row) => row.target.liveIndex === 1);
    const liveBundle = mappedFeed.liveItems[0];
    const pendingBundle = mappedFeed.liveItems[1];

    expect(rows).toHaveLength(2);
    expect(live).toBeDefined();
    expect(pending).toBeDefined();
    expect(rows.some((row) => row.target.liveIndex === 2)).toBe(false);
    expect(live?.metadata?.isLive).toBe(true);
    expect(live?.liveStatusId).toBe(LiveItemStatusEnum.Live);
    expect(pending?.playable).toBe(false);
    expect(pending?.liveStatusId).toBe(LiveItemStatusEnum.Pending);
    if (
      live === undefined ||
      pending === undefined ||
      liveBundle === undefined ||
      pendingBundle === undefined
    ) {
      return;
    }
    expect(live.playbackMediaId).toBe(
      addByRssPlaybackMediaId(
        toAddByRssLiveItemPlaybackResourceData(record, mappedFeed, liveBundle, 0)
      )
    );
    expect(pending.playbackMediaId).toBe(
      addByRssPlaybackMediaId(
        toAddByRssLiveItemPlaybackResourceData(record, mappedFeed, pendingBundle, 1)
      )
    );
  });
});

describe('toAddByRssFeedLiveRows', () => {
  const now = new Date('2026-06-13T12:00:00.000Z');
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

  it('returns live, scheduled, then recent ended, skipping stale and unknown', () => {
    const record = feed();
    const mappedFeed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [],
      link: 'https://example.com',
      podcastLiveItems: [
        liveItem('stale', 'Stale', Phase4LiveStatus.Ended, iso(-3 * dayMs), iso(-2 * dayMs)),
        liveItem('soon', 'Soon', Phase4LiveStatus.Pending, iso(dayMs)),
        liveItem(
          'just-ended',
          'Just Ended',
          Phase4LiveStatus.Ended,
          iso(-3 * hourMs),
          iso(-hourMs)
        ),
        liveItem('on-air', 'On Air', Phase4LiveStatus.Live, iso(-hourMs)),
        liveItem('mystery', 'Mystery', Phase4LiveStatus.Live, iso(-2 * hourMs)),
      ],
      title: 'Show Name',
    });

    for (const bundle of mappedFeed.liveItems) {
      const { end_time: endTime, start_time: startTime } = bundle.liveItem;
      Object.assign(bundle.liveItem, {
        end_time: endTime instanceof Date ? endTime.toISOString() : endTime,
        start_time: startTime instanceof Date ? startTime.toISOString() : startTime,
      });
    }
    const unknown = mappedFeed.liveItems[4];
    if (unknown !== undefined) {
      Object.assign(unknown.liveItem, { live_item_status: -1 });
    }

    const rows = toAddByRssFeedLiveRows(record, mappedFeed, now);
    const live = rows[0];
    const pending = rows[1];
    const ended = rows[2];

    expect(rows.map((row) => row.title)).toEqual(['On Air', 'Soon', 'Just Ended']);
    expect(rows.map((row) => row.target.liveIndex)).toEqual([3, 1, 2]);
    expect(live?.metadata?.isLive).toBe(true);
    expect(live?.playable).not.toBe(false);
    expect(pending?.playable).toBe(false);
    expect(ended?.playable).toBe(false);
    expect(ended?.liveStatusId).toBe(LiveItemStatusEnum.Ended);
    expect(ended?.updatedAt).toBe(Date.parse(iso(-3 * hourMs)));
    for (const row of rows) {
      expect(mappedFeed.liveItems[row.target.liveIndex]).toBe(row.target.liveBundle);
    }

    const upcomingIndexes = toAddByRssLiveRows(record, mappedFeed, now).map(
      (row) => row.target.liveIndex
    );
    expect(upcomingIndexes).toEqual([1, 3]);
  });

  it('returns only the live row when a scheduled item started two days before now', () => {
    const record = feed();
    const mappedFeed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [],
      link: 'https://example.com',
      podcastLiveItems: [
        liveItem('on-air', 'On Air', Phase4LiveStatus.Live, iso(-hourMs)),
        liveItem('old-scheduled', 'Old Scheduled', Phase4LiveStatus.Pending, iso(-2 * dayMs)),
      ],
      title: 'Show Name',
    });

    const rows = toAddByRssFeedLiveRows(record, mappedFeed, now);

    expect(rows.map((row) => row.title)).toEqual(['On Air']);
    expect(rows[0]?.liveStatusId).toBe(LiveItemStatusEnum.Live);
  });
});
