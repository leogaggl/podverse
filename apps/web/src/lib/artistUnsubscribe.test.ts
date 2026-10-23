import { describe, expect, it } from 'vitest';

import type { AddByRSSArtistAlbumEntry } from '../utils/addByRSS/publisherLinks';
import {
  countAddByRSSArtistFollowedAlbums,
  followedAddByRSSArtistAlbums,
  followedDirectoryArtistAlbumIdTexts,
  unsubscribeArtistBodyKey,
} from './artistUnsubscribe';

const followedAlbum = (feedUrl: string, idText: string): AddByRSSArtistAlbumEntry => ({
  kind: 'add_by_rss',
  source: {
    followed: true,
    feed: {
      id: 1,
      idText,
      resourceType: 'albums',
      feedUrl,
      title: idText,
      imageUrl: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
});

const listedAlbum = (feedUrl: string, idText: string): AddByRSSArtistAlbumEntry => ({
  kind: 'add_by_rss',
  source: {
    followed: false,
    feed: {
      id: 1,
      idText,
      resourceType: 'albums',
      feedUrl,
      title: idText,
      imageUrl: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      publisherParseRequestId: null,
      itemIdTextsByGuid: {},
      liveItemIdTextsByGuid: {},
    },
  },
});

const directoryAlbum = (channelIdText: string): AddByRSSArtistAlbumEntry => ({
  kind: 'directory',
  channelIdText,
  title: channelIdText,
  feedGuid: `${channelIdText}-guid`,
});

describe('followedDirectoryArtistAlbumIdTexts', () => {
  it('returns the one followed album among two verified albums', () => {
    expect(
      followedDirectoryArtistAlbumIdTexts({
        artistIdText: 'artistAda',
        albums: [
          { id: 1, id_text: 'albumOne' },
          { id: 2, id_text: 'albumTwo' },
        ],
        followingChannelIds: new Set([2]),
      })
    ).toEqual(['albumTwo']);
  });

  it('follows album order and keeps a duplicate id_text once', () => {
    expect(
      followedDirectoryArtistAlbumIdTexts({
        artistIdText: 'artistAda',
        albums: [
          { id: 2, id_text: 'albumTwo' },
          { id: 1, id_text: 'albumOne' },
          { id: 3, id_text: 'albumOne' },
        ],
        followingChannelIds: new Set([1, 2, 3]),
      })
    ).toEqual(['albumTwo', 'albumOne']);
  });

  it('skips the artist and an album with an empty id_text', () => {
    expect(
      followedDirectoryArtistAlbumIdTexts({
        artistIdText: 'artistAda',
        albums: [
          { id: 9, id_text: 'artistAda' },
          { id: 4, id_text: '' },
          { id: 5, id_text: 'albumKept' },
        ],
        followingChannelIds: new Set([9, 4, 5]),
      })
    ).toEqual(['albumKept']);
  });

  it('returns an empty list when nothing is followed', () => {
    expect(
      followedDirectoryArtistAlbumIdTexts({
        artistIdText: 'artistAda',
        albums: [{ id: 1, id_text: 'albumOne' }],
        followingChannelIds: new Set(),
      })
    ).toEqual([]);
  });
});

describe('followedAddByRSSArtistAlbums', () => {
  it('counts a followed Add by RSS album and skips a listed one', () => {
    expect(
      followedAddByRSSArtistAlbums({
        albums: [
          followedAlbum('https://a.example/feed.xml', 'album-a'),
          listedAlbum('https://b.example/feed.xml', 'album-b'),
          followedAlbum('https://c.example/feed.xml', 'album-c'),
        ],
        directoryChannelIdsByIdText: new Map(),
        followingChannelIds: new Set(),
      })
    ).toEqual({
      addByRSSFeeds: [
        { feedUrl: 'https://a.example/feed.xml', idText: 'album-a' },
        { feedUrl: 'https://c.example/feed.xml', idText: 'album-c' },
      ],
      directoryChannelIdTexts: [],
    });
  });

  it('counts a directory album only when its channel id is followed', () => {
    expect(
      followedAddByRSSArtistAlbums({
        albums: [
          directoryAlbum('dir-followed'),
          directoryAlbum('dir-not'),
          directoryAlbum('dir-followed'),
        ],
        directoryChannelIdsByIdText: new Map([
          ['dir-followed', 11],
          ['dir-not', 12],
        ]),
        followingChannelIds: new Set([11]),
      }).directoryChannelIdTexts
    ).toEqual(['dir-followed']);
  });

  it('skips a directory album whose channel id was not loaded', () => {
    expect(
      followedAddByRSSArtistAlbums({
        albums: [directoryAlbum('dir-missing'), directoryAlbum('dir-followed')],
        directoryChannelIdsByIdText: new Map([['dir-followed', 11]]),
        followingChannelIds: new Set([11, 99]),
      }).directoryChannelIdTexts
    ).toEqual(['dir-followed']);
  });

  it('counts one album per comparable feed URL, keeping the scheme', () => {
    expect(
      followedAddByRSSArtistAlbums({
        albums: [
          followedAlbum('http://Album.Example.com/a.xml', 'album-http'),
          followedAlbum('http://user:pass@album.example.com/a.xml', 'album-http-dup'),
          followedAlbum('https://album.example.com/a.xml', 'album-https'),
        ],
        directoryChannelIdsByIdText: new Map(),
        followingChannelIds: new Set(),
      }).addByRSSFeeds
    ).toEqual([
      { feedUrl: 'http://Album.Example.com/a.xml', idText: 'album-http' },
      { feedUrl: 'https://album.example.com/a.xml', idText: 'album-https' },
    ]);
  });
});

describe('countAddByRSSArtistFollowedAlbums', () => {
  it('adds the Add by RSS feeds and the directory albums', () => {
    expect(
      countAddByRSSArtistFollowedAlbums({
        addByRSSFeeds: [{ feedUrl: 'https://a.example/feed.xml', idText: 'album-a' }],
        directoryChannelIdTexts: ['dir-one', 'dir-two'],
      })
    ).toBe(3);
  });
});

describe('unsubscribeArtistBodyKey', () => {
  it('uses the one-album sentence for 1 and the several-albums sentence otherwise', () => {
    expect(unsubscribeArtistBodyKey(1)).toBe('unsubscribe_artist.followed_one_album');
    expect(unsubscribeArtistBodyKey(3)).toBe('unsubscribe_artist.followed_albums');
  });
});
