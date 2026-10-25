import type {
  DTOPlaybackDevice,
  DTOPlaybackState,
  PlaybackCommandType,
} from './accountPlaybackStream.js';

export type PlaybackPositionBase = Pick<
  DTOPlaybackState,
  'status' | 'is_live' | 'position_seconds' | 'duration_seconds' | 'rate' | 'updated_at_ms'
>;

/**
 * Position after `elapsedMs`. Playback advances only while status is `playing`. A live item or a
 * null position has no estimate. Reaching `duration_seconds` clamps the value and fires nothing.
 */
function estimatePlaybackPositionFromElapsedMs(
  state: PlaybackPositionBase,
  elapsedMs: number
): number | null {
  if (state.is_live || state.position_seconds === null) {
    return null;
  }

  const elapsedMsClamped = Math.max(0, elapsedMs);
  const advancedSeconds = state.status === 'playing' ? state.rate * (elapsedMsClamped / 1000) : 0;
  const positionSeconds = Math.max(0, state.position_seconds + advancedSeconds);
  if (typeof state.duration_seconds !== 'number') {
    return positionSeconds;
  }
  return Math.min(positionSeconds, state.duration_seconds);
}

/**
 * Position at `atServerMs` on the server clock. The API compares a periodic publish with the
 * stored state and freezes the position when the active device leaves.
 */
export function estimatePlaybackPositionAtServerTime(
  state: PlaybackPositionBase,
  atServerMs: number
): number | null {
  return estimatePlaybackPositionFromElapsedMs(state, atServerMs - state.updated_at_ms);
}

/**
 * Position free of clock skew. Elapsed time is the age of the state when it was sent
 * (`sent_at_ms - updated_at_ms`, both server clock) plus the time since this client received it
 * (`nowMs - receivedAtMs`, both client clock). Display only: reaching `duration_seconds` clamps
 * the value and fires nothing. Only the playing device's own media reports an end.
 */
export function estimatePlaybackPositionSeconds(params: {
  state: PlaybackPositionBase & Pick<DTOPlaybackState, 'sent_at_ms'>;
  receivedAtMs: number;
  nowMs: number;
}): number | null {
  const serverAgeMs = Math.max(0, params.state.sent_at_ms - params.state.updated_at_ms);
  const sinceReceivedMs = Math.max(0, params.nowMs - params.receivedAtMs);
  return estimatePlaybackPositionFromElapsedMs(params.state, serverAgeMs + sinceReceivedMs);
}

export const PLAYBACK_COMMANDS_ALLOWED_FOR_LIVE: readonly PlaybackCommandType[] = [
  'play',
  'pause',
  'next',
  'previous',
  'play_item',
  'take_over',
];

export function isPlaybackCommandAllowed(
  commandType: PlaybackCommandType,
  params: { isLive: boolean }
): boolean {
  if (!params.isLive) {
    return true;
  }
  return PLAYBACK_COMMANDS_ALLOWED_FOR_LIVE.includes(commandType);
}

export interface PlaybackRemoteControls {
  canPlayPause: boolean;
  canSeek: boolean;
  canSkip: boolean;
  canSetRate: boolean;
  showsProgress: boolean;
  canTransfer: boolean;
  /** Next button: sends `next`. */
  canTrackNext: boolean;
  /** Previous button: sends `previous`. */
  canTrackPrevious: boolean;
}

export function getPlaybackRemoteControls(params: { isLive: boolean }): PlaybackRemoteControls {
  const canSeek = isPlaybackCommandAllowed('seek', params);
  return {
    canPlayPause:
      isPlaybackCommandAllowed('play', params) && isPlaybackCommandAllowed('pause', params),
    canSeek,
    canSkip: canSeek,
    canSetRate: isPlaybackCommandAllowed('set_rate', params),
    showsProgress: canSeek,
    canTransfer: isPlaybackCommandAllowed('take_over', params),
    canTrackNext: isPlaybackCommandAllowed('next', params),
    canTrackPrevious: isPlaybackCommandAllowed('previous', params),
  };
}

/** 'active': this device plays. 'remote': another device plays. 'idle': no device is active. */
export type PlaybackRole = 'active' | 'remote' | 'idle';

export function resolvePlaybackRole(params: {
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
}): PlaybackRole {
  if (params.activeSessionIdText === null) {
    return 'idle';
  }
  if (
    params.thisSessionIdText !== null &&
    params.thisSessionIdText === params.activeSessionIdText
  ) {
    return 'active';
  }
  return 'remote';
}

/** True when `incoming` should replace `current` (no current, or a higher revision). */
export function isNewerPlaybackRevision(
  current: { revision: number } | null,
  incoming: { revision: number }
): boolean {
  if (current === null) {
    return true;
  }
  return incoming.revision > current.revision;
}

/** Keeps an empty label from grouping with a session whose label is the client type name. */
const UNLABELED_DEVICE_GROUP_PREFIX = '\u0000';

export interface PlaybackDeviceListEntry {
  device: DTOPlaybackDevice;
  isThisDevice: boolean;
  isActive: boolean;
  /** 1-based number among devices sharing this label; null when the label is unique. */
  sameLabelNumber: number | null;
}

function dedupePlaybackDevices(devices: readonly DTOPlaybackDevice[]): DTOPlaybackDevice[] {
  const seenSessionIds = new Set<string>();
  const unique: DTOPlaybackDevice[] = [];
  for (const device of devices) {
    if (seenSessionIds.has(device.session_id_text)) {
      continue;
    }
    seenSessionIds.add(device.session_id_text);
    unique.push(device);
  }
  return unique;
}

function playbackDeviceGroupKey(device: DTOPlaybackDevice): string {
  const trimmedLabel = device.device_label?.trim() ?? '';
  if (trimmedLabel.length > 0) {
    return trimmedLabel;
  }
  return `${UNLABELED_DEVICE_GROUP_PREFIX}${device.client_type}`;
}

function compareSessionIdText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function comparePlaybackDevicesBySession(
  left: DTOPlaybackDevice,
  right: DTOPlaybackDevice
): number {
  const leftCreatedAtMs = Date.parse(left.session_created_at);
  const rightCreatedAtMs = Date.parse(right.session_created_at);
  const leftCreatedAtIsValid = !Number.isNaN(leftCreatedAtMs);
  const rightCreatedAtIsValid = !Number.isNaN(rightCreatedAtMs);

  if (leftCreatedAtIsValid && rightCreatedAtIsValid && leftCreatedAtMs !== rightCreatedAtMs) {
    return leftCreatedAtMs < rightCreatedAtMs ? -1 : 1;
  }
  if (leftCreatedAtIsValid !== rightCreatedAtIsValid) {
    return leftCreatedAtIsValid ? -1 : 1;
  }
  return compareSessionIdText(left.session_id_text, right.session_id_text);
}

function sameLabelNumberBySessionId(
  devices: readonly DTOPlaybackDevice[]
): ReadonlyMap<string, number | null> {
  const groups = new Map<string, DTOPlaybackDevice[]>();
  for (const device of devices) {
    const groupKey = playbackDeviceGroupKey(device);
    const group = groups.get(groupKey);
    if (group === undefined) {
      groups.set(groupKey, [device]);
      continue;
    }
    group.push(device);
  }

  const numbers = new Map<string, number | null>();
  for (const group of groups.values()) {
    if (group.length < 2) {
      const onlyDevice = group[0];
      if (onlyDevice !== undefined) {
        numbers.set(onlyDevice.session_id_text, null);
      }
      continue;
    }

    const ordered = [...group].sort(comparePlaybackDevicesBySession);
    for (const [index, device] of ordered.entries()) {
      numbers.set(device.session_id_text, index + 1);
    }
  }
  return numbers;
}

export function buildPlaybackDeviceList(params: {
  devices: readonly DTOPlaybackDevice[];
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
}): PlaybackDeviceListEntry[] {
  const uniqueDevices = dedupePlaybackDevices(params.devices);
  const labelNumbers = sameLabelNumberBySessionId(uniqueDevices);
  const thisDevice =
    params.thisSessionIdText === null
      ? undefined
      : uniqueDevices.find((device) => device.session_id_text === params.thisSessionIdText);
  const otherDevices = uniqueDevices
    .filter((device) => device !== thisDevice)
    .sort(comparePlaybackDevicesBySession);

  const orderedDevices = thisDevice === undefined ? otherDevices : [thisDevice, ...otherDevices];
  return orderedDevices.map((device) => ({
    device,
    isThisDevice: device === thisDevice,
    isActive:
      params.activeSessionIdText !== null && device.session_id_text === params.activeSessionIdText,
    sameLabelNumber: labelNumbers.get(device.session_id_text) ?? null,
  }));
}

export function shouldShowPlaybackDeviceSwitch(devices: readonly DTOPlaybackDevice[]): boolean {
  return dedupePlaybackDevices(devices).length >= 2;
}
