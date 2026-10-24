import { describe, expect, it } from 'vitest';

import type { DTOChannel, DTOItem, DTOVerifiedPublisher } from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import { mediaEngineSourceMetaFromTarget } from './mediaEngineSourceMeta';

const channel = (
  mediumId: MediumEnum,
  title: string,
  verifiedPublishers?: DTOVerifiedPublisher[]
): DTOChannel => {
  const base: DTOChannel = {
    feed_id: 0,
    has_podcast_index_value: false,
    has_value_time_splits: false,
    id: 1,
    id_text: 'channel-1',
    medium_id: mediumId,
    podcast_guid: null,
    slug: null,
    sortable_title: null,
    title,
  };
  if (verifiedPublishers === undefined) {
    return base;
  }
  return { ...base, verified_publishers: verifiedPublishers };
};

const item = (idText: string, title: string): DTOItem => ({
  channel_id: 1,
  id: 2,
  id_text: idText,
  item_about: { id: 1, item_id: 2 },
  item_chat: { id: 1, item_id: 2, server: '' },
  item_content_links: [],
  item_enclosures: [],
  item_flag_status_id: 0,
  item_fundings: [],
  item_images: [],
  item_license: { id: 1, identifier: '', item_id: 2, url: null },
  item_location: { id: 1, item_id: 2, name: null },
  item_persons: [],
  item_season: { channel_season_id: 0, id: 1, item_id: 2, title: null },
  item_social_interacts: [],
  item_soundbites: [],
  item_transcripts: [],
  item_txts: [],
  item_values: [],
  title,
});

const musicArtist: DTOVerifiedPublisher = {
  id_text: 'artist-1',
  medium_id: MediumEnum.PublisherMusic,
  title: 'Artist',
};

describe('mediaEngineSourceMetaFromTarget', () => {
  it('puts the artist name in subtitle and the album title in albumTitle', () => {
    const target: PlaybackTarget = {
      channel: channel(MediumEnum.Music, 'Album', [musicArtist]),
      intent: 'explicit_play',
      item: item('track-1', 'Track'),
      kind: 'item-music',
    };
    const meta = mediaEngineSourceMetaFromTarget(target, 'js');

    expect(meta?.subtitle).toBe('Artist');
    expect(meta?.albumTitle).toBe('Album');
  });

  it('keeps the channel title in subtitle and leaves albumTitle null without a verified artist', () => {
    const target: PlaybackTarget = {
      channel: channel(MediumEnum.Music, 'Album'),
      intent: 'explicit_play',
      item: item('track-1', 'Track'),
      kind: 'item-music',
    };
    const meta = mediaEngineSourceMetaFromTarget(target, 'js');

    expect(meta?.subtitle).toBe('Album');
    expect(meta?.albumTitle).toBeNull();
  });

  it('keeps the channel title in subtitle and leaves albumTitle null for a podcast episode', () => {
    const target: PlaybackTarget = {
      channel: channel(MediumEnum.Podcast, 'Show'),
      item: item('ep-1', 'Episode'),
      kind: 'item-podcast',
    };
    const meta = mediaEngineSourceMetaFromTarget(target, 'js');

    expect(meta?.subtitle).toBe('Show');
    expect(meta?.albumTitle).toBeNull();
  });
});
