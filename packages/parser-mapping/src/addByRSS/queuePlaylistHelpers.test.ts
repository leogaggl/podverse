import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId as getAddByRSSHashIdFromData, getMd5Hash } from '@podverse/helpers';

import { convertParsedRSSFeedToCompat } from '../compat/partytime/compatFull.js';
import type { Episode } from '../types/partytime.js';
import { toIndexItem } from './itemIndex.js';
import {
  buildAddByRSSHashInput,
  buildAddByRSSResourceData,
  getAddByRSSHashId,
  getAddByRSSHashIds,
} from './queuePlaylistHelpers.js';
import type { AddByRSSItemIndexItem } from './types.js';

const ENCLOSURE_URL = 'https://cdn.example.com/ep-1.mp3';

function episode(overrides: Partial<Episode> = {}): Episode {
  return {
    guid: 'ep-1',
    title: 'Episode One',
    enclosure: { url: ENCLOSURE_URL, type: 'audio/mpeg', length: 1 },
    duration: 1,
    explicit: false,
    ...overrides,
  };
}

function indexItem(
  feedUrl: string,
  idText: string,
  ep: Episode = episode()
): AddByRSSItemIndexItem {
  const mappedFeed = convertParsedRSSFeedToCompat({
    title: 'Show',
    explicit: false,
    link: 'https://example.com',
    items: [ep],
  });
  const bundle = mappedFeed.items[0];
  if (bundle === undefined) {
    throw new Error('expected one mapped item');
  }
  return toIndexItem(
    { id: 1, idText, feedUrl, title: 'Show', imageUrl: null, mappedFeed },
    bundle,
    0,
    'itemIdText01'
  );
}

describe('buildAddByRSSResourceData', () => {
  it('stores a canonical feed_url without userinfo', () => {
    const data = buildAddByRSSResourceData(
      indexItem('https://user:secret@Feeds.Example.COM/show.xml', 'chanAbc123')
    );
    expect(data['feed_url']).toBe('https://feeds.example.com/show.xml');
    expect(JSON.stringify(data)).not.toContain('secret');
  });

  it('omits feed_url when the index item has none', () => {
    const item = { ...indexItem('https://feeds.example.com/show.xml', 'chanAbc123') };
    delete item.feedUrl;
    expect('feed_url' in buildAddByRSSResourceData(item)).toBe(false);
  });

  it('hashes the same as the API does from the resource data', () => {
    const item = indexItem('https://Feeds.Example.com/show.xml', 'chanAbc123');
    expect(getAddByRSSHashId(item)).toBe(
      getAddByRSSHashIdFromData(buildAddByRSSResourceData(item))
    );
  });
});

describe('buildAddByRSSHashInput', () => {
  it('uses the feed URL and guid, not the device channel id', () => {
    const a = indexItem('https://feeds.example.com/show.xml', 'deviceAaaaa');
    const b = indexItem('https://feeds.example.com/show.xml', 'deviceBbbbb');
    expect(JSON.stringify(buildAddByRSSHashInput(a))).toBe(
      '{"feed_url":"https://feeds.example.com/show.xml","guid":"ep-1"}'
    );
    expect(getAddByRSSHashId(a)).toBe(getAddByRSSHashId(b));
  });

  it('falls back to the enclosure for an item without an RSS guid', () => {
    const item = indexItem(
      'https://feeds.example.com/show.xml',
      'chanAbc123',
      episode({ guid: '' })
    );
    expect(item.itemGuid).toBe('chanAbc123-0');
    expect(JSON.stringify(buildAddByRSSHashInput(item))).toBe(
      `{"feed_url":"https://feeds.example.com/show.xml","enclosure_url":"${ENCLOSURE_URL}"}`
    );
  });
});

describe('getAddByRSSHashIds', () => {
  it('lists the feed hash first, then the legacy hash', () => {
    const item = indexItem('https://feeds.example.com/show.xml', 'chanAbc123');
    expect(getAddByRSSHashIds(item)).toEqual([
      getAddByRSSHashId(item),
      getMd5Hash({ channel_id_text: 'chanAbc123', guid: 'ep-1' }),
    ]);
  });

  it('returns only the legacy hash when the item has no feed URL', () => {
    const item = { ...indexItem('https://feeds.example.com/show.xml', 'chanAbc123') };
    delete item.feedUrl;
    expect(getAddByRSSHashIds(item)).toEqual([
      getMd5Hash({ channel_id_text: 'chanAbc123', guid: 'ep-1' }),
    ]);
  });
});
