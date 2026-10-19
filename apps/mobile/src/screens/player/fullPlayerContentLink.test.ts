import { describe, expect, it } from 'vitest';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import {
  playerContentStack,
  resolveFullPlayerChannelLink,
  resolveFullPlayerTitleLink,
  resolveLocalAddByRssFeedIdText,
} from './fullPlayerContentLink';

// The resolver reads ids, titles, medium, and images only.
const channelFields: Partial<DTOChannel> = {
  channel_images: [],
  id_text: 'show-1',
  medium_id: MediumEnum.Podcast,
  title: 'Show',
};
const channel = channelFields as DTOChannel;

const itemFields: Partial<DTOItem> = {
  id_text: 'ep-1',
  item_images: [],
  title: 'Episode',
};
const item = itemFields as DTOItem;

const episodeTarget: PlaybackTarget = { channel, item, kind: 'item-podcast' };

describe('resolveFullPlayerTitleLink', () => {
  it('opens the episode for an episode, a chapter, an official clip, and a video', () => {
    expect(resolveFullPlayerTitleLink(episodeTarget, 'Episode')?.kind).toBe('episode');
    expect(
      resolveFullPlayerTitleLink(
        { channel, item, kind: 'chapter', chapter: { id_text: 'ch' } } as PlaybackTarget,
        'Episode'
      )?.idText
    ).toBe('ep-1');
    expect(
      resolveFullPlayerTitleLink(
        {
          channel,
          item,
          kind: 'soundbite',
          soundbite: { id_text: 'sb' },
        } as PlaybackTarget,
        'Episode'
      )?.kind
    ).toBe('episode');
    expect(resolveFullPlayerTitleLink({ channel, item, kind: 'item-video' }, 'Episode')?.kind).toBe(
      'episode'
    );
  });

  it('opens the clip for a clip and the track for music', () => {
    expect(
      resolveFullPlayerTitleLink(
        { channel, clip: { id_text: 'clip-1' }, item, kind: 'clip' } as PlaybackTarget,
        'Clip'
      )
    ).toMatchObject({ idText: 'clip-1', kind: 'clip' });
    expect(
      resolveFullPlayerTitleLink(
        { channel, intent: 'explicit_play', item, kind: 'item-music' } as PlaybackTarget,
        'Track'
      )?.kind
    ).toBe('track');
  });

  it('opens the episode for a livestream that has an item, and skips a title with no item', () => {
    expect(resolveFullPlayerTitleLink({ channel, item, kind: 'livestream' }, 'Live')?.kind).toBe(
      'episode'
    );
    expect(resolveFullPlayerTitleLink({ channel, item: null, kind: 'livestream' }, 'Live')).toBe(
      null
    );
  });

  it('does not link an Add by RSS title', () => {
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { title: 'Private' } },
        'Private'
      )
    ).toBe(null);
  });
});

describe('resolveFullPlayerChannelLink', () => {
  it('opens the podcast for an episode and the artist or album for music', () => {
    expect(resolveFullPlayerChannelLink(episodeTarget, 'Show', null)?.kind).toBe('podcast');
    const artistChannel = { ...channel, medium_id: MediumEnum.PublisherMusic };
    expect(
      resolveFullPlayerChannelLink(
        { channel: artistChannel, intent: 'explicit_play', item, kind: 'item-music' },
        'Artist',
        null
      )?.kind
    ).toBe('artist');
    const albumChannel = { ...channel, medium_id: MediumEnum.Music };
    expect(
      resolveFullPlayerChannelLink(
        { channel: albumChannel, intent: 'explicit_play', item, kind: 'item-music' },
        'Album',
        null
      )?.kind
    ).toBe('album');
  });

  it('opens Add by RSS only after this device resolves a local feed', () => {
    const target: PlaybackTarget = { kind: 'add-by-rss', resourceData: { title: 'Feed' } };
    expect(resolveFullPlayerChannelLink(target, 'Feed', null)).toBe(null);
    expect(resolveFullPlayerChannelLink(target, 'Feed', 'local-feed')?.idText).toBe('local-feed');
  });
});

describe('resolveLocalAddByRssFeedIdText', () => {
  it('prefers a local id, then the feed URL', async () => {
    const lookup = {
      getFeedByIdText: async (idText: string) => (idText === 'local' ? { idText: 'local' } : null),
      getFeedByUrl: async (feedUrl: string) =>
        feedUrl === 'https://example.com/feed.xml' ? { idText: 'from-url' } : null,
    };

    await expect(
      resolveLocalAddByRssFeedIdText(
        { channel_id_text: 'local', feed_url: 'https://example.com/feed.xml' },
        lookup
      )
    ).resolves.toBe('local');
    await expect(
      resolveLocalAddByRssFeedIdText(
        { channel_id_text: 'other-device', feed_url: 'https://example.com/feed.xml' },
        lookup
      )
    ).resolves.toBe('from-url');
    await expect(
      resolveLocalAddByRssFeedIdText({ channel_id_text: 'missing' }, lookup)
    ).resolves.toBe(null);
  });
});

describe('playerContentStack', () => {
  it('opens a follow on Home and everything else on Browse', () => {
    expect(playerContentStack({ isSubscribed: true, kind: 'episode' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: true, kind: 'podcast' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: false, kind: 'episode' })).toBe('Browse');
    expect(playerContentStack({ isSubscribed: false, kind: 'clip' })).toBe('Browse');
    expect(playerContentStack({ isSubscribed: false, kind: 'add-by-rss' })).toBe('Home');
  });
});
