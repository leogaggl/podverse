import type { AddByRSSResourceData } from '../dtos/addByRSSResourceData.js';
import type { AccountSessionClientType } from './accountSession.js';
import { isAccountSessionClientType } from './accountSession.js';
import { isMediumEnumValue, MediumEnum } from './medium.js';

export const ACCOUNT_PLAYBACK_STREAM_EVENT = {
  snapshot: 'playback.snapshot',
  state: 'playback.state',
  devices: 'playback.devices',
  command: 'playback.command',
  startFailed: 'playback.start_failed',
} as const;

export type AccountPlaybackStreamEventName =
  (typeof ACCOUNT_PLAYBACK_STREAM_EVENT)[keyof typeof ACCOUNT_PLAYBACK_STREAM_EVENT];

export function isAccountPlaybackStreamEventName(
  value: string
): value is AccountPlaybackStreamEventName {
  return Object.values(ACCOUNT_PLAYBACK_STREAM_EVENT).some((eventName) => eventName === value);
}

/** A playing device publishes at least this often while status is `playing`. */
export const PLAYBACK_STATE_PUBLISH_INTERVAL_MS = 10_000;
/** Discrete changes publish at once, coalesced to at most one per this gap. */
export const PLAYBACK_STATE_MIN_PUBLISH_GAP_MS = 500;
/** A periodic publish within this many seconds of the extrapolated position is not fanned out. */
export const PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS = 2;
/** A device with an open account event stream checks in this often. */
export const PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS = 15_000;
/** Presence lasts this long after the last check-in or state publish. */
export const PLAYBACK_PRESENCE_TTL_MS = 40_000;
/** Product leave grace after a stream closes so a quick reconnect does not flicker the menu. */
export const PLAYBACK_PRESENCE_LEAVE_GRACE_MS = 5_000;
/** A command not delivered and acted on within this window is dropped. */
export const PLAYBACK_COMMAND_TTL_MS = 5_000;
/** Sender waits this long for claim/start-failed before showing transfer failure. */
export const PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS = 8_000;
export const PLAYBACK_RATE_MIN = 0.5;
export const PLAYBACK_RATE_MAX = 3;
export const PLAYBACK_TEXT_FIELD_MAX_LENGTH = 500;
export const PLAYBACK_IMAGE_URL_MAX_LENGTH = 2_048;

export type DTOPlaybackResourceRef =
  | { kind: 'item'; item_id_text: string }
  | { kind: 'clip'; clip_id_text: string }
  | { kind: 'soundbite'; item_soundbite_id_text: string }
  | { kind: 'add_by_rss'; add_by_rss_hash_id: string };

export interface DTOPlaybackResourceSummary {
  ref: DTOPlaybackResourceRef;
  /** The resource channel medium, with the same values as `DTOChannel.medium_id`. */
  medium: MediumEnum;
  title: string | null;
  channel_title: string | null;
  image_url: string | null;
}

/** A known `MediumEnum` value as is; anything else falls back to `MediumEnum.Podcast`. */
export function toPlaybackMedium(value: unknown): MediumEnum {
  return isMediumEnumValue(value) ? value : MediumEnum.Podcast;
}

export const PLAYBACK_STATUSES = ['playing', 'paused', 'loading'] as const;
export type PlaybackStatus = (typeof PLAYBACK_STATUSES)[number];

export interface DTOPlaybackState {
  revision: number;
  /** The device that plays; null when no device is active. */
  active_session_id_text: string | null;
  /** Null after a release with nothing loaded. */
  resource: DTOPlaybackResourceSummary | null;
  status: PlaybackStatus;
  is_live: boolean;
  /** Null when `is_live` is true or no resource is loaded. */
  position_seconds: number | null;
  /** Null when unknown or `is_live` is true. */
  duration_seconds: number | null;
  rate: number;
  /** Server clock when this position was accepted. */
  updated_at_ms: number;
  /** Server clock when this state copy was written to this stream/response. */
  sent_at_ms: number;
}

export interface DTOPlaybackDevice {
  session_id_text: string;
  client_type: AccountSessionClientType;
  /** The session device label; null when unavailable. */
  device_label: string | null;
  /** ISO 8601; clients use this to sort and disambiguate same-label sessions. */
  session_created_at: string;
}

export interface DTOPlaybackDevices {
  revision: number;
  devices: DTOPlaybackDevice[];
}

export interface DTOPlaybackSnapshot {
  devices: DTOPlaybackDevices;
  /** Null when no playback state is available. */
  state: DTOPlaybackState | null;
}

export type DTOPlaybackCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; position_seconds: number }
  | { type: 'set_rate'; rate: number }
  | { type: 'next' }
  | { type: 'previous' }
  | {
      type: 'play_item';
      resource: DTOPlaybackResourceRef;
      /** Required when the resource kind is `add_by_rss`; null for all other kinds. */
      add_by_rss_resource_data: AddByRSSResourceData | null;
      /** Null resumes saved item position or live point for live items. */
      start_seconds: number | null;
    }
  | { type: 'take_over' };

export type PlaybackCommandType = DTOPlaybackCommand['type'];

export interface DTOPlaybackCommandEnvelope {
  command_id: string;
  sender_session_id_text: string;
  target_session_id_text: string;
  issued_at_ms: number;
  expires_at_ms: number;
  command: DTOPlaybackCommand;
  /** Set only for `take_over`; null for all other commands. */
  state: DTOPlaybackState | null;
}

export const PLAYBACK_START_FAILED_REASONS = ['autoplay_blocked', 'load_failed'] as const;
export type PlaybackStartFailedReason = (typeof PLAYBACK_START_FAILED_REASONS)[number];

export interface DTOPlaybackStartFailed {
  command_id: string;
  sender_session_id_text: string;
  target_session_id_text: string;
  reason: PlaybackStartFailedReason;
}

/** POST /account/playback/state */
export interface PlaybackStatePublishBody {
  /** True claims active-device playback for the caller. */
  claim: boolean;
  /** Null with `claim: false` releases active-device ownership. */
  resource: DTOPlaybackResourceSummary | null;
  status: PlaybackStatus;
  is_live: boolean;
  position_seconds: number | null;
  duration_seconds: number | null;
  rate: number;
}

export interface PlaybackStatePublishResponse {
  revision: number;
  active_session_id_text: string | null;
}

/** POST /account/playback/presence response. */
export interface PlaybackPresenceResponse extends DTOPlaybackSnapshot {
  /** The caller session id: "this device". */
  session_id_text: string;
}

/** POST /account/playback/commands */
export interface PlaybackCommandSendBody {
  /** Required only for `take_over`. */
  target_session_id_text?: string;
  command: DTOPlaybackCommand;
}

export interface PlaybackCommandSendResponse {
  command_id: string;
  target_session_id_text: string;
  expires_at_ms: number;
}

/** POST /account/playback/commands/:command_id/start-failed */
export interface PlaybackStartFailedBody {
  reason: PlaybackStartFailedReason;
}

export const PLAYBACK_ERROR_CODES = {
  notActiveDevice: 'playback_not_active_device',
  noActiveDevice: 'playback_no_active_device',
  deviceNotConnected: 'playback_device_not_connected',
  targetAlreadyActive: 'playback_target_already_active',
  nothingToTransfer: 'playback_nothing_to_transfer',
  commandNotAllowedForLive: 'playback_command_not_allowed_for_live',
  takeOverSelf: 'playback_take_over_self',
  unavailable: 'playback_unavailable',
} as const;

export type PlaybackErrorCode = (typeof PLAYBACK_ERROR_CODES)[keyof typeof PLAYBACK_ERROR_CODES];

export function isDTOPlaybackResourceRef(value: unknown): value is DTOPlaybackResourceRef {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  switch (value.kind) {
    case 'item':
      return isPlaybackIdText(value.item_id_text);
    case 'clip':
      return isPlaybackIdText(value.clip_id_text);
    case 'soundbite':
      return isPlaybackIdText(value.item_soundbite_id_text);
    case 'add_by_rss':
      return isPlaybackIdText(value.add_by_rss_hash_id);
    default:
      return false;
  }
}

export function isDTOPlaybackResourceSummary(value: unknown): value is DTOPlaybackResourceSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isDTOPlaybackResourceRef(value.ref) &&
    isMediumEnumValue(value.medium) &&
    isNullablePlaybackText(value.title) &&
    isNullablePlaybackText(value.channel_title) &&
    isNullablePlaybackImageUrl(value.image_url)
  );
}

export function isDTOPlaybackCommand(value: unknown): value is DTOPlaybackCommand {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'play':
    case 'pause':
    case 'take_over':
    case 'next':
    case 'previous':
      return true;
    case 'seek':
      return isNonNegativeFiniteNumber(value.position_seconds);
    case 'set_rate':
      return isPlaybackRate(value.rate);
    case 'play_item': {
      if (
        !isDTOPlaybackResourceRef(value.resource) ||
        !isNullableNonNegativeFiniteNumber(value.start_seconds)
      ) {
        return false;
      }

      if (value.resource.kind === 'add_by_rss') {
        return isRecord(value.add_by_rss_resource_data);
      }

      return value.add_by_rss_resource_data === null;
    }
    default:
      return false;
  }
}

export function isDTOPlaybackState(value: unknown): value is DTOPlaybackState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonNegativeSafeInteger(value.revision) ||
    !isNullablePlaybackIdText(value.active_session_id_text) ||
    !isPlaybackStatus(value.status) ||
    typeof value.is_live !== 'boolean' ||
    !isNullableNonNegativeFiniteNumber(value.position_seconds) ||
    !isNullableNonNegativeFiniteNumber(value.duration_seconds) ||
    !isPlaybackRate(value.rate) ||
    !isNonNegativeSafeInteger(value.updated_at_ms) ||
    !isNonNegativeSafeInteger(value.sent_at_ms)
  ) {
    return false;
  }

  if (value.resource !== null && !isDTOPlaybackResourceSummary(value.resource)) {
    return false;
  }

  if (value.is_live && (value.position_seconds !== null || value.duration_seconds !== null)) {
    return false;
  }
  if (value.is_live && value.rate !== 1) {
    return false;
  }
  if (value.resource === null && (value.status !== 'paused' || value.position_seconds !== null)) {
    return false;
  }

  return true;
}

export function isDTOPlaybackDevice(value: unknown): value is DTOPlaybackDevice {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPlaybackIdText(value.session_id_text) &&
    isAccountSessionClientType(value.client_type) &&
    isNullablePlaybackText(value.device_label) &&
    isIsoDateTimeString(value.session_created_at)
  );
}

export function isDTOPlaybackDevices(value: unknown): value is DTOPlaybackDevices {
  if (
    !isRecord(value) ||
    !isNonNegativeSafeInteger(value.revision) ||
    !Array.isArray(value.devices)
  ) {
    return false;
  }

  return value.devices.every((device) => isDTOPlaybackDevice(device));
}

export function isDTOPlaybackSnapshot(value: unknown): value is DTOPlaybackSnapshot {
  if (!isRecord(value) || !isDTOPlaybackDevices(value.devices)) {
    return false;
  }

  return value.state === null || isDTOPlaybackState(value.state);
}

export function isDTOPlaybackCommandEnvelope(value: unknown): value is DTOPlaybackCommandEnvelope {
  if (!isRecord(value) || !isDTOPlaybackCommand(value.command)) {
    return false;
  }

  if (
    !isPlaybackIdText(value.command_id) ||
    !isPlaybackIdText(value.sender_session_id_text) ||
    !isPlaybackIdText(value.target_session_id_text) ||
    !isNonNegativeSafeInteger(value.issued_at_ms) ||
    !isNonNegativeSafeInteger(value.expires_at_ms) ||
    value.expires_at_ms <= value.issued_at_ms
  ) {
    return false;
  }

  if (value.command.type === 'take_over') {
    return value.state !== null && isDTOPlaybackState(value.state);
  }

  return value.state === null;
}

export function isDTOPlaybackStartFailed(value: unknown): value is DTOPlaybackStartFailed {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPlaybackIdText(value.command_id) &&
    isPlaybackIdText(value.sender_session_id_text) &&
    isPlaybackIdText(value.target_session_id_text) &&
    isPlaybackStartFailedReason(value.reason)
  );
}

export type AccountPlaybackStreamEvent =
  | { type: typeof ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot; data: DTOPlaybackSnapshot }
  | { type: typeof ACCOUNT_PLAYBACK_STREAM_EVENT.state; data: DTOPlaybackState }
  | { type: typeof ACCOUNT_PLAYBACK_STREAM_EVENT.devices; data: DTOPlaybackDevices }
  | { type: typeof ACCOUNT_PLAYBACK_STREAM_EVENT.command; data: DTOPlaybackCommandEnvelope }
  | { type: typeof ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed; data: DTOPlaybackStartFailed };

/** Validates already-parsed data from a stream event. */
export function toAccountPlaybackStreamEvent(
  eventName: string,
  data: unknown
): AccountPlaybackStreamEvent | null {
  switch (eventName) {
    case ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot:
      return isDTOPlaybackSnapshot(data) ? { type: eventName, data } : null;
    case ACCOUNT_PLAYBACK_STREAM_EVENT.state:
      return isDTOPlaybackState(data) ? { type: eventName, data } : null;
    case ACCOUNT_PLAYBACK_STREAM_EVENT.devices:
      return isDTOPlaybackDevices(data) ? { type: eventName, data } : null;
    case ACCOUNT_PLAYBACK_STREAM_EVENT.command:
      return isDTOPlaybackCommandEnvelope(data) ? { type: eventName, data } : null;
    case ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed:
      return isDTOPlaybackStartFailed(data) ? { type: eventName, data } : null;
    default:
      return null;
  }
}

/** Parses and validates one playback stream event payload. */
export function parseAccountPlaybackStreamEvent(
  eventName: string,
  rawData: string
): AccountPlaybackStreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  return toAccountPlaybackStreamEvent(eventName, parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPlaybackStatus(value: unknown): value is PlaybackStatus {
  return PLAYBACK_STATUSES.some((status) => status === value);
}

function isPlaybackStartFailedReason(value: unknown): value is PlaybackStartFailedReason {
  return PLAYBACK_START_FAILED_REASONS.some((reason) => reason === value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullableNonNegativeFiniteNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeFiniteNumber(value);
}

function isPlaybackRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= PLAYBACK_RATE_MIN &&
    value <= PLAYBACK_RATE_MAX
  );
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isNullableBoundedString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength);
}

function isPlaybackIdText(value: unknown): value is string {
  return isBoundedString(value, PLAYBACK_TEXT_FIELD_MAX_LENGTH);
}

function isNullablePlaybackIdText(value: unknown): value is string | null {
  return value === null || isPlaybackIdText(value);
}

function isNullablePlaybackText(value: unknown): value is string | null {
  return isNullableBoundedString(value, PLAYBACK_TEXT_FIELD_MAX_LENGTH);
}

function isNullablePlaybackImageUrl(value: unknown): value is string | null {
  return isNullableBoundedString(value, PLAYBACK_IMAGE_URL_MAX_LENGTH);
}

function isIsoDateTimeString(value: unknown): value is string {
  return isBoundedString(value, PLAYBACK_TEXT_FIELD_MAX_LENGTH);
}
