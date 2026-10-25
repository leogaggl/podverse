import type { PlaybackRole } from '@podverse/helpers';
import { resolvePlaybackRole } from '@podverse/helpers';

/**
 * `off`: cross-device playback does not apply (logged out, embed). `pending`: waiting for the first
 * check-in. `ready`: this tab knows its session id. `unavailable`: no membership, or the stream
 * could not be reached.
 */
export type CrossDevicePlaybackAvailability = 'off' | 'pending' | 'ready' | 'unavailable';

/**
 * A device is one login session, so every tab of a browser profile shares it. Within the active
 * session only the tab holding audio is `active`; its other tabs are `remote` and send commands to
 * their own session. A claim in flight is `active` at once, so an older state naming another device
 * never stops playback the person just started.
 */
export function resolveTabPlaybackRole(params: {
  availability: CrossDevicePlaybackAvailability;
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  thisTabHoldsAudio: boolean;
  claimPending: boolean;
}): PlaybackRole {
  if (params.availability !== 'ready') {
    return 'idle';
  }
  if (params.claimPending) {
    return 'active';
  }
  const sessionRole = resolvePlaybackRole({
    thisSessionIdText: params.thisSessionIdText,
    activeSessionIdText: params.activeSessionIdText,
  });
  if (sessionRole === 'active') {
    return params.thisTabHoldsAudio ? 'active' : 'remote';
  }
  return sessionRole;
}
