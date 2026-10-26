import { describe, expect, it } from 'vitest';

import type { DTOAccount, DTOPlaylist } from '@podverse/helpers';
import { LiveItemStatusEnum } from '@podverse/helpers/dto';

import type { HomeFeedRowData } from '../home/homeFeedData';
import type { BrowseFeedResult } from './browseFeedData';
import { appendBrowseFeedPage } from './browseFeedPages';

const row = (
  id: string,
  title: string = id,
  liveStatusId: LiveItemStatusEnum | null = null
): HomeFeedRowData => ({
  id,
  imageUrl: null,
  liveStatusId,
  subtitle: null,
  title,
});

const playlist = (idText: string, title: string = idText): DTOPlaylist => ({
  id: 0,
  id_text: idText,
  is_default_likes: false,
  item_count: 0,
  last_updated: '2026-01-01T00:00:00.000Z',
  medium_id: 0,
  sharable_status_id: 0,
  title,
});

const account = (idText: string, verified: boolean = false): DTOAccount => ({
  id: 0,
  id_text: idText,
  verified,
});

const media = (rows: HomeFeedRowData[]): BrowseFeedResult => ({ kind: 'media', rows });

const mediaRows = (feed: BrowseFeedResult): HomeFeedRowData[] =>
  feed.kind === 'media' ? feed.rows : [];

describe('appendBrowseFeedPage', () => {
  it('appends page 2 media rows after page 1 in order', () => {
    const merged = appendBrowseFeedPage(media([row('a'), row('b')]), media([row('c'), row('d')]));

    expect(mediaRows(merged).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps a repeated row id once, at its page 1 position, with the page 2 value', () => {
    const merged = appendBrowseFeedPage(
      media([row('a'), row('b', 'Old'), row('c')]),
      media([row('b', 'New'), row('d')])
    );

    expect(mediaRows(merged).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(mediaRows(merged)[1]?.title).toBe('New');
  });

  it('appends and dedupes playlists by id_text', () => {
    const merged = appendBrowseFeedPage(
      { kind: 'playlists', playlists: [playlist('p1'), playlist('p2', 'Old')] },
      { kind: 'playlists', playlists: [playlist('p2', 'New'), playlist('p3')] }
    );

    expect(merged.kind).toBe('playlists');
    const playlists = merged.kind === 'playlists' ? merged.playlists : [];
    expect(playlists.map((p) => p.id_text)).toEqual(['p1', 'p2', 'p3']);
    expect(playlists[1]?.title).toBe('New');
  });

  it('appends and dedupes accounts by id_text', () => {
    const merged = appendBrowseFeedPage(
      { accounts: [account('u1'), account('u2', false)], kind: 'users' },
      { accounts: [account('u2', true), account('u3')], kind: 'users' }
    );

    expect(merged.kind).toBe('users');
    const accounts = merged.kind === 'users' ? merged.accounts : [];
    expect(accounts.map((a) => a.id_text)).toEqual(['u1', 'u2', 'u3']);
    expect(accounts[1]?.verified).toBe(true);
  });

  it('returns the current feed unchanged when the next page is a different kind', () => {
    const current = media([row('a')]);

    const merged = appendBrowseFeedPage(current, {
      kind: 'playlists',
      playlists: [playlist('p1')],
    });

    expect(merged).toBe(current);
  });

  it('keeps livestream pages in server order: Live first, then Scheduled soonest first', () => {
    const pageOne = media([
      row('live-latest', 'Live latest', LiveItemStatusEnum.Live),
      row('live-earlier', 'Live earlier', LiveItemStatusEnum.Live),
      row('scheduled-soonest', 'Scheduled soonest', LiveItemStatusEnum.Pending),
    ]);
    const pageTwo = media([
      row('scheduled-next', 'Scheduled next', LiveItemStatusEnum.Pending),
      row('scheduled-later', 'Scheduled later', LiveItemStatusEnum.Pending),
    ]);

    const merged = appendBrowseFeedPage(pageOne, pageTwo);

    expect(mediaRows(merged).map((r) => r.id)).toEqual([
      'live-latest',
      'live-earlier',
      'scheduled-soonest',
      'scheduled-next',
      'scheduled-later',
    ]);
  });
});
