import type {
  DTOPlaybackResourceRef,
  DTOPlaybackState,
  PlaybackSpeedValue,
} from '@podverse/helpers';
import { estimatePlaybackPositionSeconds } from '@podverse/helpers';

import { nearestPlaybackSpeedValue } from './playbackResource';

export type TakeOverStart = {
  resource: DTOPlaybackResourceRef;
  /** Null: saved position, or the live point. */
  startSeconds: number | null;
  /** Null when live. */
  rate: PlaybackSpeedValue | null;
};

/**
 * Where a take-over starts: the playing device's estimated position (clamped only to its own
 * `duration_seconds`), at its speed. The clamp to this tab's file end happens when the file
 * reports its duration, so no local duration is read here. A livestream starts at its live point.
 */
export function resolveTakeOverStart(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
}): TakeOverStart | null {
  const { state, receivedAtMs, nowMs } = params;
  if (state.resource === null) {
    return null;
  }
  if (state.is_live) {
    return { resource: state.resource.ref, startSeconds: null, rate: null };
  }
  return {
    resource: state.resource.ref,
    startSeconds: estimatePlaybackPositionSeconds({ state, receivedAtMs, nowMs }),
    rate: nearestPlaybackSpeedValue(state.rate),
  };
}
