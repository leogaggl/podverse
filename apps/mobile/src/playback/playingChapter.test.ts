import { describe, expect, it } from 'vitest';

import type {
  AddByRSSResourceData,
  DTOChannel,
  DTOClip,
  DTOItem,
  DTOItemChapter,
  DTOItemSoundbite,
} from '@podverse/helpers/dto';

import { addByRssPlaybackMediaId } from '../lib/addByRss/resourceData';
import { playingChapterSourceFromTarget, selectPlayingChapterIdText } from './playingChapter';

const channel = { id: 1, id_text: 'ch', medium_id: 1, title: 'Channel' } as DTOChannel;
const item = { id: 1, id_text: 'it', title: 'Episode' } as DTOItem;

const chapter = (over: Partial<DTOItemChapter>): DTOItemChapter =>
  ({
    end_time: '60',
    id: 1,
    id_text: 'c1',
    start_time: '0',
    table_of_contents: true,
    title: 'Chapter one',
    ...over,
  }) as DTOItemChapter;

const chapters = [
  chapter({ end_time: '30', id: 1, id_text: 'c1', start_time: '0', title: 'Intro' }),
  chapter({ end_time: '90', id: 2, id_text: 'c2', start_time: '60', title: 'Interview' }),
];

const matchingSource = { chapterIdText: null, mediaId: 'it' };

describe('playingChapterSourceFromTarget', () => {
  it('gives a chapter target its item id and chapter id', () => {
    const playing = chapter({ id_text: 'c1', title: 'Intro' });
    expect(
      playingChapterSourceFromTarget({ channel, chapter: playing, item, kind: 'chapter' })
    ).toEqual({ chapterIdText: 'c1', mediaId: 'it' });
  });

  it('gives an item target its item id', () => {
    expect(playingChapterSourceFromTarget({ channel, item, kind: 'item-podcast' })).toEqual(
      matchingSource
    );
    expect(playingChapterSourceFromTarget({ channel, item, kind: 'item-video' })).toEqual(
      matchingSource
    );
    expect(
      playingChapterSourceFromTarget({
        channel,
        intent: 'explicit_play',
        item,
        kind: 'item-music',
      })
    ).toEqual(matchingSource);
  });

  it('gives an Add by RSS episode its hash', () => {
    const resourceData: AddByRSSResourceData = {
      feed_url: 'https://example.com/feed.xml',
      guid: 'episode-guid-1',
    };
    expect(playingChapterSourceFromTarget({ kind: 'add-by-rss', resourceData })).toEqual({
      chapterIdText: null,
      mediaId: addByRssPlaybackMediaId(resourceData),
    });
  });

  it('returns null for livestreams, clips, official clips, and no target', () => {
    const liveResource: AddByRSSResourceData = {
      feed_url: 'https://example.com/feed.xml',
      guid: 'live-1',
      liveItem: { status: 'live' },
    };
    const clip = {
      end_time: '40',
      id: 1,
      id_text: 'cl',
      item,
      start_time: '12',
      title: 'Best bit',
    } as DTOClip;
    const soundbite = {
      duration: '20',
      id: 1,
      id_text: 'sb',
      item,
      item_id: 1,
      start_time: '30',
      title: 'Host reads the ads',
    } as DTOItemSoundbite;

    expect(
      playingChapterSourceFromTarget({ kind: 'add-by-rss', resourceData: liveResource })
    ).toBeNull();
    expect(playingChapterSourceFromTarget({ channel, clip, item, kind: 'clip' })).toBeNull();
    expect(
      playingChapterSourceFromTarget({ channel, item, kind: 'soundbite', soundbite })
    ).toBeNull();
    expect(playingChapterSourceFromTarget({ channel, item: null, kind: 'livestream' })).toBeNull();
    expect(playingChapterSourceFromTarget(null)).toBeNull();
  });
});

describe('selectPlayingChapterIdText', () => {
  it('marks the chapter at the position when the item ids match', () => {
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: 70,
        source: matchingSource,
      })
    ).toBe('c2');
  });

  it('marks nothing when ids differ or a required value is missing', () => {
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: 10,
        source: { chapterIdText: null, mediaId: 'other' },
      })
    ).toBeNull();
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: 10,
        source: null,
      })
    ).toBeNull();
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: null,
        positionSeconds: 10,
        source: matchingSource,
      })
    ).toBeNull();
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: null,
        source: matchingSource,
      })
    ).toBeNull();
  });

  it('keeps a chapter target on that chapter whatever the position', () => {
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: 70,
        source: { chapterIdText: 'c1', mediaId: 'it' },
      })
    ).toBe('c1');
  });

  it('marks nothing in a gap between chapters', () => {
    expect(
      selectPlayingChapterIdText({
        chapters,
        itemMediaId: 'it',
        positionSeconds: 45,
        source: matchingSource,
      })
    ).toBeNull();
  });
});
