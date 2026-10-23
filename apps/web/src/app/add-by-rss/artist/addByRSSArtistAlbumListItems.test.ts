import { describe, expect, it } from 'vitest';

import type { AddByRSSParseStatus, DTOChannel } from '@podverse/helpers';

import type { AddByRSSArtistAlbumEntry } from '../../../utils/addByRSS/publisherLinks';
import type { AddByRSSListedFeedRecord } from '../../../utils/addByRSS/types';
import { toAddByRSSArtistAlbumListItems } from './addByRSSArtistAlbumListItems';

const statusLabel = (status: AddByRSSParseStatus): string => `status:${status}`;

const directoryEntry: AddByRSSArtistAlbumEntry = {
  kind: 'directory',
  channelIdText: 'dirAlbum1',
  title: 'Listed Title',
  feedGuid: 'guid-dir',
};

const listedRecord = (
  idText: string,
  overrides: Partial<AddByRSSListedFeedRecord> = {}
): AddByRSSListedFeedRecord => ({
  id: 1,
  idText,
  resourceType: 'albums',
  feedUrl: `https://example.com/${idText}.xml`,
  title: `Album ${idText}`,
  imageUrl: null,
  status: 'parsed',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publisherParseRequestId: null,
  itemIdTextsByGuid: {},
  liveItemIdTextsByGuid: {},
  ...overrides,
});

const listedEntry = (record: AddByRSSListedFeedRecord): AddByRSSArtistAlbumEntry => ({
  kind: 'add_by_rss',
  source: { followed: false, feed: record },
});

const toItems = (
  entries: AddByRSSArtistAlbumEntry[],
  directoryChannels: Map<string, DTOChannel> = new Map(),
  needsCredentialsIdTexts: Set<string> = new Set()
) =>
  toAddByRSSArtistAlbumListItems({
    entries,
    directoryChannels,
    needsCredentialsIdTexts,
    statusLabel,
    imageSize: 300,
  });

describe('toAddByRSSArtistAlbumListItems', () => {
  it('gives a directory album its list title and directory album path before its channel loads', () => {
    const [item] = toItems([directoryEntry]);

    expect(item).toEqual({
      id: 'directory-dirAlbum1',
      title: 'Listed Title',
      href: '/album/dirAlbum1',
      imageCandidates: undefined,
      subtitle: null,
    });
  });

  it('gives a directory album the channel title, author, and artwork once its channel loads', () => {
    // Partial fixture: the mapper reads only title, author, and images.
    const channel = {
      title: 'Directory Album',
      channel_about: { author: 'Directory Artist' },
      channel_images: [
        { url: 'https://cdn.example.com/album-w300.webp', image_width_size: 300, is_resized: true },
      ],
    } as DTOChannel;

    const [item] = toItems([directoryEntry], new Map([['dirAlbum1', channel]]));

    expect(item?.title).toBe('Directory Album');
    expect(item?.subtitle).toBe('Directory Artist');
    expect(item?.href).toBe('/album/dirAlbum1');
    expect(item?.imageCandidates?.[0]).toBe('https://cdn.example.com/album-w300.webp');
  });

  it('links an Add by RSS album to its Add by RSS album page', () => {
    const [item] = toItems([listedEntry(listedRecord('listedA'))]);

    expect(item?.href).toBe('/add-by-rss/album/listedA');
    expect(item?.title).toBe('Album listedA');
  });

  it('shows the parse status as the subtitle of a queued album with no parsed feed', () => {
    const [item] = toItems([listedEntry(listedRecord('listedQ', { status: 'queued' }))]);

    expect(item?.title).toBe('Album listedQ');
    expect(item?.subtitle).toBe('status:queued');
  });

  it('leaves out an album that sits in the needs-credentials section', () => {
    const items = toItems(
      [listedEntry(listedRecord('listedA')), listedEntry(listedRecord('listedLocked'))],
      new Map(),
      new Set(['listedLocked'])
    );

    expect(items.map((item) => item.id)).toEqual(['listedA']);
  });
});
