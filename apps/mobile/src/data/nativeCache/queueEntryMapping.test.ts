import { describe, expect, it, vi } from 'vitest';

import type { AddByRSSResourceData, DTOItemAbout } from '@podverse/helpers/dto';
import type { AutoQueueResourcesMapRow } from '@podverse/playback-core/autoQueue';

import { addByRssPlaybackMediaId } from '../../lib/addByRss/resourceData';
import { safeJsonParse } from '../db/serialization';
import {
  nativeCacheDurationMs,
  nativeQueueEntryFromAddByRss,
  nativeQueueEntryFromAutoQueueRow,
  nativeResumeSeconds,
} from './queueEntryMapping';

vi.mock('../../lib/e2e/resolveE2eMediaUrl', () => ({
  resolveE2eMediaUrl: (url: string) => url,
}));

const fixture = <T>(value: unknown): T => {
  const parsed = safeJsonParse<T>(JSON.stringify(value));
  if (parsed === null) {
    throw new Error('Failed to build fixture');
  }
  return parsed;
};

const enclosure = (uri: string) => ({
  bitrate: null,
  codecs: null,
  height: null,
  id: 1,
  item_enclosure_default: true,
  item_enclosure_integrity: null,
  item_enclosure_sources: [{ content_type: 'audio/mpeg', id: 1, item_enclosure_id: 1, uri }],
  item_id: 1,
  language: null,
  length: null,
  rel: null,
  title: null,
  type: 'audio/mpeg',
});

const channel = { channel_images: [], id: 1, id_text: 'channel-1', title: 'Show' };

const itemValue = (idText: string, extra: Record<string, unknown> = {}) => ({
  channel,
  id: 1,
  id_text: idText,
  item_about: { duration: '90' },
  item_enclosures: [enclosure(`https://example.com/${idText}.mp3`)],
  item_images: [],
  title: `Episode ${idText}`,
  ...extra,
});

const row = (value: Record<string, unknown>): AutoQueueResourcesMapRow =>
  fixture<AutoQueueResourcesMapRow>({
    channel,
    clip: null,
    item_soundbite: null,
    ...value,
  });

const noDownloads = (): string | null => null;

describe('nativeQueueEntryFromAutoQueueRow', () => {
  it('ends the window for a clip without its item, a livestream item, and a row with nothing to play', () => {
    const clipWithoutItem = row({
      clip: { end_time: '20', id_text: 'clip-1', start_time: '10', title: 'Clip' },
      item: itemValue('ep-1'),
    });
    const liveItem = row({
      item: itemValue('ep-2', { live_item: { id: 1, item_id: 1, start_time: '2026-01-01' } }),
    });
    const nothingToPlay = row({ item: itemValue('ep-3', { item_enclosures: [] }) });

    for (const value of [clipWithoutItem, liveItem, nothingToPlay]) {
      expect(
        nativeQueueEntryFromAutoQueueRow(value, {
          downloadFileNameFor: noDownloads,
          startPositionSeconds: null,
        })
      ).toBeNull();
    }
  });

  it('keeps a row with only a download', () => {
    const entry = nativeQueueEntryFromAutoQueueRow(
      row({ item: itemValue('ep-3', { item_enclosures: [] }) }),
      { downloadFileNameFor: () => 'ep-3.mp3', startPositionSeconds: null }
    );

    expect(entry?.mediaUrl).toBeNull();
    expect(entry?.downloadFileName).toBe('ep-3.mp3');
  });

  it('starts a played item over, resumes an unfinished one, and plays a clip from its range', () => {
    const itemRow = row({ item: itemValue('ep-1') });
    const played = nativeResumeSeconds({ played: true, positionSeconds: 40 });
    const unfinished = nativeResumeSeconds({ played: false, positionSeconds: 40 });

    expect(
      nativeQueueEntryFromAutoQueueRow(itemRow, {
        downloadFileNameFor: noDownloads,
        startPositionSeconds: played,
      })?.startPositionSeconds
    ).toBeNull();
    expect(
      nativeQueueEntryFromAutoQueueRow(itemRow, {
        downloadFileNameFor: noDownloads,
        startPositionSeconds: unfinished,
      })?.startPositionSeconds
    ).toBe(40);

    const clipEntry = nativeQueueEntryFromAutoQueueRow(
      row({
        clip: {
          end_time: '20',
          id_text: 'clip-1',
          item: itemValue('ep-1'),
          start_time: '10',
          title: 'Clip',
        },
        item: itemValue('ep-1'),
      }),
      { downloadFileNameFor: noDownloads, startPositionSeconds: unfinished }
    );

    expect(clipEntry).toMatchObject({
      clipEndSeconds: 20,
      clipStartSeconds: 10,
      idText: 'clip-1',
      kind: 'clip',
      mediaUrl: 'https://example.com/ep-1.mp3',
      startPositionSeconds: 10,
      title: 'Clip',
    });
  });

  it('maps a soundbite without an item as its row item', () => {
    const entry = nativeQueueEntryFromAutoQueueRow(
      row({
        item: itemValue('ep-1'),
        item_soundbite: { duration: '5', id_text: 'sb-1', item: null, start_time: '3' },
      }),
      { downloadFileNameFor: noDownloads, startPositionSeconds: null }
    );

    expect(entry).toMatchObject({ idText: 'ep-1', kind: 'item' });
    expect(entry?.clipStartSeconds).toBeUndefined();
  });
});

describe('nativeQueueEntryFromAddByRss', () => {
  const resourceData: AddByRSSResourceData = {
    channel_title: 'Feed',
    enclosure_url: 'https://example.com/rss-1.mp3',
    feed_url: 'https://example.com/feed.xml',
    guid: 'guid-1',
    title: 'RSS Episode',
  };

  it('keeps an episode with a download and no safe media URL', () => {
    const entry = nativeQueueEntryFromAddByRss({
      downloadFileName: 'rss-1.mp3',
      mediaUrl: null,
      resourceData,
      startPositionSeconds: null,
    });

    expect(entry).toMatchObject({
      downloadFileName: 'rss-1.mp3',
      idText: addByRssPlaybackMediaId(resourceData),
      kind: 'add_by_rss',
      mediaUrl: null,
      title: 'RSS Episode',
    });
  });

  it('ends the window for a livestream', () => {
    expect(
      nativeQueueEntryFromAddByRss({
        downloadFileName: null,
        mediaUrl: 'https://example.com/live.m3u8',
        resourceData: { ...resourceData, liveItem: { status: 'live' } },
        startPositionSeconds: null,
      })
    ).toBeNull();
  });
});

describe('nativeCacheDurationMs', () => {
  it('prefers the media file duration and falls back to the feed duration', () => {
    const item = { item_about: fixture<DTOItemAbout>({ duration: '90', id: 1, item_id: 1 }) };

    expect(nativeCacheDurationMs(item, '120.4')).toBe(120400);
    expect(nativeCacheDurationMs(item, null)).toBe(90000);
    expect(nativeCacheDurationMs({ item_about: null }, '0')).toBeNull();
  });
});
