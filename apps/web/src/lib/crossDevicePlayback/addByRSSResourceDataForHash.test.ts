import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceData, DTOItem, DTOQueueResource } from '@podverse/helpers';

import { addByRSSPlaybackIdentity } from '../../hooks/playbackHandoffState';
import { pickAddByRSSResourceDataForHash } from './addByRSSResourceDataForHash';

function makeItem(): DTOItem {
  return {
    id: 1,
    id_text: 'item-1',
    channel_id: 1,
    title: 'Episode Title',
    item_flag_status_id: 1,
    item_about: { id: 1, item_id: 1 },
    item_chat: { id: 1, item_id: 1, server: 'chat.example.com' },
    item_license: { id: 1, item_id: 1, identifier: 'CC-BY', url: null },
    item_location: { id: 1, item_id: 1, name: null },
    item_season: { id: 1, channel_season_id: 1, item_id: 1, title: null },
    item_content_links: [],
    item_enclosures: [],
    item_fundings: [],
    item_images: [],
    item_persons: [],
    item_social_interacts: [],
    item_soundbites: [],
    item_transcripts: [],
    item_txts: [],
    item_values: [],
  };
}

function row(resourceData: AddByRSSResourceData | null | undefined): DTOQueueResource {
  return {
    id: 1,
    playlist_id: 1,
    list_position: '1',
    playback_position: '0',
    media_file_duration: '0',
    completed: false,
    clip_id: null,
    item: makeItem(),
    item_id: 1,
    item_soundbite_id: null,
    ...(resourceData === undefined ? {} : { add_by_rss_resource_data: resourceData }),
  };
}

const FIRST: AddByRSSResourceData = {
  feed_url: 'https://feeds.example.com/show.xml',
  guid: 'episode-1',
  title: 'First',
};

const SECOND: AddByRSSResourceData = {
  ...FIRST,
  title: 'Second',
};

const OTHER: AddByRSSResourceData = {
  feed_url: 'https://feeds.example.com/show.xml',
  guid: 'episode-2',
  title: 'Other',
};

describe('pickAddByRSSResourceDataForHash', () => {
  it('returns the first matching row and skips null rows and rows without Add by RSS data', () => {
    const hash = addByRSSPlaybackIdentity(FIRST);
    if (hash === null) {
      throw new Error('fixture payload has no Add by RSS identity');
    }

    expect(
      pickAddByRSSResourceDataForHash(
        [null, row(undefined), row(null), row(OTHER), row(FIRST), row(SECOND)],
        hash
      )
    ).toBe(FIRST);
  });

  it('returns null when no identity matches', () => {
    expect(pickAddByRSSResourceDataForHash([null, row(undefined), row(FIRST)], 'not-a-hash')).toBe(
      null
    );
  });
});
