import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceType } from '@podverse/helpers';

import {
  addByRssItemsTab,
  isAddByRssFilterableSection,
  isAddByRssMusicFeed,
  isAddByRssSortableSection,
  resolveAddByRssInitialSection,
  resolveAddByRssSections,
} from './addByRssDetailSections';

const RESOURCE_TYPES: readonly AddByRSSResourceType[] = [
  'albums',
  'artists',
  'episodes',
  'podcasts',
  'tracks',
];

describe('add-by-RSS detail sections', () => {
  it('orders podcast chips and adds funding and people when the feed has them', () => {
    expect(
      resolveAddByRssSections({ hasFunding: false, hasPeople: false, isMusicFeed: false })
    ).toEqual(['episodes', 'downloaded', 'about']);
    expect(
      resolveAddByRssSections({ hasFunding: true, hasPeople: false, isMusicFeed: false })
    ).toEqual(['episodes', 'downloaded', 'about', 'funding']);
    expect(
      resolveAddByRssSections({ hasFunding: false, hasPeople: true, isMusicFeed: false })
    ).toEqual(['episodes', 'downloaded', 'about', 'people']);
    expect(
      resolveAddByRssSections({ hasFunding: true, hasPeople: true, isMusicFeed: false })
    ).toEqual(['episodes', 'downloaded', 'about', 'funding', 'people']);
  });

  it('orders music chips without downloaded', () => {
    expect(
      resolveAddByRssSections({ hasFunding: false, hasPeople: false, isMusicFeed: true })
    ).toEqual(['tracks', 'about']);
    expect(
      resolveAddByRssSections({ hasFunding: true, hasPeople: true, isMusicFeed: true })
    ).toEqual(['tracks', 'about', 'funding', 'people']);
  });

  it('opens a podcast on downloaded while offline and otherwise on the items chip', () => {
    expect(resolveAddByRssInitialSection({ isMusicFeed: false, offline: true })).toBe('downloaded');
    expect(resolveAddByRssInitialSection({ isMusicFeed: false, offline: false })).toBe('episodes');
    expect(resolveAddByRssInitialSection({ isMusicFeed: true, offline: true })).toBe('tracks');
    expect(resolveAddByRssInitialSection({ isMusicFeed: true, offline: false })).toBe('tracks');
    expect(addByRssItemsTab(false)).toBe('episodes');
    expect(addByRssItemsTab(true)).toBe('tracks');
  });

  it('treats artists, albums, and tracks as music feeds', () => {
    const music = RESOURCE_TYPES.filter((resourceType) => isAddByRssMusicFeed(resourceType));
    expect(music).toEqual(['albums', 'artists', 'tracks']);
  });

  it('filters downloaded as well as episodes and tracks, and sorts only episodes and tracks', () => {
    expect(isAddByRssSortableSection('episodes')).toBe(true);
    expect(isAddByRssSortableSection('tracks')).toBe(true);
    expect(isAddByRssFilterableSection('episodes')).toBe(true);
    expect(isAddByRssFilterableSection('tracks')).toBe(true);
    expect(isAddByRssFilterableSection('downloaded')).toBe(true);
    expect(isAddByRssSortableSection('downloaded')).toBe(false);

    for (const section of ['about', 'funding', 'people'] as const) {
      expect(isAddByRssSortableSection(section)).toBe(false);
      expect(isAddByRssFilterableSection(section)).toBe(false);
    }
  });
});
