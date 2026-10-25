import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DTOPlaybackDevices, DTOPlaybackState } from '@podverse/helpers/accountPlaybackStream';
import { MediumEnum } from '@podverse/helpers/medium';

import type {
  CrossDevicePlaybackCommandFailure,
  CrossDevicePlaybackTransfer,
  CrossDevicePlaybackTransferFailure,
} from './crossDevicePlaybackStore';
import {
  applyCrossDevicePlaybackDevices,
  applyCrossDevicePlaybackPresence,
  applyCrossDevicePlaybackSnapshot,
  applyCrossDevicePlaybackState,
  beginCrossDevicePlaybackTransfer,
  clearCrossDevicePlaybackCommandFailure,
  clearCrossDevicePlaybackTransferFailure,
  getCrossDevicePlaybackPositionSeconds,
  getCrossDevicePlaybackView,
  recordCrossDevicePlaybackCommandFailure,
  recordCrossDevicePlaybackPublish,
  recordCrossDevicePlaybackTransferFailure,
  resetCrossDevicePlaybackStore,
  setCrossDevicePlaybackAvailability,
  settleCrossDevicePlaybackTransfer,
  subscribeCrossDevicePlaybackPositionClock,
  subscribeCrossDevicePlaybackView,
} from './crossDevicePlaybackStore';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';
const NOW_MS = 1_000_000;

const playbackState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState => ({
  revision: 10,
  active_session_id_text: OTHER_SESSION,
  resource: {
    ref: { kind: 'item', item_id_text: 'item-1' },
    medium: MediumEnum.Podcast,
    title: 'Episode',
    channel_title: 'Podcast',
    image_url: null,
  },
  status: 'paused',
  is_live: false,
  position_seconds: 30,
  duration_seconds: 600,
  rate: 1,
  updated_at_ms: 5_000,
  sent_at_ms: 5_000,
  ...overrides,
});

const playbackDevices = (revision: number): DTOPlaybackDevices => ({
  revision,
  devices: [THIS_SESSION, OTHER_SESSION].map((sessionIdText) => ({
    session_id_text: sessionIdText,
    client_type: 'mobile',
    device_label: null,
    session_created_at: '2026-01-01T00:00:00.000Z',
  })),
});

describe('crossDevicePlaybackStore', () => {
  beforeEach(() => {
    resetCrossDevicePlaybackStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCrossDevicePlaybackStore();
  });

  it('replaces devices and state from a snapshot even when its revision is lower', () => {
    applyCrossDevicePlaybackState(playbackState({ revision: 40 }), NOW_MS);
    applyCrossDevicePlaybackDevices(playbackDevices(40));

    const state = playbackState({ revision: 3 });
    const devices = playbackDevices(2);
    applyCrossDevicePlaybackSnapshot({ devices, state }, NOW_MS + 100);

    const view = getCrossDevicePlaybackView();
    expect(view.state).toBe(state);
    expect(view.devices).toBe(devices);
    expect(view.stateReceivedAtMs).toBe(NOW_MS + 100);
  });

  it('applies a state event only when it is newer', () => {
    expect(applyCrossDevicePlaybackState(playbackState({ revision: 10 }), NOW_MS)).toBe(true);
    const applied = getCrossDevicePlaybackView();

    expect(applyCrossDevicePlaybackState(playbackState({ revision: 10 }), NOW_MS + 1)).toBe(false);
    expect(applyCrossDevicePlaybackState(playbackState({ revision: 9 }), NOW_MS + 2)).toBe(false);
    expect(getCrossDevicePlaybackView()).toBe(applied);
  });

  it('applies devices events by their own revision, independent of state', () => {
    applyCrossDevicePlaybackState(playbackState({ revision: 50 }), NOW_MS);

    expect(applyCrossDevicePlaybackDevices(playbackDevices(1))).toBe(true);
    expect(applyCrossDevicePlaybackDevices(playbackDevices(1))).toBe(false);
    expect(applyCrossDevicePlaybackDevices(playbackDevices(2))).toBe(true);
    expect(getCrossDevicePlaybackView().devices?.revision).toBe(2);
    expect(getCrossDevicePlaybackView().state?.revision).toBe(50);
  });

  it('sets this session from presence and applies its state and devices by revision', () => {
    applyCrossDevicePlaybackState(playbackState({ revision: 10 }), NOW_MS);
    applyCrossDevicePlaybackDevices(playbackDevices(5));

    applyCrossDevicePlaybackPresence(
      {
        session_id_text: THIS_SESSION,
        devices: playbackDevices(4),
        state: playbackState({ revision: 8 }),
      },
      NOW_MS + 1
    );
    let view = getCrossDevicePlaybackView();
    expect(view.thisSessionIdText).toBe(THIS_SESSION);
    expect(view.state?.revision).toBe(10);
    expect(view.devices?.revision).toBe(5);

    applyCrossDevicePlaybackPresence(
      {
        session_id_text: THIS_SESSION,
        devices: playbackDevices(6),
        state: playbackState({ revision: 12 }),
      },
      NOW_MS + 2
    );
    view = getCrossDevicePlaybackView();
    expect(view.state?.revision).toBe(12);
    expect(view.stateReceivedAtMs).toBe(NOW_MS + 2);
    expect(view.devices?.revision).toBe(6);
  });

  it('never applies a presence state over a newer own claim', () => {
    applyCrossDevicePlaybackState(playbackState({ revision: 10 }), NOW_MS);
    recordCrossDevicePlaybackPublish({ revision: 20, active_session_id_text: THIS_SESSION });

    applyCrossDevicePlaybackPresence(
      {
        session_id_text: THIS_SESSION,
        devices: playbackDevices(1),
        state: playbackState({ revision: 15 }),
      },
      NOW_MS + 1
    );

    const view = getCrossDevicePlaybackView();
    expect(view.state?.revision).toBe(10);
    expect(view.localClaim).toEqual({ revision: 20, activeSessionIdText: THIS_SESSION });
    expect(view.role).toBe('active');
  });

  it('changes nothing for a presence response with a null state', () => {
    const state = playbackState({ revision: 10 });
    applyCrossDevicePlaybackState(state, NOW_MS);
    applyCrossDevicePlaybackPresence(
      { session_id_text: THIS_SESSION, devices: playbackDevices(1), state: null },
      NOW_MS + 1
    );
    const view = getCrossDevicePlaybackView();

    applyCrossDevicePlaybackPresence(
      { session_id_text: THIS_SESSION, devices: playbackDevices(1), state: null },
      NOW_MS + 2
    );

    expect(getCrossDevicePlaybackView()).toBe(view);
    expect(view.state).toBe(state);
    expect(view.stateReceivedAtMs).toBe(NOW_MS);
  });

  it('resolves the role from this session and the active session', () => {
    expect(getCrossDevicePlaybackView().role).toBe('idle');

    applyCrossDevicePlaybackState(playbackState({ revision: 1 }), NOW_MS);
    expect(getCrossDevicePlaybackView().role).toBe('remote');

    applyCrossDevicePlaybackPresence(
      { session_id_text: THIS_SESSION, devices: playbackDevices(1), state: null },
      NOW_MS
    );
    expect(getCrossDevicePlaybackView().role).toBe('remote');

    applyCrossDevicePlaybackState(
      playbackState({ revision: 2, active_session_id_text: THIS_SESSION }),
      NOW_MS
    );
    expect(getCrossDevicePlaybackView().role).toBe('active');

    applyCrossDevicePlaybackState(
      playbackState({ revision: 3, active_session_id_text: null }),
      NOW_MS
    );
    expect(getCrossDevicePlaybackView().role).toBe('idle');
    expect(getCrossDevicePlaybackView().activeSessionIdText).toBe(null);
  });

  it('keeps an own claim ahead of older states until its echo or a newer state applies', () => {
    applyCrossDevicePlaybackPresence(
      {
        session_id_text: THIS_SESSION,
        devices: playbackDevices(1),
        state: playbackState({ revision: 10 }),
      },
      NOW_MS
    );
    expect(getCrossDevicePlaybackView().role).toBe('remote');

    recordCrossDevicePlaybackPublish({ revision: 20, active_session_id_text: THIS_SESSION });
    expect(getCrossDevicePlaybackView().role).toBe('active');
    expect(getCrossDevicePlaybackView().activeSessionIdText).toBe(THIS_SESSION);

    expect(applyCrossDevicePlaybackState(playbackState({ revision: 15 }), NOW_MS + 1)).toBe(true);
    expect(getCrossDevicePlaybackView().state?.revision).toBe(15);
    expect(getCrossDevicePlaybackView().role).toBe('active');

    const echo = playbackState({ revision: 20, active_session_id_text: THIS_SESSION });
    expect(applyCrossDevicePlaybackState(echo, NOW_MS + 2)).toBe(true);
    expect(getCrossDevicePlaybackView().localClaim).toBe(null);
    expect(getCrossDevicePlaybackView().role).toBe('active');

    expect(applyCrossDevicePlaybackState(playbackState({ revision: 30 }), NOW_MS + 3)).toBe(true);
    expect(getCrossDevicePlaybackView().role).toBe('remote');
    expect(getCrossDevicePlaybackView().activeSessionIdText).toBe(OTHER_SESSION);
  });

  it('records a publish only when it is newer than the state and the current claim', () => {
    applyCrossDevicePlaybackState(playbackState({ revision: 10 }), NOW_MS);

    recordCrossDevicePlaybackPublish({ revision: 10, active_session_id_text: THIS_SESSION });
    expect(getCrossDevicePlaybackView().localClaim).toBe(null);

    recordCrossDevicePlaybackPublish({ revision: 20, active_session_id_text: THIS_SESSION });
    recordCrossDevicePlaybackPublish({ revision: 18, active_session_id_text: null });
    expect(getCrossDevicePlaybackView().localClaim).toEqual({
      revision: 20,
      activeSessionIdText: THIS_SESSION,
    });
  });

  it('keeps a newer own claim through a snapshot and drops an older one', () => {
    recordCrossDevicePlaybackPublish({ revision: 20, active_session_id_text: THIS_SESSION });

    applyCrossDevicePlaybackSnapshot(
      { devices: playbackDevices(1), state: playbackState({ revision: 15 }) },
      NOW_MS
    );
    expect(getCrossDevicePlaybackView().localClaim?.revision).toBe(20);
    expect(getCrossDevicePlaybackView().activeSessionIdText).toBe(THIS_SESSION);

    applyCrossDevicePlaybackSnapshot(
      { devices: playbackDevices(2), state: playbackState({ revision: 25 }) },
      NOW_MS + 1
    );
    expect(getCrossDevicePlaybackView().localClaim).toBe(null);
    expect(getCrossDevicePlaybackView().activeSessionIdText).toBe(OTHER_SESSION);
  });

  it('settles only the matching transfer and records its failure', () => {
    const transfer: CrossDevicePlaybackTransfer = {
      commandIdText: 'command-2',
      targetSessionIdText: OTHER_SESSION,
      startedAtMs: NOW_MS,
    };
    beginCrossDevicePlaybackTransfer(transfer);

    settleCrossDevicePlaybackTransfer({
      commandIdText: 'command-1',
      failure: { targetSessionIdText: OTHER_SESSION, reason: 'timeout', atMs: NOW_MS + 1 },
    });
    expect(getCrossDevicePlaybackView().transfer).toBe(transfer);
    expect(getCrossDevicePlaybackView().transferFailure).toBe(null);

    const failure: CrossDevicePlaybackTransferFailure = {
      targetSessionIdText: OTHER_SESSION,
      reason: 'load_failed',
      atMs: NOW_MS + 2,
    };
    settleCrossDevicePlaybackTransfer({ commandIdText: 'command-2', failure });
    expect(getCrossDevicePlaybackView().transfer).toBe(null);
    expect(getCrossDevicePlaybackView().transferFailure).toBe(failure);

    clearCrossDevicePlaybackTransferFailure();
    expect(getCrossDevicePlaybackView().transferFailure).toBe(null);
  });

  it('records a send failure without touching the pending transfer', () => {
    const transfer: CrossDevicePlaybackTransfer = {
      commandIdText: 'command-1',
      targetSessionIdText: OTHER_SESSION,
      startedAtMs: NOW_MS,
    };
    beginCrossDevicePlaybackTransfer(transfer);

    const failure: CrossDevicePlaybackTransferFailure = {
      targetSessionIdText: OTHER_SESSION,
      reason: 'send_failed',
      atMs: NOW_MS + 1,
    };
    recordCrossDevicePlaybackTransferFailure(failure);

    expect(getCrossDevicePlaybackView().transfer).toBe(transfer);
    expect(getCrossDevicePlaybackView().transferFailure).toBe(failure);
  });

  it('records and clears a command failure', () => {
    const failure: CrossDevicePlaybackCommandFailure = { commandType: 'seek', atMs: NOW_MS };
    recordCrossDevicePlaybackCommandFailure(failure);
    expect(getCrossDevicePlaybackView().commandFailure).toBe(failure);

    clearCrossDevicePlaybackCommandFailure();
    expect(getCrossDevicePlaybackView().commandFailure).toBe(null);
  });

  it('estimates the shared position and reports none when live or nothing is shared', () => {
    expect(getCrossDevicePlaybackPositionSeconds(NOW_MS)).toBe(null);

    applyCrossDevicePlaybackState(
      playbackState({ revision: 1, status: 'playing', position_seconds: 30 }),
      NOW_MS
    );
    expect(getCrossDevicePlaybackPositionSeconds(NOW_MS + 2_500)).toBe(32.5);

    applyCrossDevicePlaybackState(
      playbackState({
        revision: 2,
        status: 'playing',
        is_live: true,
        position_seconds: null,
        duration_seconds: null,
      }),
      NOW_MS
    );
    expect(getCrossDevicePlaybackPositionSeconds(NOW_MS + 2_500)).toBe(null);

    applyCrossDevicePlaybackState(
      playbackState({ revision: 3, resource: null, position_seconds: null }),
      NOW_MS
    );
    expect(getCrossDevicePlaybackPositionSeconds(NOW_MS)).toBe(null);
  });

  it('ticks the position clock once per whole second while the shared state plays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    applyCrossDevicePlaybackState(
      playbackState({ revision: 1, status: 'playing', position_seconds: 10 }),
      Date.now()
    );

    const listener = vi.fn();
    const unsubscribe = subscribeCrossDevicePlaybackPositionClock(listener);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(listener).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs no clock interval while paused, live, or with no listeners', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);

    applyCrossDevicePlaybackState(playbackState({ revision: 1, status: 'playing' }), Date.now());
    expect(vi.getTimerCount()).toBe(0);

    const listener = vi.fn();
    const unsubscribe = subscribeCrossDevicePlaybackPositionClock(listener);
    expect(vi.getTimerCount()).toBe(1);

    applyCrossDevicePlaybackState(playbackState({ revision: 2, status: 'paused' }), Date.now());
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    expect(listener).toHaveBeenCalledTimes(0);

    applyCrossDevicePlaybackState(
      playbackState({
        revision: 3,
        status: 'playing',
        is_live: true,
        position_seconds: null,
        duration_seconds: null,
      }),
      Date.now()
    );
    expect(vi.getTimerCount()).toBe(0);

    unsubscribe();
  });

  it('returns to off with every field cleared on reset, and notifies', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    setCrossDevicePlaybackAvailability('ready');
    applyCrossDevicePlaybackPresence(
      {
        session_id_text: THIS_SESSION,
        devices: playbackDevices(1),
        state: playbackState({ revision: 1, status: 'playing' }),
      },
      Date.now()
    );
    recordCrossDevicePlaybackPublish({ revision: 5, active_session_id_text: THIS_SESSION });
    beginCrossDevicePlaybackTransfer({
      commandIdText: 'command-1',
      targetSessionIdText: OTHER_SESSION,
      startedAtMs: NOW_MS,
    });
    recordCrossDevicePlaybackCommandFailure({ commandType: 'play', atMs: NOW_MS });

    const viewListener = vi.fn();
    const unsubscribeView = subscribeCrossDevicePlaybackView(viewListener);
    const unsubscribeClock = subscribeCrossDevicePlaybackPositionClock(() => undefined);
    expect(vi.getTimerCount()).toBe(1);

    resetCrossDevicePlaybackStore();

    expect(getCrossDevicePlaybackView()).toEqual({
      availability: 'off',
      thisSessionIdText: null,
      devices: null,
      state: null,
      stateReceivedAtMs: null,
      localClaim: null,
      activeSessionIdText: null,
      role: 'idle',
      transfer: null,
      transferFailure: null,
      commandFailure: null,
    });
    expect(viewListener).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    unsubscribeView();
    unsubscribeClock();
  });
});
