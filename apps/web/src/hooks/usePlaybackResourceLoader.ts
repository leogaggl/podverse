'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { AddByRSSResourceData, DTOPlaybackResourceRef } from '@podverse/helpers';
import { PLAYBACK_COMMAND_TTL_MS } from '@podverse/helpers';

import type { AutoQueueConfig } from '../contexts/AutoQueue';
import { useAutoQueue } from '../contexts/AutoQueue';
import { useMediaPlayer } from '../contexts/MediaPlayer';
import { useMediaPlayerControls } from '../contexts/MediaPlayerControls';
import { useMediaPlayerCurrentTime } from '../contexts/MediaPlayerCurrentTime';
import {
  applyCommandSeekToLoadedFile,
  clearCommandStartSeek,
  stageCommandStartSeek,
} from '../lib/crossDevicePlayback/commandStartSeek';
import { fetchPlaybackResourceDtos } from '../lib/crossDevicePlayback/fetchPlaybackResourceDtos';
import type { PlayerResourceInput } from '../lib/crossDevicePlayback/playbackResource';
import {
  buildPlaybackResourceRefFromPlayer,
  isSamePlaybackResourceRef,
} from '../lib/crossDevicePlayback/playbackResource';
import type { PlaybackTarget } from '../lib/playback';
import { playbackTargetFromStandardLoad, playbackTargetLivestream } from '../lib/playback';
import { resolveAddByRSSIndexItemFromResourceData } from '../utils/addByRSS/playFromQueueResource';
import { checkIsLiveItem } from '../utils/mediaPlayer/mediaPlayerItemEnclosureType';
import type { MediaElementBridge } from './useMediaElementBridge';
import type { MediaPlayerPlaybackLoadInput } from './useMediaPlayerResourceUpdate';
import { useMediaPlayerResourceUpdate } from './useMediaPlayerResourceUpdate';
import { usePlayAddByRSS } from './usePlayAddByRSS';

export type LoadPlaybackResourceParams = {
  resource: DTOPlaybackResourceRef;
  addByRSSResourceData: AddByRSSResourceData | null;
  startSeconds: number | null;
  /**
   * When set, the load is skipped if this receipt is older than the command TTL after the
   * resource is resolved. A skipped load does not stage a seek.
   */
  receivedAtMs?: number;
};

type PlaybackResourceLoadRuntime = {
  player: () => PlayerResourceInput;
  controls: () => Pick<MediaElementBridge, 'seek' | 'readDurationSeconds'>;
  setMPIsPlaying: (isPlaying: boolean) => void;
  setMPCurrentTime: (seconds: number) => void;
  mediaPlayerResourceUpdate: () => (input: MediaPlayerPlaybackLoadInput) => void;
  playAddByRSS: () => ReturnType<typeof usePlayAddByRSS>;
  autoQueueConfig: () => AutoQueueConfig;
};

let boundLoad: ((params: LoadPlaybackResourceParams) => Promise<boolean>) | null = null;
let boundSetCurrentTime: (seconds: number) => void = () => {};

export function setBoundPlaybackCurrentTime(seconds: number): void {
  boundSetCurrentTime(seconds);
}

function isReceiptFresh(receivedAtMs: number | undefined, nowMs: number): boolean {
  if (receivedAtMs === undefined) {
    return true;
  }
  return nowMs - receivedAtMs <= PLAYBACK_COMMAND_TTL_MS;
}

function playerResourceInput(player: PlayerResourceInput): PlayerResourceInput {
  return {
    mpAddByRSS: player.mpAddByRSS,
    mpChannel: player.mpChannel,
    mpItem: player.mpItem,
    mpClip: player.mpClip,
    mpItemSoundbite: player.mpItemSoundbite,
    mpItemChapter: player.mpItemChapter,
    mpItemChapters: player.mpItemChapters,
  };
}

function autoQueueConfigForCommandLoad(config: AutoQueueConfig): AutoQueueConfig {
  return {
    playlist_id_text: config.playlist_id_text,
    disabled: false,
    random: config.random,
    repeat: config.repeat,
    nextPage: config.nextPage || 1,
    shuffleHash: config.shuffleHash,
  };
}

function failUnresolved(): false {
  clearCommandStartSeek();
  return false;
}

function commitStandardLoad(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime,
  target: PlaybackTarget
): boolean {
  if (!isReceiptFresh(params.receivedAtMs, Date.now())) {
    return false;
  }
  if (params.startSeconds !== null && target.kind !== 'livestream') {
    stageCommandStartSeek({
      ref: params.resource,
      seconds: params.startSeconds,
      nowMs: Date.now(),
    });
  }
  runtime.mediaPlayerResourceUpdate()({
    target,
    explicitPlaybackSeconds: params.startSeconds ?? undefined,
    itemChapterShouldSeek: false,
    enclosureSelectedParams: 'use-active-item-or-default',
    skipMoveNowPlayingToHistory: false,
    newAutoQueueConfig: autoQueueConfigForCommandLoad(runtime.autoQueueConfig()),
    autoQueueShouldClear: true,
    isPlaying: true,
    shouldPlay: true,
  });
  return true;
}

async function loadDirectoryItem(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime
): Promise<boolean> {
  if (params.resource.kind !== 'item') {
    return failUnresolved();
  }
  const dtos = await fetchPlaybackResourceDtos(params.resource);
  if (dtos === null) {
    return failUnresolved();
  }
  const target = checkIsLiveItem(dtos.item)
    ? playbackTargetLivestream(dtos.channel, dtos.item)
    : playbackTargetFromStandardLoad({
        channel: dtos.channel,
        clip: null,
        item: dtos.item,
        itemChapter: null,
        itemSoundbite: null,
        musicIntent: 'explicit_play',
      });
  return commitStandardLoad(params, runtime, target);
}

async function loadClip(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime
): Promise<boolean> {
  if (params.resource.kind !== 'clip') {
    return failUnresolved();
  }
  const dtos = await fetchPlaybackResourceDtos(params.resource);
  if (dtos === null || dtos.clip === null) {
    return failUnresolved();
  }
  return commitStandardLoad(
    params,
    runtime,
    playbackTargetFromStandardLoad({
      channel: dtos.channel,
      clip: dtos.clip,
      item: dtos.item,
      itemChapter: null,
      itemSoundbite: null,
      musicIntent: 'explicit_play',
    })
  );
}

async function loadSoundbite(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime
): Promise<boolean> {
  if (params.resource.kind !== 'soundbite') {
    return failUnresolved();
  }
  const dtos = await fetchPlaybackResourceDtos(params.resource);
  if (dtos === null || dtos.itemSoundbite === null) {
    return failUnresolved();
  }
  return commitStandardLoad(
    params,
    runtime,
    playbackTargetFromStandardLoad({
      channel: dtos.channel,
      clip: null,
      item: dtos.item,
      itemChapter: null,
      itemSoundbite: dtos.itemSoundbite,
      musicIntent: 'explicit_play',
    })
  );
}

async function loadAddByRSS(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime
): Promise<boolean> {
  if (params.addByRSSResourceData === null) {
    return false;
  }
  const resolved = await resolveAddByRSSIndexItemFromResourceData(params.addByRSSResourceData);
  if (resolved === null) {
    return false;
  }
  if (!isReceiptFresh(params.receivedAtMs, Date.now())) {
    return false;
  }
  const isLivestream = 'startTimeMs' in resolved.indexItem;
  if (params.startSeconds !== null && !isLivestream) {
    stageCommandStartSeek({
      ref: params.resource,
      seconds: params.startSeconds,
      nowMs: Date.now(),
    });
  }
  await runtime.playAddByRSS()(resolved.indexItem, params.startSeconds ?? undefined, undefined, {
    shouldPlay: true,
  });
  return true;
}

async function runPlaybackResourceLoad(
  params: LoadPlaybackResourceParams,
  runtime: PlaybackResourceLoadRuntime
): Promise<boolean> {
  if (!isReceiptFresh(params.receivedAtMs, Date.now())) {
    return false;
  }

  const loadedRef = buildPlaybackResourceRefFromPlayer(runtime.player());
  if (isSamePlaybackResourceRef(params.resource, loadedRef)) {
    if (params.startSeconds !== null) {
      applyCommandSeekToLoadedFile({
        seconds: params.startSeconds,
        ref: params.resource,
        controls: runtime.controls(),
        setMPCurrentTime: runtime.setMPCurrentTime,
        nowMs: Date.now(),
      });
    }
    runtime.setMPIsPlaying(true);
    return true;
  }

  switch (params.resource.kind) {
    case 'item':
      return loadDirectoryItem(params, runtime);
    case 'clip':
      return loadClip(params, runtime);
    case 'soundbite':
      return loadSoundbite(params, runtime);
    case 'add_by_rss':
      return loadAddByRSS(params, runtime);
    default: {
      const _unhandled: never = params.resource;
      void _unhandled;
      return failUnresolved();
    }
  }
}

/** Loads and starts `resource` in this tab's player. Resolves false when it could not be resolved. */
export function usePlaybackResourceLoader(): (
  params: LoadPlaybackResourceParams
) => Promise<boolean> {
  return useCallback((params: LoadPlaybackResourceParams) => {
    if (boundLoad === null) {
      return Promise.resolve(false);
    }
    return boundLoad(params);
  }, []);
}

/**
 * The resource loader's player hooks include the current-time context, which updates on every
 * tick. Binding them here keeps that subscription on the track-commands view.
 */
export function useBindPlaybackResourceLoader(): void {
  const mediaPlayer = useMediaPlayer();
  const controls = useMediaPlayerControls();
  const { setMPCurrentTime } = useMediaPlayerCurrentTime();
  const mediaPlayerResourceUpdate = useMediaPlayerResourceUpdate();
  const playAddByRSS = usePlayAddByRSS();
  const { autoQueueConfig } = useAutoQueue();

  const playerRef = useRef<PlayerResourceInput>(playerResourceInput(mediaPlayer));
  playerRef.current = playerResourceInput(mediaPlayer);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const setMPIsPlayingRef = useRef(mediaPlayer.setMPIsPlaying);
  setMPIsPlayingRef.current = mediaPlayer.setMPIsPlaying;
  const setMPCurrentTimeRef = useRef(setMPCurrentTime);
  setMPCurrentTimeRef.current = setMPCurrentTime;
  const mediaPlayerResourceUpdateRef = useRef(mediaPlayerResourceUpdate);
  mediaPlayerResourceUpdateRef.current = mediaPlayerResourceUpdate;
  const playAddByRSSRef = useRef(playAddByRSS);
  playAddByRSSRef.current = playAddByRSS;
  const autoQueueConfigRef = useRef(autoQueueConfig);
  autoQueueConfigRef.current = autoQueueConfig;

  const load = useCallback(async (params: LoadPlaybackResourceParams): Promise<boolean> => {
    try {
      return await runPlaybackResourceLoad(params, {
        player: () => playerRef.current,
        controls: () => controlsRef.current,
        setMPIsPlaying: (isPlaying) => {
          setMPIsPlayingRef.current(isPlaying);
        },
        setMPCurrentTime: (seconds) => {
          setMPCurrentTimeRef.current(seconds);
        },
        mediaPlayerResourceUpdate: () => mediaPlayerResourceUpdateRef.current,
        playAddByRSS: () => playAddByRSSRef.current,
        autoQueueConfig: () => autoQueueConfigRef.current,
      });
    } catch {
      clearCommandStartSeek();
      return false;
    }
  }, []);

  boundLoad = load;
  boundSetCurrentTime = setMPCurrentTime;

  useEffect(() => {
    boundLoad = load;
    return () => {
      if (boundLoad === load) {
        boundLoad = null;
      }
    };
  }, [load]);
}
