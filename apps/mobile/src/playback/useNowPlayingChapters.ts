import { useEffect, useMemo, useSyncExternalStore } from 'react';

import type { DTOItemChapter } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';
import { selectItemChapterForTime } from '@podverse/playback-core/selectItemChapterForTime';

import { useAuth } from '../auth/AuthProvider';
import type { MobileAuthRequestContext } from '../data';
import { segmentsRepository } from '../data';
import { warmItemDescription } from '../lib/content/itemDescriptionAccess';
import { useOfflineMode } from '../prefs/offlineMode';
import { usePlaybackProgress, usePlaybackSession } from './PlaybackProvider';
import { shouldAutoLoadAddByRssNowPlayingChapters } from './addByRssNowPlayingSectionsStore';
import {
  nowPlayingAddByRssSections,
  useNowPlayingAddByRssSections,
} from './nowPlayingAddByRssSections';
import { usePlaybackScrubPreview } from './playbackScrubPreviewStore';

const itemFromTarget = (target: PlaybackTarget | null) => {
  if (target === null) {
    return null;
  }
  switch (target.kind) {
    case 'clip':
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
    case 'livestream':
      return target.item;
    case 'add-by-rss':
      return null;
  }
};

type ChaptersCache = {
  chapters: DTOItemChapter[];
  itemIdText: string | null;
};

let chaptersCache: ChaptersCache = { chapters: [], itemIdText: null };
const EMPTY_CHAPTERS: DTOItemChapter[] = [];
const chaptersListeners = new Set<() => void>();
let inFlight: { itemIdText: string; promise: Promise<DTOItemChapter[]> } | null = null;

const emitChapters = (): void => {
  chaptersListeners.forEach((listener) => {
    listener();
  });
};

const getChaptersSnapshot = (): ChaptersCache => chaptersCache;

const subscribeChapters = (listener: () => void): (() => void) => {
  chaptersListeners.add(listener);
  return () => {
    chaptersListeners.delete(listener);
  };
};

const setChaptersCache = (itemIdText: string | null, chapters: DTOItemChapter[]): void => {
  if (
    chaptersCache.itemIdText === itemIdText &&
    chaptersCache.chapters.length === chapters.length &&
    chaptersCache.chapters.every(
      (chapter, index) =>
        chapter.id_text === chapters[index]?.id_text && chapter.img === chapters[index]?.img
    )
  ) {
    return;
  }
  chaptersCache = { chapters, itemIdText };
  emitChapters();
};

const loadChapters = async (
  context: MobileAuthRequestContext,
  itemIdText: string
): Promise<DTOItemChapter[]> => {
  if (chaptersCache.itemIdText === itemIdText) {
    return chaptersCache.chapters;
  }
  if (inFlight !== null && inFlight.itemIdText === itemIdText) {
    return inFlight.promise;
  }

  const promise = (async (): Promise<DTOItemChapter[]> => {
    try {
      const rows = await segmentsRepository.getChaptersByItemIdText(context, itemIdText);
      setChaptersCache(itemIdText, rows);
      return rows;
    } catch {
      setChaptersCache(itemIdText, []);
      return [];
    } finally {
      if (inFlight !== null && inFlight.itemIdText === itemIdText) {
        inFlight = null;
      }
    }
  })();

  inFlight = { itemIdText, promise };
  return promise;
};

/**
 * Imperative chapter load for transport (prev/next). Shares the process-wide cache with the UI hook.
 */
export const resolveNowPlayingChapters = async (
  context: MobileAuthRequestContext,
  itemIdText: string
): Promise<DTOItemChapter[]> => {
  return loadChapters(context, itemIdText);
};

/**
 * Chapters load once per now-playing item. Directory episodes use the process-wide cache; Add by
 * RSS items use the now-playing Add by RSS store, which needs a signed-in account and Offline Mode
 * off. Warms that episode's show notes for the full player. Does not subscribe to the playhead —
 * pair with {@link useActiveNowPlayingChapter} in leaf chrome.
 */
export function useNowPlayingChapters(): { chapters: DTOItemChapter[] } {
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const { activeTarget } = usePlaybackSession();
  const cache = useSyncExternalStore(subscribeChapters, getChaptersSnapshot, getChaptersSnapshot);
  const addByRssResourceData =
    activeTarget?.kind === 'add-by-rss' ? activeTarget.resourceData : null;
  const addByRssSections = useNowPlayingAddByRssSections(addByRssResourceData);

  const item = itemFromTarget(activeTarget);
  const chaptersItemIdText = item !== null ? item.id_text : null;

  useEffect(() => {
    if (item !== null) {
      warmItemDescription(item);
    }
  }, [item]);

  useEffect(() => {
    if (chaptersItemIdText === null) {
      setChaptersCache(null, []);
      return;
    }
    if (cache.itemIdText === chaptersItemIdText) {
      return;
    }
    void loadChapters({ accessToken, clearSession, refreshToken, setTokens }, chaptersItemIdText);
  }, [accessToken, cache.itemIdText, chaptersItemIdText, clearSession, refreshToken, setTokens]);

  useEffect(() => {
    if (
      !shouldAutoLoadAddByRssNowPlayingChapters({
        isAuthenticated: status === 'authenticated',
        offlineModeEnabled,
        snapshot: addByRssSections,
      })
    ) {
      return;
    }
    void nowPlayingAddByRssSections.load({
      accessToken,
      clearSession,
      refreshToken,
      setTokens,
    });
  }, [
    accessToken,
    addByRssSections,
    clearSession,
    offlineModeEnabled,
    refreshToken,
    setTokens,
    status,
  ]);

  if (activeTarget?.kind === 'add-by-rss') {
    return { chapters: addByRssSections.sections?.chapters ?? EMPTY_CHAPTERS };
  }

  return {
    chapters: cache.itemIdText === chaptersItemIdText ? cache.chapters : [],
  };
}

/**
 * Active chapter for the current playhead. Mount only in leaf chrome so the full-player shell stays
 * off the progress render path.
 */
export function useActiveNowPlayingChapter(chapters: DTOItemChapter[]): DTOItemChapter | null {
  const { activeTarget } = usePlaybackSession();
  const { positionSeconds } = usePlaybackProgress();
  const previewPositionSeconds = usePlaybackScrubPreview();
  const lookupSeconds = previewPositionSeconds ?? positionSeconds;

  return useMemo(() => {
    if (activeTarget?.kind === 'chapter' && previewPositionSeconds === null) {
      return activeTarget.chapter;
    }
    if (
      activeTarget === null ||
      activeTarget.kind === 'clip' ||
      activeTarget.kind === 'soundbite' ||
      activeTarget.kind === 'livestream'
    ) {
      return null;
    }
    return selectItemChapterForTime(chapters, lookupSeconds);
  }, [activeTarget, chapters, lookupSeconds, previewPositionSeconds]);
}
