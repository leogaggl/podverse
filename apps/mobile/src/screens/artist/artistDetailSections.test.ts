import { describe, expect, it } from 'vitest';

import { buildArtistAlbumSectionRows, buildArtistTrackSectionRows } from './artistDetailSections';

const albumKeys = {
  notYetAddedKey: (row: string, sectionIndex: number) => `not-yet-added-${row}-${sectionIndex}`,
  verifiedKey: (row: string, sectionIndex: number) => `verified-${row}-${sectionIndex}`,
};

const trackKey = (row: string, sectionIndex: number) => `track-${row}-${sectionIndex}`;

describe('buildArtistAlbumSectionRows', () => {
  it('lists a verified heading and verified rows when those are the only albums', () => {
    expect(
      buildArtistAlbumSectionRows({
        includeAddByRssSlot: false,
        notYetAdded: [],
        verified: ['a', 'b'],
        ...albumKeys,
      })
    ).toEqual([
      { key: 'verified-heading', kind: 'verified-heading' },
      { key: 'verified-a-0', kind: 'verified', row: 'a', sectionIndex: 0 },
      { key: 'verified-b-1', kind: 'verified', row: 'b', sectionIndex: 1 },
    ]);
  });

  it('lists the not yet added heading, note, and rows when no album is verified', () => {
    expect(
      buildArtistAlbumSectionRows({
        includeAddByRssSlot: false,
        notYetAdded: ['feed'],
        verified: [],
        ...albumKeys,
      })
    ).toEqual([
      { key: 'not-yet-added-heading', kind: 'not-yet-added-heading' },
      { key: 'not-yet-added-note', kind: 'not-yet-added-note' },
      { key: 'not-yet-added-feed-0', kind: 'not-yet-added', row: 'feed', sectionIndex: 0 },
    ]);
  });

  it('places the add by rss slot between verified rows and not yet added rows', () => {
    expect(
      buildArtistAlbumSectionRows({
        includeAddByRssSlot: true,
        notYetAdded: ['feed'],
        verified: ['a', 'b'],
        ...albumKeys,
      })
    ).toEqual([
      { key: 'verified-heading', kind: 'verified-heading' },
      { key: 'verified-a-0', kind: 'verified', row: 'a', sectionIndex: 0 },
      { key: 'verified-b-1', kind: 'verified', row: 'b', sectionIndex: 1 },
      { key: 'add-by-rss-albums', kind: 'add-by-rss-slot' },
      { key: 'not-yet-added-heading', kind: 'not-yet-added-heading' },
      { key: 'not-yet-added-note', kind: 'not-yet-added-note' },
      { key: 'not-yet-added-feed-0', kind: 'not-yet-added', row: 'feed', sectionIndex: 0 },
    ]);
  });

  it('returns no rows when every album list is empty and the slot is omitted', () => {
    expect(
      buildArtistAlbumSectionRows({
        includeAddByRssSlot: false,
        notYetAdded: [],
        verified: [],
        ...albumKeys,
      })
    ).toEqual([]);
  });

  it('returns only the add by rss slot when every album list is empty and the slot is included', () => {
    expect(
      buildArtistAlbumSectionRows({
        includeAddByRssSlot: true,
        notYetAdded: [],
        verified: [],
        ...albumKeys,
      })
    ).toEqual([{ key: 'add-by-rss-albums', kind: 'add-by-rss-slot' }]);
  });
});

describe('buildArtistTrackSectionRows', () => {
  it('lists track indexes and omits the slot when the slot is excluded', () => {
    expect(
      buildArtistTrackSectionRows({
        includeAddByRssSlot: false,
        trackKey,
        tracks: ['one', 'two'],
      })
    ).toEqual([
      { key: 'track-one-0', kind: 'track', row: 'one', sectionIndex: 0 },
      { key: 'track-two-1', kind: 'track', row: 'two', sectionIndex: 1 },
    ]);
  });

  it('appends the add by rss tracks slot after the track rows', () => {
    expect(
      buildArtistTrackSectionRows({
        includeAddByRssSlot: true,
        trackKey,
        tracks: ['one', 'two'],
      })
    ).toEqual([
      { key: 'track-one-0', kind: 'track', row: 'one', sectionIndex: 0 },
      { key: 'track-two-1', kind: 'track', row: 'two', sectionIndex: 1 },
      { key: 'add-by-rss-tracks', kind: 'add-by-rss-tracks-slot' },
    ]);
  });

  it('returns only the add by rss tracks slot when there are no tracks and the slot is included', () => {
    expect(
      buildArtistTrackSectionRows({
        includeAddByRssSlot: true,
        trackKey,
        tracks: [],
      })
    ).toEqual([{ key: 'add-by-rss-tracks', kind: 'add-by-rss-tracks-slot' }]);
  });

  it('returns no rows when there are no tracks and the slot is omitted', () => {
    expect(
      buildArtistTrackSectionRows({
        includeAddByRssSlot: false,
        trackKey,
        tracks: [],
      })
    ).toEqual([]);
  });
});
