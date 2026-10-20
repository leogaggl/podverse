import { describe, expect, it } from 'vitest';

import { convertParsedRSSFeedToCompat } from '../compat/partytime/compatFull.js';
import type { FeedObject } from '../types/partytime.js';
import {
  getAddByRSSChannelMetadata,
  getAddByRSSChannelMetadataFromParsedFeed,
} from './channelMetadata.js';

function feed(overrides: Partial<FeedObject> = {}): FeedObject {
  return {
    title: 'Show',
    explicit: false,
    link: 'https://example.com',
    items: [],
    ...overrides,
  };
}

describe('getAddByRSSChannelMetadataFromParsedFeed', () => {
  it('uses the channel title and prefers the iTunes image over the RSS image', () => {
    const parsed = feed({
      title: '  Show Title  ',
      itunesImage: 'https://cdn.example.com/itunes.png',
      image: { url: 'https://cdn.example.com/rss.png' },
    });

    expect(getAddByRSSChannelMetadataFromParsedFeed(parsed)).toEqual({
      title: 'Show Title',
      imageUrl: 'https://cdn.example.com/itunes.png',
    });
  });

  it('matches the selection made from the fully mapped feed', () => {
    const parsed = feed({ image: { url: 'https://cdn.example.com/rss.png' } });

    expect(getAddByRSSChannelMetadataFromParsedFeed(parsed)).toEqual(
      getAddByRSSChannelMetadata(convertParsedRSSFeedToCompat(parsed))
    );
  });

  it('returns null for a blank title and a feed without artwork', () => {
    expect(getAddByRSSChannelMetadataFromParsedFeed(feed({ title: '   ' }))).toEqual({
      title: null,
      imageUrl: null,
    });
  });
});
