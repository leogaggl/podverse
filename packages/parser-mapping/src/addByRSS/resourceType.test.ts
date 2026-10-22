import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers';

import { convertParsedRSSFeedToCompat } from '../compat/partytime/compatFull.js';
import type { FeedObject } from '../types/partytime.js';
import { Phase4Medium } from '../types/partytime.js';
import {
  ADD_BY_RSS_RESOURCE_TYPES,
  getAddByRSSDetailRouteSegment,
  getAddByRSSResourceTypeFromMappedFeed,
  isAddByRSSResourceType,
  toAddByRSSResourceType,
} from './resourceType.js';

function feed(overrides: Partial<FeedObject> = {}): FeedObject {
  return {
    title: 'Show',
    explicit: false,
    link: 'https://example.com',
    items: [],
    ...overrides,
  };
}

describe('toAddByRSSResourceType', () => {
  it('reads a stored livestreams value, and an empty value, as podcasts', () => {
    expect(toAddByRSSResourceType('livestreams')).toBe('podcasts');
    expect(toAddByRSSResourceType('')).toBe('podcasts');
  });

  it('keeps albums and tracks', () => {
    expect(toAddByRSSResourceType('albums')).toBe('albums');
    expect(toAddByRSSResourceType('tracks')).toBe('tracks');
  });
});

describe('isAddByRSSResourceType', () => {
  it('accepts each of the five resource types and rejects livestreams', () => {
    expect([...ADD_BY_RSS_RESOURCE_TYPES]).toEqual([
      'podcasts',
      'episodes',
      'artists',
      'albums',
      'tracks',
    ]);
    for (const resourceType of ADD_BY_RSS_RESOURCE_TYPES) {
      expect(isAddByRSSResourceType(resourceType)).toBe(true);
    }
    expect(isAddByRSSResourceType('livestreams')).toBe(false);
  });
});

describe('getAddByRSSDetailRouteSegment', () => {
  it('maps artists, albums, and podcasts to their detail segments', () => {
    expect(getAddByRSSDetailRouteSegment('artists')).toBe('artist');
    expect(getAddByRSSDetailRouteSegment('albums')).toBe('album');
    expect(getAddByRSSDetailRouteSegment('podcasts')).toBe('podcast');
  });
});

describe('getAddByRSSResourceTypeFromMappedFeed', () => {
  it('returns podcasts for a podcast medium and for a missing feed', () => {
    const mapped = convertParsedRSSFeedToCompat(feed({ medium: Phase4Medium.Podcast }));
    expect(mapped.channel.channel.medium_id).toBe(MediumEnum.Podcast);
    expect(getAddByRSSResourceTypeFromMappedFeed(mapped)).toBe('podcasts');
    expect(getAddByRSSResourceTypeFromMappedFeed(null)).toBe('podcasts');
  });
});
