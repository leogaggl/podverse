import { describe, expect, it } from 'vitest';

import type { DTOPlaybackState, PlaybackDeviceListEntry, PlaybackStatus } from '@podverse/helpers';
import { MediumEnum, PLAYBACK_STATUSES } from '@podverse/helpers';

import { resolvePlayerDeviceCaption, resolveRemotePlayerDisplay } from './remotePlayerDisplay';
import type { CrossDevicePlaybackAvailability } from './tabPlaybackRole';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';

function makeState(overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState {
  return {
    revision: 1,
    active_session_id_text: OTHER_SESSION,
    resource: {
      ref: { kind: 'item', item_id_text: 'item-1' },
      medium: MediumEnum.Podcast,
      title: 'Episode',
      channel_title: 'Show',
      image_url: null,
    },
    status: 'playing',
    is_live: false,
    position_seconds: 10,
    duration_seconds: 100,
    rate: 1,
    updated_at_ms: 1,
    sent_at_ms: 1,
    ...overrides,
  };
}

function makeEntry(sessionIdText: string): PlaybackDeviceListEntry {
  return {
    device: {
      session_id_text: sessionIdText,
      client_type: 'web',
      device_label: 'Phone',
      session_created_at: '2026-01-01T00:00:00.000Z',
    },
    isThisDevice: false,
    isActive: true,
    sameLabelNumber: null,
  };
}

function captionParams(
  overrides: Partial<Parameters<typeof resolvePlayerDeviceCaption>[0]> = {}
): Parameters<typeof resolvePlayerDeviceCaption>[0] {
  return {
    availability: 'ready',
    role: 'remote',
    thisSessionIdText: THIS_SESSION,
    activeSessionIdText: OTHER_SESSION,
    status: 'playing',
    pendingTransferTargetSessionIdText: null,
    entries: [],
    ...overrides,
  };
}

describe('resolveRemotePlayerDisplay', () => {
  it('is null unless the role is remote and the state names a resource', () => {
    const state = makeState();
    expect(resolveRemotePlayerDisplay({ role: 'idle', displayState: state })).toBeNull();
    expect(resolveRemotePlayerDisplay({ role: 'active', displayState: state })).toBeNull();
    expect(resolveRemotePlayerDisplay({ role: 'remote', displayState: null })).toBeNull();
    expect(
      resolveRemotePlayerDisplay({
        role: 'remote',
        displayState: makeState({ resource: null }),
      })
    ).toBeNull();
  });

  it('uses live remote controls, including next and previous, for a live state', () => {
    const display = resolveRemotePlayerDisplay({
      role: 'remote',
      displayState: makeState({
        is_live: true,
        position_seconds: null,
        duration_seconds: null,
      }),
    });
    expect(display).not.toBeNull();
    if (display === null) {
      return;
    }
    expect(display.controls.canSkip).toBe(false);
    expect(display.controls.showsProgress).toBe(false);
    expect(display.controls.canTrackNext).toBe(true);
    expect(display.controls.canTrackPrevious).toBe(true);
  });
});

describe('resolvePlayerDeviceCaption', () => {
  const notReady: CrossDevicePlaybackAvailability[] = ['off', 'pending', 'unavailable'];

  it('returns null until availability is ready', () => {
    for (const availability of notReady) {
      expect(
        resolvePlayerDeviceCaption(
          captionParams({
            availability,
            pendingTransferTargetSessionIdText: OTHER_SESSION,
          })
        )
      ).toBeNull();
    }
  });

  it('lets a pending transfer win over the remote status', () => {
    const entry = makeEntry(OTHER_SESSION);
    expect(
      resolvePlayerDeviceCaption(
        captionParams({
          pendingTransferTargetSessionIdText: OTHER_SESSION,
          entries: [entry],
          status: 'playing',
        })
      )
    ).toEqual({ kind: 'sending', entry });
  });

  it('ignores a transfer whose target is this session', () => {
    expect(
      resolvePlayerDeviceCaption(
        captionParams({
          pendingTransferTargetSessionIdText: THIS_SESSION,
          activeSessionIdText: THIS_SESSION,
          status: 'paused',
        })
      )
    ).toEqual({ kind: 'other_tab' });
    expect(
      resolvePlayerDeviceCaption(
        captionParams({
          role: 'active',
          pendingTransferTargetSessionIdText: THIS_SESSION,
          activeSessionIdText: THIS_SESSION,
          status: 'playing',
        })
      )
    ).toBeNull();
  });

  it('names another tab of this session for every status', () => {
    for (const status of PLAYBACK_STATUSES) {
      expect(
        resolvePlayerDeviceCaption(
          captionParams({
            activeSessionIdText: THIS_SESSION,
            status,
          })
        )
      ).toEqual({ kind: 'other_tab' });
    }
  });

  it('names the other device and passes its status through', () => {
    const entry = makeEntry(OTHER_SESSION);
    for (const status of PLAYBACK_STATUSES) {
      expect(
        resolvePlayerDeviceCaption(
          captionParams({
            status,
            entries: [entry],
          })
        )
      ).toEqual({ kind: 'other_device', entry, status });
    }
  });

  it('names an unknown active session with a null entry', () => {
    const status: PlaybackStatus = 'playing';
    expect(
      resolvePlayerDeviceCaption(
        captionParams({
          activeSessionIdText: 'session-missing',
          entries: [makeEntry(OTHER_SESSION)],
          status,
        })
      )
    ).toEqual({ kind: 'other_device', entry: null, status });
  });

  it('returns null in the active role when no transfer is pending', () => {
    expect(
      resolvePlayerDeviceCaption(
        captionParams({
          role: 'active',
          activeSessionIdText: THIS_SESSION,
          pendingTransferTargetSessionIdText: null,
        })
      )
    ).toBeNull();
  });
});
