import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers/medium';

import {
  mergedChannelDetailTarget,
  mergedItemDetailTarget,
  readMergedInto,
  readMergedIntoRedirect,
} from './mergeRedirect';

const mergedGone = (kind: 'channel' | 'item', idText: string, status = 410) => ({
  response: {
    data: { merged_into: { id_text: idText, kind } },
    status,
  },
});

describe('readMergedInto', () => {
  it('reads a channel or item survivor', () => {
    expect(readMergedInto(mergedGone('channel', 'surviving-show'))).toEqual({
      idText: 'surviving-show',
      kind: 'channel',
    });
    expect(readMergedInto(mergedGone('item', 'surviving-episode'))).toEqual({
      idText: 'surviving-episode',
      kind: 'item',
    });
  });

  it('ignores an archived 410 and a body that does not name a survivor', () => {
    expect(
      readMergedInto({
        response: { data: { gone: { reason: 'archived' } }, status: 410 },
      })
    ).toBeNull();
    expect(
      readMergedInto({ response: { data: { merged_into: { kind: 'channel' } }, status: 410 } })
    ).toBeNull();
    expect(readMergedInto(new Error('network'))).toBeNull();
  });
});

describe('readMergedIntoRedirect', () => {
  it('requires HTTP 410', () => {
    expect(readMergedIntoRedirect(mergedGone('channel', 'surviving-show', 500))).toBeNull();
    expect(readMergedIntoRedirect(mergedGone('item', 'surviving-episode'))).toEqual({
      idText: 'surviving-episode',
      kind: 'item',
    });
  });
});

describe('merged detail targets', () => {
  it('opens the channel screen for the survivor medium', () => {
    expect(
      mergedChannelDetailTarget({
        idText: 'show',
        imageUrl: null,
        mediumId: MediumEnum.Podcast,
        title: 'Show',
      }).screen
    ).toBe('PodcastDetail');
    expect(
      mergedChannelDetailTarget({
        idText: 'album',
        imageUrl: null,
        mediumId: MediumEnum.Music,
        title: null,
      }).screen
    ).toBe('AlbumDetail');
    expect(
      mergedChannelDetailTarget({
        idText: 'artist',
        imageUrl: null,
        mediumId: MediumEnum.PublisherMusic,
        title: null,
      }).screen
    ).toBe('ArtistDetail');
  });

  it('opens a track for music and an episode otherwise', () => {
    expect(
      mergedItemDetailTarget({
        idText: 'track',
        imageUrl: null,
        mediumId: MediumEnum.Music,
        title: null,
      }).screen
    ).toBe('TrackDetail');
    expect(
      mergedItemDetailTarget({
        idText: 'episode',
        imageUrl: null,
        mediumId: null,
        title: null,
      }).screen
    ).toBe('EpisodeDetail');
  });
});
