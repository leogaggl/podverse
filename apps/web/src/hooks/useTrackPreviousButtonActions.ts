'use client';

import { useCallback } from 'react';

import type { DTOItem } from '@podverse/helpers';
import { resolveAutoQueuePrevious } from '@podverse/playback-core';

import { useAddByRSSListContext } from '../contexts/AddByRSSListContext';
import { useAutoQueue } from '../contexts/AutoQueue';
import { useMediaPlayer } from '../contexts/MediaPlayer';
import { useMediaPlayerControls } from '../contexts/MediaPlayerControls';
import { useMediaPlayerCurrentTime } from '../contexts/MediaPlayerCurrentTime';
import { getApiRequestService } from '../factories/apiRequestService';
import { createWebAutoQueueSourceFetchers } from '../lib/autoQueue/webAutoQueueSourceFetchers';
import { playbackTargetFromStandardLoad } from '../lib/playback';
import { resolveAddByRSSListContextFromCurrentItem } from '../utils/addByRSS/resolveListContextFromCurrentItem';
import { useAddByRSSPlayPrevious } from './useAddByRSSPlayPrevious';
import { useEpisodeChapterNavigation } from './useEpisodeChapterNavigation';
import { useLongPress } from './useLongPress';
import { useMediaPlayerResourceUpdate } from './useMediaPlayerResourceUpdate';

export function useTrackPreviousButtonActions(): {
  hasEpisodeChaptersForTrackButtons: boolean;
  onClick: () => void;
  longPressProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
} {
  const { mpChannel, mpItem, mpClip, mpItemSoundbite, setMPShouldPlay, mpIsPlaying, mpAddByRSS } =
    useMediaPlayer();
  const { seek } = useMediaPlayerControls();
  const { mpCurrentTime, setMPCurrentTime } = useMediaPlayerCurrentTime();
  const { listContext } = useAddByRSSListContext();
  const mediaPlayerResourceUpdate = useMediaPlayerResourceUpdate();
  const { autoQueueConfig, autoQueueActiveRow, setAutoQueueActiveRow } = useAutoQueue();
  const addByRSSPlayPrevious = useAddByRSSPlayPrevious();
  const { hasEpisodeChaptersForTrackButtons, seekToAdjacentChapter } =
    useEpisodeChapterNavigation();

  const seekToStart = useCallback(() => {
    seek(0);
    setMPCurrentTime(0);
  }, [seek, setMPCurrentTime]);

  const runAddByRSSPreviousTrack = useCallback(async () => {
    if (!mpAddByRSS) {
      return;
    }
    const hasListContext = listContext && listContext.itemIdTexts.length > 0;
    const fallbackContext = !hasListContext
      ? await resolveAddByRSSListContextFromCurrentItem(
          mpAddByRSS.idText,
          mpAddByRSS.resourceData,
          'recent'
        )
      : null;
    const played = await addByRSSPlayPrevious(fallbackContext ?? undefined);
    if (!played) {
      seekToStart();
    }
  }, [mpAddByRSS, listContext, addByRSSPlayPrevious, seekToStart]);

  const runCorePreviousTrack = useCallback(async () => {
    if (!mpChannel || !mpItem) {
      return;
    }

    const seed = {
      item: mpItem,
      channel: mpChannel,
      clip: mpClip,
      item_soundbite: mpItemSoundbite,
    };
    const decision = await resolveAutoQueuePrevious({
      config: { ...autoQueueConfig, disabled: false },
      seed,
      activeRow: autoQueueActiveRow,
      fetchers: createWebAutoQueueSourceFetchers(getApiRequestService()),
    });

    if (decision.kind === 'step-back-row') {
      setMPShouldPlay(mpIsPlaying);
      setAutoQueueActiveRow(decision.row);
      return;
    }

    if (decision.kind === 'restart') {
      seekToStart();
      return;
    }

    mediaPlayerResourceUpdate({
      target: playbackTargetFromStandardLoad({
        channel: decision.resource.channel,
        clip: decision.resource.clip,
        // The queue row's item is DTOItemQueueItem. This load takes DTOItem.
        item: decision.resource.item as DTOItem,
        itemChapter: null,
        itemSoundbite: decision.resource.item_soundbite,
        musicIntent: 'explicit_play',
      }),
      itemChapterShouldSeek: false,
      shouldPlay: mpIsPlaying,
      enclosureSelectedParams: 'use-active-item-or-default',
      isPlaying: mpIsPlaying,
      skipMoveNowPlayingToHistory: false,
      newAutoQueueConfig: {
        playlist_id_text: autoQueueConfig.playlist_id_text,
        disabled: false,
        random: autoQueueConfig.random,
        repeat: autoQueueConfig.repeat,
        nextPage: autoQueueConfig.nextPage || 1,
        shuffleHash: autoQueueConfig.shuffleHash,
      },
      autoQueueShouldClear: true,
    });
  }, [
    mpChannel,
    mpItem,
    mpClip,
    mpItemSoundbite,
    mpIsPlaying,
    autoQueueActiveRow,
    autoQueueConfig,
    setMPShouldPlay,
    setAutoQueueActiveRow,
    mediaPlayerResourceUpdate,
    seekToStart,
  ]);

  const runPreviousTrack = useCallback(async () => {
    if (mpAddByRSS) {
      await runAddByRSSPreviousTrack();
      return;
    }
    await runCorePreviousTrack();
  }, [mpAddByRSS, runAddByRSSPreviousTrack, runCorePreviousTrack]);

  const handleLongPress = useCallback(() => {
    void runPreviousTrack();
  }, [runPreviousTrack]);

  const handleClick = useCallback(async () => {
    if (hasEpisodeChaptersForTrackButtons) {
      seekToAdjacentChapter('previous');
      return;
    }

    if (mpAddByRSS) {
      const isRestartThreshold = 3;
      if (mpCurrentTime > isRestartThreshold) {
        seekToStart();
        return;
      }
      await runAddByRSSPreviousTrack();
      return;
    }

    if (mpChannel && mpItem) {
      const isRestartThreshold = 3;
      if (mpCurrentTime > isRestartThreshold) {
        seekToStart();
        return;
      }
      await runCorePreviousTrack();
    }
  }, [
    hasEpisodeChaptersForTrackButtons,
    seekToAdjacentChapter,
    mpAddByRSS,
    mpCurrentTime,
    seekToStart,
    runAddByRSSPreviousTrack,
    mpChannel,
    mpItem,
    runCorePreviousTrack,
  ]);

  const { onClick, ...longPressProps } = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    delayMs: 500,
  });

  return {
    hasEpisodeChaptersForTrackButtons,
    onClick,
    longPressProps,
  };
}
