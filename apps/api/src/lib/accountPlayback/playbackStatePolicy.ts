import type {
  DTOPlaybackResourceRef,
  DTOPlaybackResourceSummary,
  DTOPlaybackState,
  PlaybackStatePublishBody,
} from '@podverse/helpers';
import {
  estimatePlaybackPositionAtServerTime,
  PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS,
} from '@podverse/helpers';

import type { PlaybackStateRead, StoredPlaybackState } from './playbackStore.js';

/** Media durations refine while loading, so durations this close count as the same. */
const PLAYBACK_DURATION_TOLERANCE_SECONDS = 0.5;

export type PlaybackStateDecision =
  | { kind: 'not_active'; activeSessionIdText: string | null }
  | { kind: 'unchanged' }
  | { kind: 'write'; state: StoredPlaybackState; newActiveSessionIdText: string | null };

type PlaybackStateFields = Pick<
  StoredPlaybackState,
  'resource' | 'status' | 'is_live' | 'position_seconds' | 'duration_seconds' | 'rate'
>;

/** Revisions never go backwards, even after the stored revision expired. */
const nextPlaybackStateRevision = (previousRevision: number, nowMs: number): number =>
  Math.max(previousRevision + 1, nowMs);

/** A release has no resource; a live item has no position or duration and plays at rate 1. */
const toPlaybackStateFields = (body: PlaybackStatePublishBody): PlaybackStateFields => {
  if (body.resource === null) {
    return {
      resource: null,
      status: 'paused',
      is_live: false,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
    };
  }
  if (body.is_live) {
    return {
      resource: body.resource,
      status: body.status,
      is_live: true,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
    };
  }
  return {
    resource: body.resource,
    status: body.status,
    is_live: false,
    position_seconds: body.position_seconds,
    duration_seconds: body.duration_seconds,
    rate: body.rate,
  };
};

const isSamePlaybackResourceRef = (
  left: DTOPlaybackResourceRef,
  right: DTOPlaybackResourceRef
): boolean => {
  switch (left.kind) {
    case 'item':
      return right.kind === 'item' && left.item_id_text === right.item_id_text;
    case 'clip':
      return right.kind === 'clip' && left.clip_id_text === right.clip_id_text;
    case 'soundbite':
      return (
        right.kind === 'soundbite' && left.item_soundbite_id_text === right.item_soundbite_id_text
      );
    case 'add_by_rss':
      return right.kind === 'add_by_rss' && left.add_by_rss_hash_id === right.add_by_rss_hash_id;
  }
};

const isSamePlaybackResource = (
  left: DTOPlaybackResourceSummary,
  right: DTOPlaybackResourceSummary
): boolean =>
  isSamePlaybackResourceRef(left.ref, right.ref) &&
  left.medium === right.medium &&
  left.title === right.title &&
  left.channel_title === right.channel_title &&
  left.image_url === right.image_url;

const isSamePlaybackDuration = (left: number | null, right: number | null): boolean => {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) <= PLAYBACK_DURATION_TOLERANCE_SECONDS;
};

/**
 * True when a publish would show nothing new: same resource and display fields, same status,
 * liveness, rate, and duration, and a position within the drift tolerance of the stored state
 * extrapolated to now. Comparing with the stored (last fanned-out) state, not the last received
 * publish, keeps small drifts from adding up unseen.
 */
const isSamePlaybackState = (
  current: StoredPlaybackState,
  next: PlaybackStateFields,
  nowMs: number
): boolean => {
  if (current.resource === null || next.resource === null) {
    return false;
  }
  if (
    !isSamePlaybackResource(current.resource, next.resource) ||
    current.status !== next.status ||
    current.is_live !== next.is_live ||
    current.rate !== next.rate ||
    !isSamePlaybackDuration(current.duration_seconds, next.duration_seconds)
  ) {
    return false;
  }

  const estimatedPositionSeconds = estimatePlaybackPositionAtServerTime(current, nowMs);
  if (estimatedPositionSeconds === null || next.position_seconds === null) {
    return estimatedPositionSeconds === null && next.position_seconds === null;
  }
  return (
    Math.abs(next.position_seconds - estimatedPositionSeconds) <
    PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS
  );
};

/**
 * In order: a claim always writes with the caller active; a device that is not active is
 * refused; a release clears the resource and the active device; a publish that shows nothing new
 * is unchanged (not stored, not fanned out); anything else writes with the caller still active.
 */
export function decidePlaybackStatePublish(params: {
  current: PlaybackStateRead;
  callerSessionIdText: string;
  body: PlaybackStatePublishBody;
  nowMs: number;
}): PlaybackStateDecision {
  const { current, callerSessionIdText, body, nowMs } = params;
  const fields = toPlaybackStateFields(body);
  const write = (newActiveSessionIdText: string | null): PlaybackStateDecision => ({
    kind: 'write',
    state: {
      revision: nextPlaybackStateRevision(current.revision, nowMs),
      active_session_id_text: newActiveSessionIdText,
      ...fields,
      updated_at_ms: nowMs,
    },
    newActiveSessionIdText,
  });

  if (body.claim) {
    return write(callerSessionIdText);
  }
  if (current.activeSessionIdText !== callerSessionIdText) {
    return { kind: 'not_active', activeSessionIdText: current.activeSessionIdText };
  }
  if (body.resource === null) {
    return write(null);
  }
  if (current.state !== null && isSamePlaybackState(current.state, fields, nowMs)) {
    return { kind: 'unchanged' };
  }
  return write(callerSessionIdText);
}

/**
 * The state after the active device left presence: paused at its last published position with
 * no active device. The position is not extrapolated; resuming a few seconds early is better than
 * skipping ahead.
 */
export function buildPlaybackStateAfterActiveLeft(params: {
  current: StoredPlaybackState;
  nowMs: number;
}): StoredPlaybackState {
  return {
    ...params.current,
    revision: nextPlaybackStateRevision(params.current.revision, params.nowMs),
    active_session_id_text: null,
    status: 'paused',
    updated_at_ms: params.nowMs,
  };
}

export function toPlaybackStateDto(state: StoredPlaybackState, sentAtMs: number): DTOPlaybackState {
  return { ...state, sent_at_ms: sentAtMs };
}
