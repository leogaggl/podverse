import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers';

import type { FeedObject, PodcastPublisherClaim } from '../../types/partytime.js';
import { compatChannelPublisherRemoteItemDtos } from './channel.js';

const ARTIST_GUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const LABEL_GUID = '22222222-2222-4222-8222-222222222222';

function feed(overrides: Partial<FeedObject> = {}): FeedObject {
  return {
    title: 'Album',
    explicit: false,
    link: 'https://example.com',
    items: [],
    ...overrides,
  };
}

describe('compatChannelPublisherRemoteItemDtos', () => {
  it.each([
    { name: 'omitted', parsedFeed: feed() },
    { name: 'null', parsedFeed: feed({ podcastPublisher: null }) },
  ])('returns an empty list when podcastPublisher is $name', ({ parsedFeed }) => {
    expect(compatChannelPublisherRemoteItemDtos(parsedFeed)).toEqual([]);
  });

  it('maps one publisher object to one dto', () => {
    const dtos = compatChannelPublisherRemoteItemDtos(
      feed({
        podcastPublisher: {
          feedGuid: ARTIST_GUID,
          feedUrl: 'https://artist.example/feed',
          itemGuid: 'track-1',
          title: 'Artist Name',
          medium: 'music',
        },
      })
    );

    expect(dtos).toEqual([
      {
        feed_guid: ARTIST_GUID,
        feed_url: 'https://artist.example/feed',
        item_guid: 'track-1',
        title: 'Artist Name',
        medium_id: MediumEnum.Music,
      },
    ]);
  });

  it('maps an array of two different guids in feed order', () => {
    const dtos = compatChannelPublisherRemoteItemDtos(
      feed({
        podcastPublisher: [
          { feedGuid: ARTIST_GUID, title: 'Artist' },
          { feedGuid: LABEL_GUID, title: 'Label' },
        ],
      })
    );

    expect(dtos).toEqual([
      {
        feed_guid: ARTIST_GUID,
        feed_url: null,
        item_guid: null,
        title: 'Artist',
        medium_id: null,
      },
      {
        feed_guid: LABEL_GUID,
        feed_url: null,
        item_guid: null,
        title: 'Label',
        medium_id: null,
      },
    ]);
  });

  it('keeps the first claim when a later guid differs only by case', () => {
    const dtos = compatChannelPublisherRemoteItemDtos(
      feed({
        podcastPublisher: [
          { feedGuid: ARTIST_GUID.toUpperCase(), title: 'First', itemGuid: 'track-1' },
          { feedGuid: ARTIST_GUID, title: 'Second', itemGuid: 'track-1' },
        ],
      })
    );

    expect(dtos).toEqual([
      {
        feed_guid: ARTIST_GUID.toUpperCase(),
        feed_url: null,
        item_guid: 'track-1',
        title: 'First',
        medium_id: null,
      },
    ]);
  });

  it('keeps claims that share a feed guid when their item guids differ', () => {
    const dtos = compatChannelPublisherRemoteItemDtos(
      feed({
        podcastPublisher: [
          { feedGuid: ARTIST_GUID, itemGuid: 'track-1', title: 'Track One' },
          { feedGuid: ARTIST_GUID, itemGuid: 'track-2', title: 'Track Two' },
        ],
      })
    );

    expect(dtos.map((dto) => dto.item_guid)).toEqual(['track-1', 'track-2']);
  });

  it('skips an entry with no feedGuid and keeps a later claim', () => {
    const missingGuid: PodcastPublisherClaim = {
      feedGuid: '00000000-0000-4000-8000-000000000000',
      title: 'Missing',
    };
    Reflect.deleteProperty(missingGuid, 'feedGuid');

    const dtos = compatChannelPublisherRemoteItemDtos(
      feed({
        podcastPublisher: [
          missingGuid,
          { feedGuid: '', title: 'Empty' },
          { feedGuid: ARTIST_GUID, title: 'Kept' },
        ],
      })
    );

    expect(dtos).toEqual([
      {
        feed_guid: ARTIST_GUID,
        feed_url: null,
        item_guid: null,
        title: 'Kept',
        medium_id: null,
      },
    ]);
  });
});
