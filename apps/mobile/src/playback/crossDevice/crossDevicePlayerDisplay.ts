/**
 * Chooses whether the phone draws its own player or another device's playback.
 * A local result is one frozen object. This module does not render or send commands.
 */
import type {
  DTOPlaybackResourceRef,
  DTOPlaybackResourceSummary,
  PlaybackStatus,
} from '@podverse/helpers/accountPlaybackStream';
import type {
  PlaybackDeviceListEntry,
  PlaybackRemoteControls,
} from '@podverse/helpers/crossDevicePlayback';
import {
  buildPlaybackDeviceList,
  getPlaybackRemoteControls,
  shouldShowPlaybackDeviceSwitch,
} from '@podverse/helpers/crossDevicePlayback';

import type { PlaybackTransportState } from '../playbackTransport';
import type {
  CrossDevicePlaybackTransferFailureReason,
  CrossDevicePlaybackView,
} from './crossDevicePlaybackStore';

export type CrossDevicePlayerDisplay =
  | { kind: 'local' }
  | {
      kind: 'remote';
      resource: DTOPlaybackResourceSummary;
      status: PlaybackStatus;
      transportState: PlaybackTransportState;
      isLive: boolean;
      durationSeconds: number | null;
      rate: number;
      /** The active device's list entry; null when it is not in the device list. */
      activeDevice: PlaybackDeviceListEntry | null;
      controls: PlaybackRemoteControls;
    };

/** One object for every local display, so callers can compare it by identity. */
export const LOCAL_PLAYER_DISPLAY: CrossDevicePlayerDisplay = { kind: 'local' };
Object.freeze(LOCAL_PLAYER_DISPLAY);

const showsRemotePlayback = (
  view: CrossDevicePlaybackView
): view is CrossDevicePlaybackView & {
  state: CrossDevicePlaybackView['state'] & {
    resource: DTOPlaybackResourceSummary;
  };
} => {
  return (
    view.availability === 'ready' &&
    view.role === 'remote' &&
    view.state !== null &&
    view.state.resource !== null
  );
};

export function resolveCrossDevicePlayerDisplay(params: {
  view: CrossDevicePlaybackView;
  isAuthoringHold: boolean;
}): CrossDevicePlayerDisplay {
  const { view, isAuthoringHold } = params;
  if (isAuthoringHold) {
    return LOCAL_PLAYER_DISPLAY;
  }
  if (!showsRemotePlayback(view)) {
    return LOCAL_PLAYER_DISPLAY;
  }

  const { state } = view;
  const isLive = state.is_live;
  return {
    kind: 'remote',
    resource: state.resource,
    status: state.status,
    transportState: remotePlaybackTransportState(state.status),
    isLive,
    durationSeconds: state.duration_seconds,
    rate: state.rate,
    activeDevice: selectPlaybackDeviceEntries(view).find((entry) => entry.isActive) ?? null,
    controls: getPlaybackRemoteControls({ isLive }),
  };
}

/** Row media id of a shared resource, comparable with `playbackTargetRowMediaId`. */
export function playbackResourceRefRowMediaId(ref: DTOPlaybackResourceRef): string {
  switch (ref.kind) {
    case 'item':
      return ref.item_id_text;
    case 'clip':
      return ref.clip_id_text;
    case 'soundbite':
      return ref.item_soundbite_id_text;
    case 'add_by_rss':
      return ref.add_by_rss_hash_id;
  }
}

/** Remote row state with no authoring-hold input; rows never read the session context. */
export function selectRemoteRowMediaId(view: CrossDevicePlaybackView): string | null {
  if (!showsRemotePlayback(view)) {
    return null;
  }
  return playbackResourceRefRowMediaId(view.state.resource.ref);
}

export function selectRemoteRowIsPlaying(view: CrossDevicePlaybackView): boolean {
  if (selectRemoteRowMediaId(view) === null || view.state === null) {
    return false;
  }
  return view.state.status !== 'paused';
}

export function selectPlaybackDeviceSwitchVisible(view: CrossDevicePlaybackView): boolean {
  if (view.availability !== 'ready' || view.devices === null) {
    return false;
  }
  return shouldShowPlaybackDeviceSwitch(view.devices.devices);
}

export function selectPlaybackDeviceEntries(
  view: CrossDevicePlaybackView
): PlaybackDeviceListEntry[] {
  return buildPlaybackDeviceList({
    devices: view.devices?.devices ?? [],
    thisSessionIdText: view.thisSessionIdText,
    activeSessionIdText: view.activeSessionIdText,
  });
}

/** Shared state that a take-over could move: a non-null state with a resource. */
export function selectCanTransferPlayback(view: CrossDevicePlaybackView): boolean {
  return view.state !== null && view.state.resource !== null;
}

export function remotePlaybackTransportState(status: PlaybackStatus): PlaybackTransportState {
  switch (status) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'loading':
      return 'loading';
  }
}

export type PlayerStatusLine =
  | { kind: 'sending'; device: PlaybackDeviceListEntry | null }
  | { kind: 'remote'; status: PlaybackStatus; device: PlaybackDeviceListEntry | null };

const deviceEntryForSession = (
  view: CrossDevicePlaybackView,
  sessionIdText: string
): PlaybackDeviceListEntry | null => {
  return (
    selectPlaybackDeviceEntries(view).find(
      (entry) => entry.device.session_id_text === sessionIdText
    ) ?? null
  );
};

export function resolvePlayerStatusLine(params: {
  view: CrossDevicePlaybackView;
  display: CrossDevicePlayerDisplay;
}): PlayerStatusLine | null {
  const { view, display } = params;
  if (view.availability !== 'ready') {
    return null;
  }

  const { transfer } = view;
  if (transfer !== null && transfer.targetSessionIdText !== view.thisSessionIdText) {
    return {
      kind: 'sending',
      device: deviceEntryForSession(view, transfer.targetSessionIdText),
    };
  }

  if (display.kind === 'remote' && view.state !== null) {
    return {
      kind: 'remote',
      status: view.state.status,
      device: display.activeDevice,
    };
  }

  return null;
}

export function playerStatusLineKey(
  line: PlayerStatusLine
):
  | 'media_player.cross_device.sending_to_device'
  | 'media_player.cross_device.playing_on_device'
  | 'media_player.cross_device.paused_on_device'
  | 'media_player.cross_device.starting_on_device' {
  if (line.kind === 'sending') {
    return 'media_player.cross_device.sending_to_device';
  }
  switch (line.status) {
    case 'playing':
      return 'media_player.cross_device.playing_on_device';
    case 'paused':
      return 'media_player.cross_device.paused_on_device';
    case 'loading':
      return 'media_player.cross_device.starting_on_device';
  }
}

export type PlaybackDeviceLabelKey =
  | 'settings.account.sessions.client_type_web'
  | 'settings.account.sessions.client_type_mobile'
  | 'media_player.devices.same_label_number'
  | 'media_player.devices.another_device';

export type PlaybackDeviceLabelTranslate = (
  key: PlaybackDeviceLabelKey,
  values?: Record<string, string | number>
) => string;

const clientTypeLabelKey = (
  clientType: PlaybackDeviceListEntry['device']['client_type']
): PlaybackDeviceLabelKey => {
  switch (clientType) {
    case 'web':
      return 'settings.account.sessions.client_type_web';
    case 'mobile':
      return 'settings.account.sessions.client_type_mobile';
  }
};

export function formatPlaybackDeviceLabel(
  entry: PlaybackDeviceListEntry | null,
  translate: PlaybackDeviceLabelTranslate
): string {
  if (entry === null) {
    return translate('media_player.devices.another_device');
  }

  const trimmedLabel = entry.device.device_label?.trim() ?? '';
  const base =
    trimmedLabel.length > 0
      ? trimmedLabel
      : translate(clientTypeLabelKey(entry.device.client_type));

  if (entry.sameLabelNumber === null) {
    return base;
  }
  return translate('media_player.devices.same_label_number', {
    device: base,
    number: entry.sameLabelNumber,
  });
}

export function transferFailureMessageKey(
  reason: CrossDevicePlaybackTransferFailureReason
):
  | 'media_player.devices.transfer_failed_load_failed'
  | 'media_player.devices.transfer_failed_autoplay_blocked'
  | 'media_player.devices.transfer_failed_timeout'
  | 'media_player.devices.transfer_failed_not_connected'
  | 'media_player.devices.transfer_failed_send_failed' {
  switch (reason) {
    case 'load_failed':
      return 'media_player.devices.transfer_failed_load_failed';
    case 'autoplay_blocked':
      return 'media_player.devices.transfer_failed_autoplay_blocked';
    case 'timeout':
      return 'media_player.devices.transfer_failed_timeout';
    case 'not_connected':
      return 'media_player.devices.transfer_failed_not_connected';
    case 'send_failed':
      return 'media_player.devices.transfer_failed_send_failed';
  }
}
