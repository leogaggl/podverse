import { describe, expect, it } from 'vitest';

import type { DTOChannel } from '@podverse/helpers';
import { buildArtistPath, MediumEnum } from '@podverse/helpers';

import type { ArtistLineLink } from './artistPublishers';
import {
  artistPublishersForAlbum,
  compactArtistAlbumLine,
  presentArtistLine,
  presentArtistLineLinks,
} from './artistPublishers';

describe('artistPublishers', () => {
  it('presents one verified artist as a link', () => {
    const channel = {
      medium_id: MediumEnum.Music,
      verified_publishers: [
        { id_text: 'artistAda', title: 'Ada', medium_id: MediumEnum.PublisherMusic },
      ],
    } as DTOChannel;

    expect(presentArtistLine(artistPublishersForAlbum(channel, null))).toEqual({
      kind: 'link',
      link: {
        idText: 'artistAda',
        title: 'Ada',
        href: buildArtistPath('artistAda'),
      },
    });
  });

  it('presents several verified artists as a chooser in list order', () => {
    const channel = {
      medium_id: MediumEnum.Music,
      verified_publishers: [
        { id_text: 'artistAda', title: 'Ada', medium_id: MediumEnum.PublisherMusic },
        { id_text: 'artistBea', title: 'Bea', medium_id: MediumEnum.PublisherMusic },
      ],
    } as DTOChannel;

    expect(presentArtistLine(artistPublishersForAlbum(channel, null))).toEqual({
      kind: 'chooser',
      label: 'Ada, Bea',
      links: [
        { idText: 'artistAda', title: 'Ada', href: buildArtistPath('artistAda') },
        { idText: 'artistBea', title: 'Bea', href: buildArtistPath('artistBea') },
      ],
    });
  });

  it('leaves a music-medium publisher off the album artist line', () => {
    const channel = {
      medium_id: MediumEnum.Music,
      verified_publishers: [
        { id_text: 'artistAda', title: 'Ada', medium_id: MediumEnum.PublisherMusic },
        { id_text: 'albumPub', title: 'Album Credit', medium_id: MediumEnum.Music },
      ],
    } as DTOChannel;

    expect(artistPublishersForAlbum(channel, null).map((publisher) => publisher.id_text)).toEqual([
      'artistAda',
    ]);
  });

  it('hides the line when the only publisher title is blank', () => {
    const blank = {
      id_text: 'artistBlank',
      title: '  ',
      medium_id: MediumEnum.PublisherMusic,
    };
    const channel = {
      medium_id: MediumEnum.Music,
      verified_publishers: [blank],
    } as DTOChannel;

    expect(artistPublishersForAlbum(channel, null)).toEqual([]);
    expect(presentArtistLine([blank])).toEqual({ kind: 'hidden' });
  });

  it('returns no artists for a podcast channel', () => {
    const channel = {
      medium_id: MediumEnum.Podcast,
      verified_publishers: [
        { id_text: 'artistAda', title: 'Ada', medium_id: MediumEnum.PublisherMusic },
      ],
    } as DTOChannel;

    expect(artistPublishersForAlbum(channel, null)).toEqual([]);
  });

  it('links a publisher-music artist on a MusicL album', () => {
    const channel = {
      medium_id: MediumEnum.MusicL,
      verified_publishers: [
        { id_text: 'artistAda', title: 'Ada', medium_id: MediumEnum.PublisherMusic },
      ],
    } as DTOChannel;

    expect(presentArtistLine(artistPublishersForAlbum(channel, null))).toEqual({
      kind: 'link',
      link: {
        idText: 'artistAda',
        title: 'Ada',
        href: buildArtistPath('artistAda'),
      },
    });
  });

  it('returns no artists when the channel has no verified publishers', () => {
    const channel = {
      medium_id: MediumEnum.Music,
    } as DTOChannel;

    expect(artistPublishersForAlbum(channel, null)).toEqual([]);
  });

  it('presents resolved links as hidden, one link, or a chooser labelled with the titles', () => {
    const ada: ArtistLineLink = {
      idText: 'artistAda',
      title: 'A',
      href: '/add-by-rss/artist/artistAda',
    };
    const bea: ArtistLineLink = { idText: 'artistBea', title: 'B', href: '/artist/artistBea' };

    expect(presentArtistLineLinks([])).toEqual({ kind: 'hidden' });
    expect(presentArtistLineLinks([ada])).toEqual({ kind: 'link', link: ada });
    expect(presentArtistLineLinks([ada, bea])).toEqual({
      kind: 'chooser',
      label: 'A, B',
      links: [ada, bea],
    });
  });

  it('joins the artist and the album, and drops whichever side is empty', () => {
    expect(compactArtistAlbumLine('Ada', 'Album')).toBe('Ada · Album');
    expect(compactArtistAlbumLine('', 'Album')).toBe('Album');
    expect(compactArtistAlbumLine('Ada', null)).toBe('Ada');
    expect(compactArtistAlbumLine('', null)).toBeNull();
  });
});
