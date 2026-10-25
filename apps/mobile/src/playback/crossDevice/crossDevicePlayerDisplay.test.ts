import { describe, expect, it } from 'vitest';

import type { DTOPlaybackDevice, DTOPlaybackState } from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackDeviceListEntry } from '@podverse/helpers/crossDevicePlayback';
import { MediumEnum } from '@podverse/helpers/medium';

import type { CrossDevicePlaybackView } from './crossDevicePlaybackStore';
import type {
  PlaybackDeviceLabelKey,
  PlaybackDeviceLabelTranslate,
} from './crossDevicePlayerDisplay';
import {
  formatPlaybackDeviceLabel,
  LOCAL_PLAYER_DISPLAY,
  playbackResourceRefRowMediaId,
  playerStatusLineKey,
  resolveCrossDevicePlayerDisplay,
  resolvePlayerStatusLine,
  selectCanTransferPlayback,
  selectPlaybackDeviceEntries,
  selectPlaybackDeviceSwitchVisible,
  selectRemoteRowIsPlaying,
  selectRemoteRowMediaId,
  transferFailureMessageKey,
} from './crossDevicePlayerDisplay';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';
const MISSING_SESSION = 'session-missing';

const makeDevice = (
  sessionIdText: string,
  overrides: Partial<DTOPlaybackDevice> = {}
): DTOPlaybackDevice => ({
  session_id_text: sessionIdText,
  client_type: 'mobile',
  device_label: null,
  session_created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState => ({
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
  position_seconds: 12,
  duration_seconds: 100,
  rate: 1.5,
  updated_at_ms: 1,
  sent_at_ms: 1,
  ...overrides,
});

const makeView = (overrides: Partial<CrossDevicePlaybackView> = {}): CrossDevicePlaybackView => ({
  availability: 'ready',
  thisSessionIdText: THIS_SESSION,
  devices: {
    revision: 1,
    devices: [
      makeDevice(THIS_SESSION, {
        device_label: 'iPhone · iOS',
        session_created_at: '2026-01-02T00:00:00.000Z',
      }),
      makeDevice(OTHER_SESSION, {
        device_label: 'Pixel · Android',
        session_created_at: '2026-01-01T00:00:00.000Z',
      }),
    ],
  },
  state: makeState(),
  stateReceivedAtMs: 1,
  localClaim: null,
  activeSessionIdText: OTHER_SESSION,
  role: 'remote',
  transfer: null,
  transferFailure: null,
  commandFailure: null,
  ...overrides,
});

const deviceEntry = (
  view: CrossDevicePlaybackView,
  sessionIdText: string
): PlaybackDeviceListEntry | null => {
  return (
    selectPlaybackDeviceEntries(view).find(
      (entry) => entry.device.session_id_text === sessionIdText
    ) ?? null
  );
};

const labelEntry = (
  deviceLabel: string | null,
  sameLabelNumber: number | null,
  clientType: DTOPlaybackDevice['client_type'] = 'mobile'
): PlaybackDeviceListEntry => ({
  device: makeDevice(OTHER_SESSION, { client_type: clientType, device_label: deviceLabel }),
  isThisDevice: false,
  isActive: false,
  sameLabelNumber,
});

describe('crossDevicePlayerDisplay', () => {
  it('draws another device only when that playback is ready, remote, and has an item', () => {
    const remote = resolveCrossDevicePlayerDisplay({
      view: makeView(),
      isAuthoringHold: false,
    });
    expect(remote.kind).toBe('remote');
    expect(remote).not.toBe(LOCAL_PLAYER_DISPLAY);
    if (remote.kind !== 'remote') {
      return;
    }
    expect(remote.status).toBe('playing');
    expect(remote.transportState).toBe('playing');
    expect(remote.isLive).toBe(false);
    expect(remote.durationSeconds).toBe(100);
    expect(remote.rate).toBe(1.5);
    expect(remote.activeDevice?.device.session_id_text).toBe(OTHER_SESSION);
    expect(remote.controls.canSeek).toBe(true);

    const localViews = [
      makeView({ availability: 'off' }),
      makeView({ availability: 'pending' }),
      makeView({ availability: 'unavailable' }),
      makeView({ role: 'active' }),
      makeView({ role: 'idle' }),
      makeView({ state: makeState({ resource: null }) }),
    ];
    for (const view of localViews) {
      expect(resolveCrossDevicePlayerDisplay({ view, isAuthoringHold: false })).toBe(
        LOCAL_PLAYER_DISPLAY
      );
    }
    expect(resolveCrossDevicePlayerDisplay({ view: makeView(), isAuthoringHold: true })).toBe(
      LOCAL_PLAYER_DISPLAY
    );
  });

  it('keeps seek and speed off for a live remote item, and maps paused and loading', () => {
    const live = resolveCrossDevicePlayerDisplay({
      view: makeView({
        state: makeState({
          is_live: true,
          position_seconds: null,
          duration_seconds: null,
        }),
      }),
      isAuthoringHold: false,
    });
    expect(live.kind).toBe('remote');
    if (live.kind !== 'remote') {
      return;
    }
    expect(live.isLive).toBe(true);
    expect(live.controls.canSeek).toBe(false);
    expect(live.controls.canSetRate).toBe(false);

    const paused = resolveCrossDevicePlayerDisplay({
      view: makeView({ state: makeState({ status: 'paused' }) }),
      isAuthoringHold: false,
    });
    const loading = resolveCrossDevicePlayerDisplay({
      view: makeView({ state: makeState({ status: 'loading' }) }),
      isAuthoringHold: false,
    });
    expect(paused.kind === 'remote' && paused.transportState).toBe('paused');
    expect(loading.kind === 'remote' && loading.transportState).toBe('loading');
  });

  it('names a transfer to another session, then the playing device', () => {
    const pending = makeView({
      availability: 'pending',
      transfer: {
        commandIdText: 'command-1',
        targetSessionIdText: OTHER_SESSION,
        startedAtMs: 10,
      },
    });
    expect(resolvePlayerStatusLine({ view: pending, display: LOCAL_PLAYER_DISPLAY })).toBeNull();

    const sendingLocal = makeView({
      role: 'active',
      transfer: {
        commandIdText: 'command-1',
        targetSessionIdText: OTHER_SESSION,
        startedAtMs: 10,
      },
    });
    const localDisplay = resolveCrossDevicePlayerDisplay({
      view: sendingLocal,
      isAuthoringHold: false,
    });
    expect(localDisplay).toBe(LOCAL_PLAYER_DISPLAY);
    const sendingLocalLine = resolvePlayerStatusLine({
      view: sendingLocal,
      display: localDisplay,
    });
    expect(sendingLocalLine).toEqual({
      kind: 'sending',
      device: deviceEntry(sendingLocal, OTHER_SESSION),
    });
    expect(sendingLocalLine).not.toBeNull();
    if (sendingLocalLine !== null) {
      expect(playerStatusLineKey(sendingLocalLine)).toBe(
        'media_player.cross_device.sending_to_device'
      );
    }

    const sendingRemote = makeView({
      transfer: {
        commandIdText: 'command-1',
        targetSessionIdText: OTHER_SESSION,
        startedAtMs: 10,
      },
    });
    const remoteDisplay = resolveCrossDevicePlayerDisplay({
      view: sendingRemote,
      isAuthoringHold: false,
    });
    expect(remoteDisplay.kind).toBe('remote');
    expect(resolvePlayerStatusLine({ view: sendingRemote, display: remoteDisplay })).toEqual({
      kind: 'sending',
      device: deviceEntry(sendingRemote, OTHER_SESSION),
    });

    const missingTarget = makeView({
      role: 'active',
      transfer: {
        commandIdText: 'command-1',
        targetSessionIdText: MISSING_SESSION,
        startedAtMs: 10,
      },
    });
    expect(resolvePlayerStatusLine({ view: missingTarget, display: LOCAL_PLAYER_DISPLAY })).toEqual(
      { kind: 'sending', device: null }
    );

    const takingOverHere = makeView({
      transfer: {
        commandIdText: 'command-1',
        targetSessionIdText: THIS_SESSION,
        startedAtMs: 10,
      },
    });
    const takingOverDisplay = resolveCrossDevicePlayerDisplay({
      view: takingOverHere,
      isAuthoringHold: false,
    });
    expect(takingOverDisplay.kind).toBe('remote');
    if (takingOverDisplay.kind !== 'remote') {
      return;
    }
    const remoteLine = resolvePlayerStatusLine({
      view: takingOverHere,
      display: takingOverDisplay,
    });
    expect(remoteLine).toEqual({
      kind: 'remote',
      status: 'playing',
      device: takingOverDisplay.activeDevice,
    });
    expect(remoteLine).not.toBeNull();
    if (remoteLine !== null) {
      expect(playerStatusLineKey(remoteLine)).toBe('media_player.cross_device.playing_on_device');
    }

    const pausedView = makeView({ state: makeState({ status: 'paused' }) });
    const pausedDisplay = resolveCrossDevicePlayerDisplay({
      view: pausedView,
      isAuthoringHold: false,
    });
    const pausedLine = resolvePlayerStatusLine({ view: pausedView, display: pausedDisplay });
    expect(pausedLine?.kind).toBe('remote');
    if (pausedLine !== null) {
      expect(playerStatusLineKey(pausedLine)).toBe('media_player.cross_device.paused_on_device');
    }

    const loadingView = makeView({ state: makeState({ status: 'loading' }) });
    const loadingDisplay = resolveCrossDevicePlayerDisplay({
      view: loadingView,
      isAuthoringHold: false,
    });
    const loadingLine = resolvePlayerStatusLine({ view: loadingView, display: loadingDisplay });
    expect(loadingLine?.kind).toBe('remote');
    if (loadingLine !== null) {
      expect(playerStatusLineKey(loadingLine)).toBe('media_player.cross_device.starting_on_device');
    }

    const localOnly = makeView({ role: 'active', activeSessionIdText: THIS_SESSION });
    expect(
      resolvePlayerStatusLine({
        view: localOnly,
        display: resolveCrossDevicePlayerDisplay({ view: localOnly, isAuthoringHold: false }),
      })
    ).toBeNull();
  });

  it('leaves the active device empty when that session is not in the device list', () => {
    const view = makeView({
      devices: { revision: 1, devices: [makeDevice(THIS_SESSION)] },
    });
    const display = resolveCrossDevicePlayerDisplay({ view, isAuthoringHold: false });
    expect(display.kind).toBe('remote');
    if (display.kind !== 'remote') {
      return;
    }
    expect(display.activeDevice).toBeNull();
  });

  it('uses each shared resource id, and treats a starting remote row as playing', () => {
    expect(playbackResourceRefRowMediaId({ kind: 'item', item_id_text: 'item-1' })).toBe('item-1');
    expect(playbackResourceRefRowMediaId({ kind: 'clip', clip_id_text: 'clip-1' })).toBe('clip-1');
    expect(
      playbackResourceRefRowMediaId({ kind: 'soundbite', item_soundbite_id_text: 'sb-1' })
    ).toBe('sb-1');
    expect(
      playbackResourceRefRowMediaId({ kind: 'add_by_rss', add_by_rss_hash_id: 'hash-1' })
    ).toBe('hash-1');

    expect(selectRemoteRowMediaId(makeView())).toBe('item-1');
    expect(selectRemoteRowMediaId(makeView({ availability: 'pending' }))).toBeNull();
    expect(selectRemoteRowIsPlaying(makeView({ state: makeState({ status: 'loading' }) }))).toBe(
      true
    );
    expect(selectRemoteRowIsPlaying(makeView({ state: makeState({ status: 'paused' }) }))).toBe(
      false
    );
  });

  it('shows the device switch only when two devices are connected and the view is ready', () => {
    expect(selectPlaybackDeviceSwitchVisible(makeView())).toBe(true);
    expect(
      selectPlaybackDeviceSwitchVisible(
        makeView({ devices: { revision: 1, devices: [makeDevice(THIS_SESSION)] } })
      )
    ).toBe(false);
    expect(selectPlaybackDeviceSwitchVisible(makeView({ availability: 'unavailable' }))).toBe(
      false
    );
    expect(selectPlaybackDeviceSwitchVisible(makeView({ devices: null }))).toBe(false);
  });

  it('can move playback when the shared state names an item', () => {
    expect(selectCanTransferPlayback(makeView())).toBe(true);
    expect(selectCanTransferPlayback(makeView({ state: makeState({ resource: null }) }))).toBe(
      false
    );
    expect(selectCanTransferPlayback(makeView({ state: null }))).toBe(false);
  });

  it('names a device from its label, its client type, a shared number, or as another device', () => {
    const calls: Array<{
      key: PlaybackDeviceLabelKey;
      values?: Record<string, string | number>;
    }> = [];
    const translate: PlaybackDeviceLabelTranslate = (key, values) => {
      calls.push(values === undefined ? { key } : { key, values });
      return key;
    };

    expect(formatPlaybackDeviceLabel(labelEntry('  iPhone · iOS  ', null), translate)).toBe(
      'iPhone · iOS'
    );
    expect(calls).toEqual([]);

    expect(formatPlaybackDeviceLabel(labelEntry(null, null, 'web'), translate)).toBe(
      'settings.account.sessions.client_type_web'
    );
    expect(formatPlaybackDeviceLabel(labelEntry(null, null, 'mobile'), translate)).toBe(
      'settings.account.sessions.client_type_mobile'
    );

    calls.length = 0;
    expect(formatPlaybackDeviceLabel(labelEntry('  iPhone · iOS  ', 2), translate)).toBe(
      'media_player.devices.same_label_number'
    );
    expect(calls).toEqual([
      {
        key: 'media_player.devices.same_label_number',
        values: { device: 'iPhone · iOS', number: 2 },
      },
    ]);

    calls.length = 0;
    expect(formatPlaybackDeviceLabel(null, translate)).toBe('media_player.devices.another_device');
    expect(calls).toEqual([{ key: 'media_player.devices.another_device' }]);
  });

  it('maps each transfer failure to its own message', () => {
    const keys = [
      transferFailureMessageKey('load_failed'),
      transferFailureMessageKey('autoplay_blocked'),
      transferFailureMessageKey('timeout'),
      transferFailureMessageKey('not_connected'),
      transferFailureMessageKey('send_failed'),
    ];
    expect(keys).toEqual([
      'media_player.devices.transfer_failed_load_failed',
      'media_player.devices.transfer_failed_autoplay_blocked',
      'media_player.devices.transfer_failed_timeout',
      'media_player.devices.transfer_failed_not_connected',
      'media_player.devices.transfer_failed_send_failed',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
