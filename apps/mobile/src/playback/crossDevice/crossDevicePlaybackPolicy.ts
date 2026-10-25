/**
 * Pure cross-device playback rules for the phone: what this device publishes, when a publish
 * claims, when another device's claim stops local audio, command dedupe and staleness, where a
 * take-over resumes, whether the different-item handoff prompt may open, and what the phone loads
 * when another device stops being active.
 */
import type {
  DTOPlaybackResourceRef,
  DTOPlaybackResourceSummary,
  DTOPlaybackState,
  PlaybackStatePublishBody,
  PlaybackStatus,
} from '@podverse/helpers/accountPlaybackStream';
import {
  PLAYBACK_COMMAND_TTL_MS,
  PLAYBACK_IMAGE_URL_MAX_LENGTH,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_TEXT_FIELD_MAX_LENGTH,
  toPlaybackMedium,
} from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackRole } from '@podverse/helpers/crossDevicePlayback';
import {
  estimatePlaybackPositionSeconds,
  isPlaybackCommandAllowed,
} from '@podverse/helpers/crossDevicePlayback';
import type { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
} from '../../lib/addByRss/resourceData';
import type { PlaybackTransportState } from '../playbackTransport';
import type {
  CrossDevicePlaybackAvailability,
  CrossDevicePlaybackView,
} from './crossDevicePlaybackStore';

/** What the publisher reads from the local player at publish time. */
export type LocalPlaybackPublishSnapshot = {
  target: PlaybackTarget | null;
  title: string | null;
  channelTitle: string | null;
  imageUrl: string | null;
  isPlaying: boolean;
  transportState: PlaybackTransportState;
  positionSeconds: number;
  durationSeconds: number;
  /** Effective engine rate. */
  rate: number;
};

/**
 * The shared ref for a target. A chapter is its item at a position. Live items get a ref too: the
 * shared state carries them with `is_live`. A livestream with no item has nothing to share.
 */
export function playbackResourceRefFromTarget(
  target: PlaybackTarget
): DTOPlaybackResourceRef | null {
  switch (target.kind) {
    case 'clip':
      return { kind: 'clip', clip_id_text: target.clip.id_text };
    case 'soundbite':
      return { kind: 'soundbite', item_soundbite_id_text: target.soundbite.id_text };
    case 'chapter':
    case 'item-music':
    case 'item-podcast':
    case 'item-video':
      return { kind: 'item', item_id_text: target.item.id_text };
    case 'livestream':
      return target.item === null ? null : { kind: 'item', item_id_text: target.item.id_text };
    case 'add-by-rss':
      return {
        kind: 'add_by_rss',
        add_by_rss_hash_id: addByRssPlaybackMediaId(target.resourceData),
      };
  }
}

/**
 * The channel medium of what this device plays, for `DTOPlaybackResourceSummary.medium`. A missing
 * or unknown id publishes `MediumEnum.Podcast`.
 */
export function playbackMediumFromTarget(target: PlaybackTarget): MediumEnum {
  if (target.kind === 'add-by-rss') {
    return toPlaybackMedium(target.resourceData.medium_id);
  }
  return toPlaybackMedium(target.channel.medium_id);
}

export function isLivePlaybackTarget(target: PlaybackTarget): boolean {
  if (target.kind === 'livestream') {
    return true;
  }
  return target.kind === 'add-by-rss' && isAddByRssLivestreamResourceData(target.resourceData);
}

export function isSamePlaybackResourceRef(
  a: DTOPlaybackResourceRef,
  b: DTOPlaybackResourceRef
): boolean {
  switch (a.kind) {
    case 'item':
      return b.kind === 'item' && a.item_id_text === b.item_id_text;
    case 'clip':
      return b.kind === 'clip' && a.clip_id_text === b.clip_id_text;
    case 'soundbite':
      return b.kind === 'soundbite' && a.item_soundbite_id_text === b.item_soundbite_id_text;
    case 'add_by_rss':
      return b.kind === 'add_by_rss' && a.add_by_rss_hash_id === b.add_by_rss_hash_id;
  }
}

/** Trimmed and cut to the server's limit, so a long title never fails a publish. */
const boundedPlaybackText = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, PLAYBACK_TEXT_FIELD_MAX_LENGTH);
};

/** A cut URL would point nowhere, so an image URL past the server's limit is dropped. */
const boundedPlaybackImageUrl = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0 || trimmed.length > PLAYBACK_IMAGE_URL_MAX_LENGTH) {
    return null;
  }
  return trimmed;
};

const clampPlaybackRate = (rate: number): number => {
  if (!Number.isFinite(rate)) {
    return 1;
  }
  return Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, rate));
};

const publishStatusFromSnapshot = (snapshot: LocalPlaybackPublishSnapshot): PlaybackStatus => {
  if (snapshot.transportState === 'loading') {
    return 'loading';
  }
  if (snapshot.transportState === 'error') {
    return 'paused';
  }
  return snapshot.isPlaying ? 'playing' : 'paused';
};

/**
 * The body for `POST /account/playback/state`. With no target, or a target with nothing to share,
 * the body has no resource; with `claim: true` it still makes this device active, so exclusivity
 * holds for a livestream started with no item, and other devices show nothing.
 */
export function buildPlaybackStatePublishBody(
  snapshot: LocalPlaybackPublishSnapshot,
  claim: boolean
): PlaybackStatePublishBody {
  const { target } = snapshot;
  const ref = target === null ? null : playbackResourceRefFromTarget(target);
  if (target === null || ref === null) {
    return {
      claim,
      resource: null,
      status: 'paused',
      is_live: false,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
    };
  }

  const resource: DTOPlaybackResourceSummary = {
    ref,
    medium: playbackMediumFromTarget(target),
    title: boundedPlaybackText(snapshot.title),
    channel_title: boundedPlaybackText(snapshot.channelTitle),
    image_url: boundedPlaybackImageUrl(snapshot.imageUrl),
  };
  const status = publishStatusFromSnapshot(snapshot);

  if (isLivePlaybackTarget(target)) {
    return {
      claim,
      resource,
      status,
      is_live: true,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
    };
  }

  return {
    claim,
    resource,
    status,
    is_live: false,
    position_seconds: Number.isFinite(snapshot.positionSeconds)
      ? Math.max(0, snapshot.positionSeconds)
      : 0,
    duration_seconds:
      Number.isFinite(snapshot.durationSeconds) && snapshot.durationSeconds > 0
        ? snapshot.durationSeconds
        : null,
    rate: clampPlaybackRate(snapshot.rate),
  };
}

/**
 * Whether a publish claims. True when local audio just started (false → true, from any source:
 * the app, lock screen, headset, car, or a command), or when audio plays and this device is not
 * the active one. False while this device is active and was already playing, so an auto-advance
 * after another device took over gets a 409 and stops instead of taking playback back.
 */
export function resolvePlaybackPublishClaim(params: {
  role: PlaybackRole;
  wasPlayingLocally: boolean;
  isPlayingLocally: boolean;
}): boolean {
  if (!params.isPlayingLocally) {
    return false;
  }
  if (!params.wasPlayingLocally) {
    return true;
  }
  return params.role !== 'active';
}

/** Whether this device publishes a non-claim change: only while it is the active device. */
export function shouldPublishPlaybackChange(params: {
  role: PlaybackRole;
  claim: boolean;
}): boolean {
  return params.claim || params.role === 'active';
}

export type PlaybackSupersedeAction = 'stop' | 'defer' | 'none';

/**
 * An applied `playback.state` (or a 409 body) that names another device while this one plays
 * stops local audio. A claim still in flight defers the decision until its response is recorded.
 * Pass the store's effective `activeSessionIdText` after applying the event, so an older state
 * that lost to this device's recorded claim does not stop it. A null active id means the active
 * device left, and nobody stops.
 */
export function resolvePlaybackSupersedeAction(params: {
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  isPlayingLocally: boolean;
  claimInFlight: boolean;
}): PlaybackSupersedeAction {
  if (
    params.thisSessionIdText === null ||
    params.activeSessionIdText === null ||
    params.activeSessionIdText === params.thisSessionIdText ||
    !params.isPlayingLocally
  ) {
    return 'none';
  }
  if (params.claimInFlight) {
    return 'defer';
  }
  return 'stop';
}

export type SeenPlaybackCommandIds = {
  has: (commandIdText: string) => boolean;
  add: (commandIdText: string) => void;
};

/** Remembers the most recent `limit` command ids, evicting the oldest first. */
export function createSeenPlaybackCommandIds(limit: number): SeenPlaybackCommandIds {
  const ids = new Set<string>();
  return {
    has(commandIdText: string): boolean {
      return ids.has(commandIdText);
    },
    add(commandIdText: string): void {
      if (ids.has(commandIdText)) {
        return;
      }
      ids.add(commandIdText);
      while (ids.size > limit) {
        const oldest = ids.values().next();
        if (oldest.done === true) {
          break;
        }
        ids.delete(oldest.value);
      }
    },
  };
}

/**
 * Measured on this device's clock only. Never compare with `expires_at_ms`: that is the server's
 * clock, and the two can disagree by more than the whole window.
 */
export function isPlaybackCommandStale(params: { receivedAtMs: number; nowMs: number }): boolean {
  return params.nowMs - params.receivedAtMs > PLAYBACK_COMMAND_TTL_MS;
}

export type PlaybackTakeOverStart = {
  ref: DTOPlaybackResourceRef;
  /** Null for a live item: start at the live point. */
  startSeconds: number | null;
  isLive: boolean;
};

/**
 * Where a take-over resumes: where the active device is now, not where it last published, or the
 * live point. Null when nothing is shared.
 */
export function resolvePlaybackTakeOverStart(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
}): PlaybackTakeOverStart | null {
  const { state } = params;
  if (state.resource === null) {
    return null;
  }
  return {
    ref: state.resource.ref,
    startSeconds: estimatePlaybackPositionSeconds({
      state,
      receivedAtMs: params.receivedAtMs,
      nowMs: params.nowMs,
    }),
    isLive: state.is_live,
  };
}

/**
 * Remote skip forward or back as an absolute seek from the estimate, clamped to the item. Null
 * when seeking is not allowed (live) or the position is unknown.
 */
export function resolveRemoteJumpSeekSeconds(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
  deltaSeconds: number;
}): number | null {
  const { state } = params;
  if (!isPlaybackCommandAllowed('seek', { isLive: state.is_live })) {
    return null;
  }
  const estimate = estimatePlaybackPositionSeconds({
    state,
    receivedAtMs: params.receivedAtMs,
    nowMs: params.nowMs,
  });
  if (estimate === null) {
    return null;
  }
  const seekSeconds = Math.max(0, estimate + params.deltaSeconds);
  if (state.duration_seconds === null) {
    return seekSeconds;
  }
  return Math.min(seekSeconds, state.duration_seconds);
}

export type PlaybackHandoffGate = 'defer' | 'suppress' | 'allow';

/**
 * Whether the different-item handoff prompt may open. It waits while the view is pending. While
 * any device is active the live control owns the conversation, so the prompt stays closed. When
 * nobody is active, or this device cannot see the others (no membership, Offline Mode, stream
 * down), the prompt works as it does without cross-device playback.
 */
export function resolvePlaybackHandoffGate(params: {
  availability: CrossDevicePlaybackAvailability;
  role: PlaybackRole;
}): PlaybackHandoffGate {
  if (params.availability === 'pending') {
    return 'defer';
  }
  if (params.availability === 'ready' && params.role !== 'idle') {
    return 'suppress';
  }
  return 'allow';
}

export type PlaybackIdleAdoption =
  | { type: 'none' }
  | { type: 'seek'; positionSeconds: number }
  | { type: 'load_paused'; ref: DTOPlaybackResourceRef; positionSeconds: number | null };

/**
 * What the phone does with the shared state when another device stops being active. Only the
 * `remote` to `idle` step while `ready` adopts, so a cold open in the `idle` role never swaps the
 * loaded item. A different item loads paused at the shared position; the loaded item moves to it.
 * Nothing happens while audio plays here, during an authoring hold, for a live item, or for a
 * release. The server pauses the state when its device leaves, so the stored position is where
 * that device stopped.
 */
export function resolvePlaybackIdleAdoption(params: {
  previousRole: PlaybackRole;
  previousAvailability: CrossDevicePlaybackAvailability;
  view: Pick<CrossDevicePlaybackView, 'availability' | 'role' | 'state'>;
  loadedRef: DTOPlaybackResourceRef | null;
  isPlayingLocally: boolean;
  isAuthoringHold: boolean;
}): PlaybackIdleAdoption {
  const { view } = params;
  if (
    params.previousRole !== 'remote' ||
    params.previousAvailability !== 'ready' ||
    view.availability !== 'ready' ||
    view.role !== 'idle' ||
    params.isPlayingLocally ||
    params.isAuthoringHold
  ) {
    return { type: 'none' };
  }
  const { state } = view;
  if (state === null || state.resource === null || state.is_live) {
    return { type: 'none' };
  }
  const { ref } = state.resource;
  if (params.loadedRef !== null && isSamePlaybackResourceRef(params.loadedRef, ref)) {
    return state.position_seconds === null
      ? { type: 'none' }
      : { type: 'seek', positionSeconds: state.position_seconds };
  }
  return { type: 'load_paused', ref, positionSeconds: state.position_seconds };
}
