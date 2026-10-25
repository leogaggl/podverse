import type { DTOItemChapter } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';
import { selectItemChapterForTime } from '@podverse/playback-core/selectItemChapterForTime';

import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
} from '../lib/addByRss/resourceData';

export type PlayingChapterSource = {
  /** Row media id of the playing item, comparable with a screen's item id or Add by RSS hash. */
  mediaId: string;
  /** Set when the target is one chapter; that chapter is marked whatever the position. */
  chapterIdText: string | null;
};

/**
 * What this phone's own target plays, in chapter terms. Null for a clip, an official clip, a
 * livestream, an Add by RSS livestream, or no target.
 */
export function playingChapterSourceFromTarget(
  target: PlaybackTarget | null
): PlayingChapterSource | null {
  if (target === null) {
    return null;
  }
  switch (target.kind) {
    case 'chapter':
      return { mediaId: target.item.id_text, chapterIdText: target.chapter.id_text };
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return { mediaId: target.item.id_text, chapterIdText: null };
    case 'add-by-rss':
      if (isAddByRssLivestreamResourceData(target.resourceData)) {
        return null;
      }
      return {
        mediaId: addByRssPlaybackMediaId(target.resourceData),
        chapterIdText: null,
      };
    case 'clip':
    case 'soundbite':
    case 'livestream':
      return null;
  }
}

/**
 * The chapter id to mark in one item's chapter list. A chapter target marks itself. Any other
 * matching item marks the chapter at the playhead, the same choice the segment strip uses.
 * Null when this list is a different item, or when there is no position and no chapter target.
 */
export function selectPlayingChapterIdText(params: {
  chapters: readonly DTOItemChapter[];
  itemMediaId: string | null;
  positionSeconds: number | null;
  source: PlayingChapterSource | null;
}): string | null {
  const { chapters, itemMediaId, positionSeconds, source } = params;
  if (itemMediaId === null || source === null || source.mediaId !== itemMediaId) {
    return null;
  }
  if (source.chapterIdText !== null) {
    return source.chapterIdText;
  }
  if (positionSeconds === null) {
    return null;
  }
  return selectItemChapterForTime(chapters.slice(), positionSeconds)?.id_text ?? null;
}
