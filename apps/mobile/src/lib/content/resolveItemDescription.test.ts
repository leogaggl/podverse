import { describe, expect, it, vi } from 'vitest';

import type { DTOItemDescriptionDetail } from '@podverse/helpers/dto';

import type { ItemDescriptionCacheEntry } from '../../data/repositories/itemDescriptionCacheRepository';
import type { ItemDescriptionSubject, ResolveItemDescriptionDeps } from './resolveItemDescription';
import { resolveItemDescription } from './resolveItemDescription';

const subject = (overrides: Partial<ItemDescriptionSubject> = {}): ItemDescriptionSubject => ({
  addByRss: false,
  description: { is_truncated: true, preview: 'Stored preview' },
  itemIdText: 'item-1',
  linkUrl: 'https://example.com/episode',
  ...overrides,
});

const detail: DTOItemDescriptionDetail = {
  is_truncated: true,
  item_id_text: 'item-1',
  link_url: 'https://example.com/full',
  preview: 'Server preview',
  source_length: 900_000,
  value: '<p>Server notes</p>',
};

const deps = (overrides: Partial<ResolveItemDescriptionDeps> = {}): ResolveItemDescriptionDeps => ({
  canRequest: () => true,
  fetchDetail: vi.fn(async () => detail),
  isDownloaded: vi.fn(async () => false),
  readCache: vi.fn(async () => null),
  writeCache: vi.fn(async () => undefined),
  ...overrides,
});

describe('resolveItemDescription', () => {
  it('uses the payload value and reads nothing else', async () => {
    const d = deps();
    const result = await resolveItemDescription(
      subject({ description: { preview: 'p', value: '<p>Payload notes</p>' } }),
      d
    );
    expect(result).toMatchObject({ html: '<p>Payload notes</p>', source: 'payload' });
    expect(d.readCache).not.toHaveBeenCalled();
    expect(d.fetchDetail).not.toHaveBeenCalled();
  });

  it('uses the cache when the payload has only a preview', async () => {
    const cached: ItemDescriptionCacheEntry = {
      fetchedAt: 1,
      isTruncated: false,
      itemIdText: 'item-1',
      linkUrl: null,
      pinned: false,
      preview: 'Cached preview',
      value: '<p>Cached notes</p>',
    };
    const d = deps({ readCache: vi.fn(async () => cached) });
    const result = await resolveItemDescription(subject(), d);
    expect(result).toEqual({
      html: '<p>Cached notes</p>',
      isTruncated: false,
      linkUrl: 'https://example.com/episode',
      preview: 'Cached preview',
      source: 'cache',
    });
    expect(d.fetchDetail).not.toHaveBeenCalled();
  });

  it('fetches when nothing on the device has the notes, and caches the answer', async () => {
    const d = deps();
    const result = await resolveItemDescription(subject(), d);
    expect(result).toMatchObject({
      html: '<p>Server notes</p>',
      isTruncated: true,
      linkUrl: 'https://example.com/full',
      source: 'network',
    });
    expect(d.writeCache).toHaveBeenCalledWith({
      isTruncated: true,
      itemIdText: 'item-1',
      linkUrl: 'https://example.com/full',
      pinned: false,
      preview: 'Server preview',
      value: '<p>Server notes</p>',
    });
  });

  it('pins the cached answer when the item is downloaded', async () => {
    const d = deps({ isDownloaded: vi.fn(async () => true) });
    await resolveItemDescription(subject(), d);
    expect(d.writeCache).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));
  });

  it('falls back to the preview when offline with no cached notes', async () => {
    const d = deps({ canRequest: () => false });
    const result = await resolveItemDescription(subject(), d);
    expect(result).toEqual({
      html: null,
      isTruncated: true,
      linkUrl: 'https://example.com/episode',
      preview: 'Stored preview',
      source: 'none',
    });
    expect(d.fetchDetail).not.toHaveBeenCalled();
  });

  it('falls back to the preview and reports when the request fails', async () => {
    const reportError = vi.fn();
    const d = deps({
      fetchDetail: vi.fn(async () => {
        throw new Error('boom');
      }),
      reportError,
    });
    const result = await resolveItemDescription(subject(), d);
    expect(result).toMatchObject({ preview: 'Stored preview', source: 'none' });
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('never reads the cache or the server for an Add-by-RSS item', async () => {
    const d = deps();
    const result = await resolveItemDescription(subject({ addByRss: true }), d);
    expect(result.source).toBe('none');
    expect(d.readCache).not.toHaveBeenCalled();
    expect(d.fetchDetail).not.toHaveBeenCalled();
  });

  it('derives a preview from an older payload that has only a value', async () => {
    const result = await resolveItemDescription(
      subject({ description: { value: '<p>Old <b>row</b></p>' } }),
      deps()
    );
    expect(result).toMatchObject({ html: '<p>Old <b>row</b></p>', isTruncated: false });
    expect(result.preview).toContain('Old row');
  });
});
