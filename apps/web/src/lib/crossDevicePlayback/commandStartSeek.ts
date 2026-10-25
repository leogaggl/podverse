import type { DTOPlaybackResourceRef } from '@podverse/helpers';

import type { MediaElementBridge } from '../../hooks/useMediaElementBridge';
import { clampCommandStartToFileEnd } from '../playback';
import { isSamePlaybackResourceRef } from './playbackResource';

export const COMMAND_START_SEEK_MAX_AGE_MS = 30_000;

type StagedCommandStartSeek = {
  ref: DTOPlaybackResourceRef;
  seconds: number;
  stagedAtMs: number;
};

let staged: StagedCommandStartSeek | null = null;

/** Stages a commanded position for the next metadata load of `ref`; replaces any earlier stage. */
export function stageCommandStartSeek(params: {
  ref: DTOPlaybackResourceRef;
  seconds: number;
  nowMs: number;
}): void {
  staged = {
    ref: params.ref,
    seconds: params.seconds,
    stagedAtMs: params.nowMs,
  };
}

/**
 * For the file whose metadata just loaded: the staged position clamped to that file's end
 * (`clampCommandStartToFileEnd`), or null when nothing is staged for `ref` or the stage is older
 * than `COMMAND_START_SEEK_MAX_AGE_MS`. A returned value clears the stage; a different `ref`
 * leaves it staged (an older file can finish loading after a newer stage).
 */
export function takeCommandStartSeek(params: {
  ref: DTOPlaybackResourceRef | null;
  fileDurationSeconds: number;
  nowMs: number;
}): number | null {
  if (staged === null) {
    return null;
  }
  if (params.nowMs - staged.stagedAtMs > COMMAND_START_SEEK_MAX_AGE_MS) {
    staged = null;
    return null;
  }
  if (!isSamePlaybackResourceRef(staged.ref, params.ref)) {
    return null;
  }
  const seconds = clampCommandStartToFileEnd({
    seconds: staged.seconds,
    fileDurationSeconds: params.fileDurationSeconds,
  });
  staged = null;
  return seconds;
}

export function clearCommandStartSeek(): void {
  staged = null;
}

/** A commanded position on the file already loaded in this tab. */
export function applyCommandSeekToLoadedFile(params: {
  seconds: number;
  ref: DTOPlaybackResourceRef | null;
  controls: Pick<MediaElementBridge, 'seek' | 'readDurationSeconds'>;
  setMPCurrentTime: (seconds: number) => void;
  nowMs: number;
}): void {
  if (params.ref === null) {
    return;
  }
  const duration = params.controls.readDurationSeconds();
  if (duration === undefined) {
    stageCommandStartSeek({
      ref: params.ref,
      seconds: params.seconds,
      nowMs: params.nowMs,
    });
    params.setMPCurrentTime(
      clampCommandStartToFileEnd({
        seconds: params.seconds,
        fileDurationSeconds: undefined,
      })
    );
    return;
  }
  const clampedSeconds = clampCommandStartToFileEnd({
    seconds: params.seconds,
    fileDurationSeconds: duration,
  });
  params.controls.seek(clampedSeconds);
  params.setMPCurrentTime(clampedSeconds);
}
