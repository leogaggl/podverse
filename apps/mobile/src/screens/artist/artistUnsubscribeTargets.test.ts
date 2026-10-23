import { describe, expect, it } from 'vitest';

import type { AddByRssArtistAlbumEntry } from '../home/addByRss/addByRssArtistAlbums';
import type { ArtistFollowTarget } from './artistUnsubscribeTargets';
import {
  artistUnsubscribeTargets,
  followedAddByRssArtistAlbums,
  followedDirectoryArtistAlbums,
  unsubscribeArtistBodyKey,
} from './artistUnsubscribeTargets';

const ARTIST_URL = 'https://example.com/artist.xml';

const addByRssAlbum = (feedUrl: string, followed?: boolean): AddByRssArtistAlbumEntry => ({
  kind: 'add-by-rss',
  feed: {
    enclosureUrl: null,
    feedUrl,
    ...(followed === undefined ? {} : { followed }),
    id: 1,
    idText: 'feed1',
    imageUrl: null,
    latestItemPubDateMs: null,
    playbackPosition: null,
    resourceType: 'albums',
    title: feedUrl,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
});

const directoryAlbum = (channelIdText: string): AddByRssArtistAlbumEntry => ({
  kind: 'directory',
  channelIdText,
  imageUrl: null,
  title: channelIdText,
});

describe('artistUnsubscribeTargets', () => {
  it('lists the followed verified albums of a directory artist once each, never the artist', () => {
    expect(
      followedDirectoryArtistAlbums({
        artistIdText: 'artist1',
        verifiedAlbumIdTexts: ['albumA', 'albumB', ' albumA ', '', 'artist1'],
        subscribedDirectoryIdTexts: new Set(['albumA', 'artist1']),
      })
    ).toEqual([{ idText: 'albumA', source: 'directory' }]);
  });

  it('counts followed Add by RSS albums by feed URL and directory albums only when subscribed', () => {
    expect(
      followedAddByRssArtistAlbums({
        artistFeedUrl: ARTIST_URL,
        albums: [
          addByRssAlbum('https://example.com/followed.xml'),
          addByRssAlbum('https://example.com/listed-only.xml', false),
          directoryAlbum('dirSubscribed'),
          directoryAlbum('dirNotSubscribed'),
          addByRssAlbum(ARTIST_URL, true),
          addByRssAlbum(' https://example.com/followed.xml ', true),
        ],
        subscribedDirectoryIdTexts: new Set(['dirSubscribed']),
      })
    ).toEqual([
      { idText: 'https://example.com/followed.xml', source: 'addByRss' },
      { idText: 'dirSubscribed', source: 'directory' },
    ]);
  });

  it('ends just the artist for Artist Only, and the artist then the albums for Artist and Albums', () => {
    const artist: ArtistFollowTarget = { idText: 'artist1', source: 'directory' };
    const albums: ArtistFollowTarget[] = [
      { idText: 'albumA', source: 'directory' },
      { idText: 'https://example.com/b.xml', source: 'addByRss' },
    ];
    expect(artistUnsubscribeTargets({ artist, albums, choice: 'artist_only' })).toEqual([artist]);
    expect(artistUnsubscribeTargets({ artist, albums, choice: 'artist_and_albums' })).toEqual([
      artist,
      ...albums,
    ]);
  });

  it('picks the one-album body for one album and the several-albums body otherwise', () => {
    expect(unsubscribeArtistBodyKey(1)).toBe('features.unsubscribe_artist.followed_one_album');
    expect(unsubscribeArtistBodyKey(2)).toBe('features.unsubscribe_artist.followed_albums');
  });
});
