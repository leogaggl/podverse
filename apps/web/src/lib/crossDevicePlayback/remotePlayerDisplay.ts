import type {
  DTOPlaybackResourceSummary,
  DTOPlaybackState,
  PlaybackDeviceListEntry,
  PlaybackRemoteControls,
  PlaybackStatus,
} from '@podverse/helpers';
import { getPlaybackRemoteControls } from '@podverse/helpers';

import type { CrossDevicePlaybackSnapshot } from './crossDevicePlaybackStore';

export type RemotePlayerDisplay = {
  state: DTOPlaybackState;
  resource: DTOPlaybackResourceSummary;
  controls: PlaybackRemoteControls;
};

/** The remote view's data, or null when this tab shows its local player. */
export function resolveRemotePlayerDisplay(params: {
  role: CrossDevicePlaybackSnapshot['role'];
  displayState: DTOPlaybackState | null;
}): RemotePlayerDisplay | null {
  const { role, displayState } = params;
  if (role !== 'remote' || displayState === null || displayState.resource === null) {
    return null;
  }
  return {
    state: displayState,
    resource: displayState.resource,
    controls: getPlaybackRemoteControls({ isLive: displayState.is_live }),
  };
}

export type PlayerDeviceCaption =
  | { kind: 'sending'; entry: PlaybackDeviceListEntry | null }
  | { kind: 'other_tab' }
  | { kind: 'other_device'; entry: PlaybackDeviceListEntry | null; status: PlaybackStatus };

export function resolvePlayerDeviceCaption(params: {
  availability: CrossDevicePlaybackSnapshot['availability'];
  role: CrossDevicePlaybackSnapshot['role'];
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  status: PlaybackStatus | null;
  pendingTransferTargetSessionIdText: string | null;
  entries: readonly PlaybackDeviceListEntry[];
}): PlayerDeviceCaption | null {
  if (params.availability !== 'ready') {
    return null;
  }

  if (
    params.pendingTransferTargetSessionIdText !== null &&
    params.pendingTransferTargetSessionIdText !== params.thisSessionIdText
  ) {
    return {
      kind: 'sending',
      entry: entryForSession(params.entries, params.pendingTransferTargetSessionIdText),
    };
  }

  if (
    params.role === 'remote' &&
    params.activeSessionIdText !== null &&
    params.thisSessionIdText !== null &&
    params.activeSessionIdText === params.thisSessionIdText
  ) {
    return { kind: 'other_tab' };
  }

  if (params.role === 'remote' && params.status !== null) {
    return {
      kind: 'other_device',
      entry: entryForSession(params.entries, params.activeSessionIdText),
      status: params.status,
    };
  }

  return null;
}

function entryForSession(
  entries: readonly PlaybackDeviceListEntry[],
  sessionIdText: string | null
): PlaybackDeviceListEntry | null {
  if (sessionIdText === null) {
    return null;
  }
  for (const entry of entries) {
    if (entry.device.session_id_text === sessionIdText) {
      return entry;
    }
  }
  return null;
}
