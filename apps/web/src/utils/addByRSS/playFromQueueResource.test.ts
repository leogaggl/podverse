import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers';
import { buildMinimalAddByRSSItemFromResourceData } from '@podverse/parser-mapping';

const storage = vi.hoisted(() => ({
  getAddByRSSItemByIdText: vi.fn(),
  getAddByRSSFeedByUrl: vi.fn(),
  getAllAddByRSSFeeds: vi.fn(),
  getAddByRSSItemById: vi.fn(),
  getAddByRSSLivestreamByIdText: vi.fn(),
}));

vi.mock('./storage', () => storage);

import { resolveAddByRSSIndexItemFromResourceData } from './playFromQueueResource';
import type { AddByRSSFeedRecord, AddByRSSItemIndexItem, AddByRSSMappedFeed } from './types';

const FEED_URL = 'https://feeds.example.com/show.xml';
const ENCLOSURE_URL = 'https://cdn.example.com/ep-2.mp3';

const phoneRow = (overrides: Partial<AddByRSSResourceData> = {}): AddByRSSResourceData => ({
  feed_url: FEED_URL,
  channel_id_text: 'phonechan1',
  guid: 'ep-2',
  id_text: 'phone-item-2',
  title: 'Episode Two',
  enclosure_url: ENCLOSURE_URL,
  ...overrides,
});

const bundleFor = (row: AddByRSSResourceData): AddByRSSMappedFeed['items'][number] => {
  const item = buildMinimalAddByRSSItemFromResourceData(row);
  if (item === null) {
    throw new Error('fixture row must have an enclosure');
  }
  return item.bundle;
};

const FIRST_ENCLOSURE_URL = 'https://cdn.example.com/ep-1.mp3';
const firstEpisodeRow = (overrides: Partial<AddByRSSResourceData> = {}) =>
  phoneRow({ guid: 'ep-1', enclosure_url: FIRST_ENCLOSURE_URL, ...overrides });

/** A parsed feed on this browser with two episodes, the second without an RSS guid. */
const parsedFeed = (): AddByRSSFeedRecord => {
  const first = bundleFor(firstEpisodeRow());
  const second = bundleFor(phoneRow());
  const secondWithoutGuid = { ...second, item: { ...second.item, guid: null } };
  return {
    id: 1,
    idText: 'webchan1',
    resourceType: 'podcasts',
    feedUrl: FEED_URL,
    title: 'The Show',
    imageUrl: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    // Only `items` is read by the lookup; a full parse is far wider.
    mappedFeed: {
      items: [first, secondWithoutGuid],
      liveItems: [],
    } as unknown as AddByRSSMappedFeed,
  };
};

describe('resolveAddByRSSIndexItemFromResourceData', () => {
  beforeEach(() => {
    storage.getAddByRSSItemByIdText.mockReset().mockResolvedValue(null);
    storage.getAddByRSSFeedByUrl.mockReset().mockResolvedValue(null);
    storage.getAllAddByRSSFeeds.mockReset().mockResolvedValue([]);
    storage.getAddByRSSItemById.mockReset().mockResolvedValue(null);
    storage.getAddByRSSLivestreamByIdText.mockReset().mockResolvedValue(null);
  });

  it('uses the item this browser indexed under the row id_text first', async () => {
    const local = { idText: 'phone-item-2' } as AddByRSSItemIndexItem;
    storage.getAddByRSSItemByIdText.mockResolvedValue(local);
    storage.getAddByRSSFeedByUrl.mockResolvedValue(parsedFeed());

    const resolved = await resolveAddByRSSIndexItemFromResourceData(phoneRow());

    expect(resolved).toEqual({ indexItem: local, source: 'local' });
  });

  it('finds the episode in the stored feed by guid and keeps its indexed id_text', async () => {
    storage.getAddByRSSFeedByUrl.mockResolvedValue(parsedFeed());
    storage.getAddByRSSItemById.mockResolvedValue({ idText: 'web-item-1' });

    const resolved = await resolveAddByRSSIndexItemFromResourceData(firstEpisodeRow());

    expect(resolved?.source).toBe('feed');
    expect(resolved?.indexItem.idText).toBe('web-item-1');
    expect(resolved?.indexItem.id).toBe('webchan1-ep-1');
    expect(storage.getAddByRSSItemById).toHaveBeenCalledWith('webchan1-ep-1');
  });

  it('matches by enclosure URL when the row guid is device-local', async () => {
    storage.getAddByRSSFeedByUrl.mockResolvedValue(parsedFeed());

    const resolved = await resolveAddByRSSIndexItemFromResourceData(
      phoneRow({ guid: 'phonechan1-1' })
    );

    expect(resolved?.source).toBe('feed');
    expect(resolved?.indexItem.id).toBe('webchan1-webchan1-1');
    expect(resolved?.indexItem.feedUrl).toBe(FEED_URL);
    if (resolved && 'bundle' in resolved.indexItem) {
      expect(resolved.indexItem.bundle.enclosures[0]?.item_enclosure_sources[0]?.uri).toBe(
        ENCLOSURE_URL
      );
    }
  });

  it('finds a stored feed whose URL differs only in canonical form', async () => {
    storage.getAllAddByRSSFeeds.mockResolvedValue([parsedFeed()]);

    const resolved = await resolveAddByRSSIndexItemFromResourceData(
      firstEpisodeRow({ feed_url: 'HTTPS://FEEDS.EXAMPLE.COM/show.xml' })
    );

    expect(resolved?.source).toBe('feed');
  });

  it('rebuilds from the bundle when this browser has not parsed the feed', async () => {
    const row = phoneRow();
    const resolved = await resolveAddByRSSIndexItemFromResourceData({
      ...row,
      bundle: bundleFor(row),
    });

    expect(resolved?.source).toBe('bundle');
    expect(resolved?.indexItem.feedUrl).toBe(FEED_URL);
  });

  it('builds a minimal item when there is no bundle', async () => {
    const resolved = await resolveAddByRSSIndexItemFromResourceData(phoneRow());

    expect(resolved?.source).toBe('minimal');
    expect(resolved?.indexItem.idText).toBe('phone-item-2');
  });

  it('returns null when nothing could play', async () => {
    expect(
      await resolveAddByRSSIndexItemFromResourceData(phoneRow({ enclosure_url: undefined }))
    ).toBeNull();
  });
});
