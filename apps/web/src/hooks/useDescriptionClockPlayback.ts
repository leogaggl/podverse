'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { getShuffleHash } from '@podverse/helpers-requests';
import type { AddByRSSItemIndexItem, AddByRSSLivestreamIndexItem } from '@podverse/parser-mapping';

import { useAutoQueue } from '../contexts/AutoQueue';
import { useMediaPlayer } from '../contexts/MediaPlayer';
import { useMediaPlayerControls } from '../contexts/MediaPlayerControls';
import { useMediaPlayerCurrentTime } from '../contexts/MediaPlayerCurrentTime';
import { playbackTargetFromStandardLoad, playbackTargetLivestream } from '../lib/playback';
import { useMediaPlayerResourceUpdate } from './useMediaPlayerResourceUpdate';
import { usePlayAddByRSS } from './usePlayAddByRSS';

export type DescriptionClockPlayback =
  | {
      kind: 'item';
      item: DTOItem;
      channel: DTOChannel;
      livestream?: boolean;
    }
  | {
      kind: 'add-by-rss';
      indexItem: AddByRSSItemIndexItem | AddByRSSLivestreamIndexItem;
    };

/**
 * Seek when this item is already loaded without a clip or soundbite boundary. Otherwise load it
 * and start playback at the clock. A paused player resumes so the jump is heard.
 */
export function useDescriptionClockPlayback(source: DescriptionClockPlayback | null): {
  descriptionClockLabel: (clockText: string) => string;
  onDescriptionClock: ((seconds: number) => void) | undefined;
} {
  const tInfo = useTranslations('info');
  const { autoQueueConfig } = useAutoQueue();
  const { mpAddByRSS, mpClip, mpIsPlaying, mpItem, mpItemSoundbite, setMPIsPlaying } =
    useMediaPlayer();
  const { isAttached, pauseAt, seek } = useMediaPlayerControls();
  const { setMPCurrentTime } = useMediaPlayerCurrentTime();
  const mediaPlayerResourceUpdate = useMediaPlayerResourceUpdate();
  const playAddByRSS = usePlayAddByRSS();

  const descriptionClockLabel = useCallback(
    (clockText: string) => tInfo('summary.play_from', { time: clockText }),
    [tInfo]
  );

  const onDescriptionClock = useCallback(
    (seconds: number) => {
      if (source === null) {
        return;
      }

      const start = Math.max(0, seconds);

      if (source.kind === 'add-by-rss') {
        const sameResource =
          isAttached &&
          source.indexItem.idText.length > 0 &&
          mpAddByRSS?.idText === source.indexItem.idText;
        if (sameResource) {
          pauseAt(-1);
          seek(start);
          setMPCurrentTime(start);
          if (!mpIsPlaying) {
            setMPIsPlaying(true);
          }
          return;
        }

        playAddByRSS(source.indexItem, start);
        return;
      }

      const sameItem =
        isAttached && mpItem?.id === source.item.id && mpClip === null && mpItemSoundbite === null;
      if (sameItem) {
        pauseAt(-1);
        seek(start);
        setMPCurrentTime(start);
        if (!mpIsPlaying) {
          setMPIsPlaying(true);
        }
        return;
      }

      mediaPlayerResourceUpdate({
        autoQueueShouldClear: true,
        enclosureSelectedParams: 'use-active-item-or-default',
        explicitPlaybackSeconds: start,
        isPlaying: true,
        itemChapterShouldSeek: false,
        newAutoQueueConfig: {
          disabled: source.livestream === true,
          nextPage: 1,
          playlist_id_text: null,
          random: autoQueueConfig.random,
          repeat: autoQueueConfig.repeat,
          shuffleHash: getShuffleHash(),
        },
        shouldPlay: true,
        skipMoveNowPlayingToHistory: false,
        target:
          source.livestream === true
            ? playbackTargetLivestream(source.channel, source.item)
            : playbackTargetFromStandardLoad({
                channel: source.channel,
                clip: null,
                item: source.item,
                itemChapter: null,
                itemSoundbite: null,
                musicIntent: 'explicit_play',
              }),
      });
    },
    [
      autoQueueConfig.random,
      autoQueueConfig.repeat,
      isAttached,
      mediaPlayerResourceUpdate,
      mpAddByRSS?.idText,
      mpClip,
      mpIsPlaying,
      mpItem?.id,
      mpItemSoundbite,
      pauseAt,
      playAddByRSS,
      seek,
      setMPCurrentTime,
      setMPIsPlaying,
      source,
    ]
  );

  return {
    descriptionClockLabel,
    onDescriptionClock: source === null ? undefined : onDescriptionClock,
  };
}
