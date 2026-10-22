import { describe, expect, it } from 'vitest';

import { convertParsedRSSFeedToCompat } from '../compat/partytime/compatFull.js';
import type { FeedObject } from '../types/partytime.js';
import { Phase4LiveStatus } from '../types/partytime.js';
import { addByRSSFeedMayHaveLivestreams, addByRSSMappedFeedHasLiveItems } from './liveItems.js';

function feed(overrides: Partial<FeedObject> = {}): FeedObject {
  return {
    title: 'Show',
    explicit: false,
    link: 'https://example.com',
    items: [],
    ...overrides,
  };
}

const mapped = (overrides: Partial<FeedObject> = {}) =>
  convertParsedRSSFeedToCompat(feed(overrides));

const withLiveItem = () =>
  mapped({
    podcastLiveItems: [
      {
        guid: 'live-1',
        enclosure: { url: 'https://example.com/live.mp3', type: 'audio/mpeg', length: 1 },
        status: Phase4LiveStatus.Live,
        start: new Date('2026-01-01T00:00:00.000Z'),
        contentLinks: [],
      },
    ],
  });

describe('addByRSSMappedFeedHasLiveItems', () => {
  it('is false for null, undefined, and a feed with no live items', () => {
    expect(addByRSSMappedFeedHasLiveItems(null)).toBe(false);
    expect(addByRSSMappedFeedHasLiveItems(undefined)).toBe(false);
    expect(addByRSSMappedFeedHasLiveItems(mapped())).toBe(false);
  });

  it('is true when the feed carries one live item', () => {
    expect(addByRSSMappedFeedHasLiveItems(withLiveItem())).toBe(true);
  });
});

describe('addByRSSFeedMayHaveLivestreams', () => {
  it('stays true when the stored flag is set and the bundle has no live items', () => {
    expect(addByRSSFeedMayHaveLivestreams(true, mapped())).toBe(true);
  });

  it('is true when the stored flag is absent and the bundle has a live item', () => {
    expect(addByRSSFeedMayHaveLivestreams(undefined, withLiveItem())).toBe(true);
  });

  it('is false when the stored flag is false and there is no bundle', () => {
    expect(addByRSSFeedMayHaveLivestreams(false, null)).toBe(false);
  });
});
