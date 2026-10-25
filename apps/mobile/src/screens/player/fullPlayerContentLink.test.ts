import { describe, expect, it } from 'vitest';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import type { DTOPlaybackResourceSummary } from '@podverse/helpers/accountPlaybackStream';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import { directoryLineArtist } from '../../lib/playback/lineArtist';
import {
  fullPlayerArtistLink,
  fullPlayerOpenScreenLabelKey,
  playerContentStack,
  playerItemStackRoutes,
  resolveFullPlayerChannelLink,
  resolveFullPlayerTitleLink,
  resolveLocalAddByRssFeedIdText,
  resolveRemoteFullPlayerChannelLink,
  resolveRemoteFullPlayerTitleLink,
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
const noAddByRssItem = { feedIdText: null, itemKey: null };

describe('resolveFullPlayerTitleLink', () => {
  it('opens the episode for an episode, a chapter, an official clip, and a video', () => {
    expect(resolveFullPlayerTitleLink(episodeTarget, 'Episode', noAddByRssItem)?.kind).toBe(
      'episode'
    );
    expect(
      resolveFullPlayerTitleLink(
        { channel, item, kind: 'chapter', chapter: { id_text: 'ch' } } as PlaybackTarget,
        'Episode',
        noAddByRssItem
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
        'Episode',
        noAddByRssItem
      )?.kind
    ).toBe('episode');
    expect(
      resolveFullPlayerTitleLink({ channel, item, kind: 'item-video' }, 'Episode', noAddByRssItem)
        ?.kind
    ).toBe('episode');
  });

  it('opens the clip for a clip and the track for music', () => {
    expect(
      resolveFullPlayerTitleLink(
        { channel, clip: { id_text: 'clip-1' }, item, kind: 'clip' } as PlaybackTarget,
        'Clip',
        noAddByRssItem
      )
    ).toMatchObject({ idText: 'clip-1', kind: 'clip' });
    expect(
      resolveFullPlayerTitleLink(
        { channel, intent: 'explicit_play', item, kind: 'item-music' } as PlaybackTarget,
        'Track',
        noAddByRssItem
      )?.kind
    ).toBe('track');
  });

  it('opens the episode for a livestream that has an item, and skips a title with no item', () => {
    expect(
      resolveFullPlayerTitleLink({ channel, item, kind: 'livestream' }, 'Live', noAddByRssItem)
    ).toMatchObject({ idText: 'ep-1', kind: 'episode' });
    expect(
      resolveFullPlayerTitleLink(
        { channel, item: null, kind: 'livestream' },
        'Live',
        noAddByRssItem
      )
    ).toBe(null);
  });

  it('links a music track when the feed id and the item key are both set', () => {
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { medium_id: MediumEnum.Music, title: 'Track' } },
        'Track',
        { feedIdText: 'feed-1', itemKey: 'item-guid' }
      )
    ).toMatchObject({
      idText: 'feed-1',
      imageUrl: null,
      itemKey: 'item-guid',
      kind: 'add-by-rss-track',
    });
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { medium_id: MediumEnum.Music, title: 'Track' } },
        'Track',
        { feedIdText: 'feed-1', itemKey: null }
      )
    ).toBe(null);
  });

  it('links a podcast episode when the feed id and the item key are both set', () => {
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { medium_id: MediumEnum.Podcast, title: 'Episode' } },
        'Episode',
        { feedIdText: 'feed-1', itemKey: 'item-guid' }
      )
    ).toMatchObject({
      idText: 'feed-1',
      imageUrl: null,
      itemKey: 'item-guid',
      kind: 'add-by-rss-episode',
    });
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { medium_id: MediumEnum.Podcast, title: 'Episode' } },
        'Episode',
        { feedIdText: null, itemKey: 'item-guid' }
      )
    ).toBe(null);
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { medium_id: MediumEnum.Podcast, title: 'Episode' } },
        'Episode',
        { feedIdText: 'feed-1', itemKey: null }
      )
    ).toBe(null);
  });

  it('links an Add by RSS livestream, including one on a music feed, when both ids are set', () => {
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { liveItem: {}, title: 'Live' } },
        'Live',
        { feedIdText: 'feed-1', itemKey: 'studio-live' }
      )
    ).toMatchObject({
      idText: 'feed-1',
      itemKey: 'studio-live',
      kind: 'add-by-rss-livestream',
    });
    expect(
      resolveFullPlayerTitleLink(
        {
          kind: 'add-by-rss',
          resourceData: { liveItem: {}, medium_id: MediumEnum.Music, title: 'Live' },
        },
        'Live',
        { feedIdText: 'feed-1', itemKey: 'studio-live' }
      )?.kind
    ).toBe('add-by-rss-livestream');
    expect(
      resolveFullPlayerTitleLink(
        { kind: 'add-by-rss', resourceData: { liveItem: {}, title: 'Live' } },
        'Live',
        { feedIdText: 'feed-1', itemKey: null }
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

  it('opens the album for a livestream on an album feed and the podcast otherwise', () => {
    const livestream = (mediumId: MediumEnum): PlaybackTarget => ({
      channel: { ...channel, medium_id: mediumId },
      item,
      kind: 'livestream',
    });
    expect(
      resolveFullPlayerChannelLink(livestream(MediumEnum.Music), 'Album One', null)
    ).toMatchObject({ idText: 'show-1', kind: 'album', name: 'Album One' });
    expect(
      resolveFullPlayerChannelLink(livestream(MediumEnum.MusicL), 'Album One', null)?.kind
    ).toBe('album');
    expect(
      resolveFullPlayerChannelLink(livestream(MediumEnum.PublisherMusic), 'Album One', null)?.kind
    ).toBe('podcast');
    expect(
      resolveFullPlayerChannelLink(livestream(MediumEnum.Podcast), 'Album One', null)?.kind
    ).toBe('podcast');
  });

  it('opens Add by RSS only after this device resolves a local feed', () => {
    const target: PlaybackTarget = { kind: 'add-by-rss', resourceData: { title: 'Feed' } };
    expect(resolveFullPlayerChannelLink(target, 'Feed', null)).toBe(null);
    expect(resolveFullPlayerChannelLink(target, 'Feed', 'local-feed')?.idText).toBe('local-feed');
  });
});

describe('fullPlayerArtistLink', () => {
  it('maps a directory artist to an artist page with a trimmed title and no artwork', () => {
    expect(
      fullPlayerArtistLink(
        directoryLineArtist({
          id_text: 'artist-1',
          medium_id: MediumEnum.PublisherMusic,
          title: '  Artist Name  ',
        })
      )
    ).toEqual({
      idText: 'artist-1',
      imageUrl: null,
      kind: 'artist',
      name: 'Artist Name',
    });
  });

  it('maps an Add by RSS artist to its Add by RSS page on Home', () => {
    const link = fullPlayerArtistLink({
      kind: 'add-by-rss',
      feedIdText: 'rss-artist-id',
      feedUrl: 'https://example.com/artist.xml',
      title: ' RSS Artist ',
    });
    expect(link).toEqual({
      idText: 'rss-artist-id',
      imageUrl: null,
      kind: 'add-by-rss',
      name: 'RSS Artist',
    });
    expect(playerContentStack({ isSubscribed: false, kind: link.kind })).toBe('Home');
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
    expect(playerContentStack({ isSubscribed: true, kind: 'album' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: false, kind: 'album' })).toBe('Browse');
    expect(playerContentStack({ isSubscribed: false, kind: 'episode' })).toBe('Browse');
    expect(playerContentStack({ isSubscribed: false, kind: 'clip' })).toBe('Browse');
    expect(playerContentStack({ isSubscribed: false, kind: 'add-by-rss' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: false, kind: 'add-by-rss-episode' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: false, kind: 'add-by-rss-track' })).toBe('Home');
    expect(playerContentStack({ isSubscribed: false, kind: 'add-by-rss-livestream' })).toBe('Home');
  });
});

describe('fullPlayerOpenScreenLabelKey', () => {
  it('names an Add by RSS track as a track', () => {
    expect(fullPlayerOpenScreenLabelKey('add-by-rss-track')).toBe('media.music.track');
  });

  it('names an Add by RSS livestream as a livestream', () => {
    expect(fullPlayerOpenScreenLabelKey('add-by-rss-livestream')).toBe(
      'media.livestream.livestream'
    );
  });
});

const remoteSummary = (
  ref: DTOPlaybackResourceSummary['ref'],
  medium: MediumEnum,
  titles: { channelTitle?: string | null; imageUrl?: string | null; title?: string | null } = {}
): DTOPlaybackResourceSummary => ({
  channel_title: titles.channelTitle === undefined ? 'Show' : titles.channelTitle,
  image_url: titles.imageUrl === undefined ? 'https://example.com/art.jpg' : titles.imageUrl,
  medium,
  ref,
  title: titles.title === undefined ? 'Episode' : titles.title,
});

const remoteAddByRss = {
  feedIdText: 'feed-1',
  itemKey: 'item-guid',
  resourceData: { medium_id: MediumEnum.Podcast, title: 'Episode' },
};

describe('resolveRemoteFullPlayerTitleLink', () => {
  const emptyAddByRss = { feedIdText: null, itemKey: null, resourceData: null };

  it('opens an episode for a podcast item, including a live one, and a track for music', () => {
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ item_id_text: 'ep-1', kind: 'item' }, MediumEnum.Podcast),
        emptyAddByRss
      )
    ).toEqual({
      idText: 'ep-1',
      imageUrl: 'https://example.com/art.jpg',
      kind: 'episode',
      name: 'Episode',
    });
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ item_id_text: 'ep-live', kind: 'item' }, MediumEnum.Podcast, {
          title: 'Live',
        }),
        emptyAddByRss
      )?.kind
    ).toBe('episode');
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ item_id_text: 'track-1', kind: 'item' }, MediumEnum.Music, {
          title: 'Track',
        }),
        emptyAddByRss
      )
    ).toMatchObject({ idText: 'track-1', kind: 'track', name: 'Track' });
  });

  it('opens the clip screen and skips a soundbite', () => {
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ clip_id_text: 'clip-1', kind: 'clip' }, MediumEnum.Podcast, {
          title: 'Clip',
        }),
        emptyAddByRss
      )
    ).toEqual({ idText: 'clip-1', imageUrl: null, kind: 'clip', name: 'Clip' });
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ item_soundbite_id_text: 'sb-1', kind: 'soundbite' }, MediumEnum.Podcast, {
          title: 'Soundbite',
        }),
        emptyAddByRss
      )
    ).toBe(null);
  });

  it('links Add by RSS episode, track, and livestream pages when this phone has the item', () => {
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' }, MediumEnum.Podcast),
        remoteAddByRss
      )
    ).toMatchObject({
      idText: 'feed-1',
      imageUrl: null,
      itemKey: 'item-guid',
      kind: 'add-by-rss-episode',
    });
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' }, MediumEnum.Music, {
          title: 'Track',
        }),
        { ...remoteAddByRss, resourceData: { medium_id: MediumEnum.Music, title: 'Track' } }
      )?.kind
    ).toBe('add-by-rss-track');
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' }, MediumEnum.Music, {
          title: 'Live',
        }),
        {
          ...remoteAddByRss,
          resourceData: { liveItem: {}, medium_id: MediumEnum.Music, title: 'Live' },
        }
      )
    ).toMatchObject({ itemKey: 'item-guid', kind: 'add-by-rss-livestream' });
  });

  it('returns null when the title is blank or any Add by RSS id is missing', () => {
    expect(
      resolveRemoteFullPlayerTitleLink(
        remoteSummary({ item_id_text: 'ep-1', kind: 'item' }, MediumEnum.Podcast, { title: '  ' }),
        emptyAddByRss
      )
    ).toBe(null);
    const addByRssItem = remoteSummary(
      { add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' },
      MediumEnum.Podcast
    );
    expect(
      resolveRemoteFullPlayerTitleLink(addByRssItem, { ...remoteAddByRss, feedIdText: null })
    ).toBe(null);
    expect(
      resolveRemoteFullPlayerTitleLink(addByRssItem, { ...remoteAddByRss, itemKey: null })
    ).toBe(null);
    expect(
      resolveRemoteFullPlayerTitleLink(addByRssItem, { ...remoteAddByRss, resourceData: null })
    ).toBe(null);
  });
});

describe('resolveRemoteFullPlayerChannelLink', () => {
  it('links only an Add by RSS feed this phone has', () => {
    const addByRss = remoteSummary(
      { add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' },
      MediumEnum.Podcast,
      { channelTitle: 'Feed' }
    );
    expect(resolveRemoteFullPlayerChannelLink(addByRss, 'feed-1')).toEqual({
      idText: 'feed-1',
      imageUrl: null,
      kind: 'add-by-rss',
      name: 'Feed',
    });
    expect(resolveRemoteFullPlayerChannelLink(addByRss, null)).toBe(null);
    expect(resolveRemoteFullPlayerChannelLink(addByRss, '   ')).toBe(null);
    expect(
      resolveRemoteFullPlayerChannelLink(
        remoteSummary({ item_id_text: 'ep-1', kind: 'item' }, MediumEnum.Podcast),
        'feed-1'
      )
    ).toBe(null);
    expect(
      resolveRemoteFullPlayerChannelLink(
        remoteSummary({ clip_id_text: 'clip-1', kind: 'clip' }, MediumEnum.Podcast),
        null
      )
    ).toBe(null);
    expect(
      resolveRemoteFullPlayerChannelLink(
        remoteSummary({ item_soundbite_id_text: 'sb-1', kind: 'soundbite' }, MediumEnum.Podcast),
        null
      )
    ).toBe(null);
    expect(
      resolveRemoteFullPlayerChannelLink(
        remoteSummary({ add_by_rss_hash_id: 'hash-1', kind: 'add_by_rss' }, MediumEnum.Podcast, {
          channelTitle: '  ',
        }),
        'feed-1'
      )
    ).toBe(null);
  });
});

describe('playerItemStackRoutes', () => {
  const channel = { name: 'PodcastDetail', params: { podcastId: 'show-1' } };
  const item = { name: 'EpisodeDetail', params: { episodeId: 'ep-1' } };

  it('puts Home root under the channel, then the episode', () => {
    expect(playerItemStackRoutes('HomeRoot', channel, item)).toEqual([
      { name: 'HomeRoot' },
      { name: 'PodcastDetail', params: { podcastId: 'show-1' } },
      { name: 'EpisodeDetail', params: { episodeId: 'ep-1' } },
    ]);
  });

  it('puts Browse root under the same channel and episode', () => {
    expect(playerItemStackRoutes('BrowseRoot', channel, item)).toEqual([
      { name: 'BrowseRoot' },
      { name: 'PodcastDetail', params: { podcastId: 'show-1' } },
      { name: 'EpisodeDetail', params: { episodeId: 'ep-1' } },
    ]);
  });
});
