import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers';
import { getAddByRSSHashId as getAddByRSSHashIdFromData, MediumEnum } from '@podverse/helpers';

import { buildAddByRSSResourceData, getAddByRSSHashId } from './queuePlaylistHelpers.js';
import {
  buildMinimalAddByRSSItemFromResourceData,
  reconstructAddByRSSItemFromResourceData,
} from './reconstruct.js';

const FEED_URL = 'https://feeds.example.com/show.xml';
const ENCLOSURE_URL = 'https://cdn.example.com/ep-1.mp3';

function phoneRow(overrides: Partial<AddByRSSResourceData> = {}): AddByRSSResourceData {
  return {
    feed_url: FEED_URL,
    channel_id_text: 'phonechan1',
    guid: 'ep-1',
    id_text: 'phone-item-1',
    title: 'Episode One',
    channel_title: 'The Show',
    channel_images: [{ url: 'https://cdn.example.com/show.jpg' }],
    item_images: [{ url: 'https://cdn.example.com/ep-1.jpg', image_width_size: 600 }],
    enclosure_url: ENCLOSURE_URL,
    duration: 1800,
    pub_date: '2026-01-02T03:04:05.000Z',
    medium_id: MediumEnum.Podcast,
    ...overrides,
  };
}

describe('buildMinimalAddByRSSItemFromResourceData', () => {
  it('maps the enclosure, titles, artwork, duration, pub date, medium, feed URL, and guid', () => {
    const item = buildMinimalAddByRSSItemFromResourceData(phoneRow());
    expect(item).not.toBeNull();
    if (!item) return;

    expect(item.bundle.enclosures[0]?.item_enclosure_sources[0]?.uri).toBe(ENCLOSURE_URL);
    expect(item.bundle.enclosures[0]?.item_enclosure.length).toBe(1800);
    expect(item.bundle.item.title).toBe('Episode One');
    expect(item.bundle.item.guid).toBe('ep-1');
    expect(item.bundle.item.pub_date).toEqual(new Date('2026-01-02T03:04:05.000Z'));
    expect(item.bundle.images).toEqual([
      { url: 'https://cdn.example.com/ep-1.jpg', image_width_size: 600 },
    ]);
    expect(item.channelTitle).toBe('The Show');
    expect(item.channelImageUrl).toBe('https://cdn.example.com/show.jpg');
    expect(item.mediumId).toBe(MediumEnum.Podcast);
    expect(item.pubDateMs).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
    expect(item.feedUrl).toBe(FEED_URL);
    expect(item.itemGuid).toBe('ep-1');
    expect(item.idText).toBe('phone-item-1');
  });

  it('round-trips to resource data with the same Add by RSS hash as the row', () => {
    const row = phoneRow();
    const item = buildMinimalAddByRSSItemFromResourceData(row);
    expect(item).not.toBeNull();
    if (!item) return;

    const rebuilt = buildAddByRSSResourceData(item);
    expect(rebuilt.enclosure_url).toBe(ENCLOSURE_URL);
    expect(rebuilt.duration).toBe(1800);
    expect(getAddByRSSHashId(item)).toBe(getAddByRSSHashIdFromData(row));
  });

  it('keeps the enclosure-form hash for a device-local guid', () => {
    const row = phoneRow({ guid: 'phonechan1-3' });
    const item = buildMinimalAddByRSSItemFromResourceData(row);
    expect(item).not.toBeNull();
    if (!item) return;
    expect(getAddByRSSHashId(item)).toBe(
      getAddByRSSHashIdFromData({ feed_url: FEED_URL, enclosure_url: ENCLOSURE_URL })
    );
  });

  it('returns null when the row has no enclosure URL', () => {
    expect(buildMinimalAddByRSSItemFromResourceData(phoneRow({ enclosure_url: '' }))).toBeNull();
    expect(
      buildMinimalAddByRSSItemFromResourceData(phoneRow({ enclosure_url: undefined }))
    ).toBeNull();
  });
});

describe('reconstructAddByRSSItemFromResourceData', () => {
  it('keeps feed_url so a bundle-rebuilt item hashes the same as its row', () => {
    const minimal = buildMinimalAddByRSSItemFromResourceData(phoneRow());
    expect(minimal).not.toBeNull();
    if (!minimal) return;
    const row = phoneRow({ bundle: minimal.bundle });

    const item = reconstructAddByRSSItemFromResourceData(row);
    expect(item?.feedUrl).toBe(FEED_URL);
    if (!item) return;
    expect(getAddByRSSHashId(item)).toBe(getAddByRSSHashIdFromData(row));
  });
});
