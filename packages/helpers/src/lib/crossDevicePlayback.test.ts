import { describe, expect, it } from 'vitest';

import type { DTOPlaybackDevice, PlaybackCommandType } from './accountPlaybackStream.js';
import type { PlaybackPositionBase } from './crossDevicePlayback.js';
import {
  buildPlaybackDeviceList,
  estimatePlaybackPositionAtServerTime,
  estimatePlaybackPositionSeconds,
  getPlaybackRemoteControls,
  isNewerPlaybackRevision,
  isPlaybackCommandAllowed,
  PLAYBACK_COMMANDS_ALLOWED_FOR_LIVE,
  resolvePlaybackRole,
  shouldShowPlaybackDeviceSwitch,
} from './crossDevicePlayback.js';

function positionState(
  overrides: Partial<PlaybackPositionBase & { sent_at_ms: number }> = {}
): PlaybackPositionBase & { sent_at_ms: number } {
  return {
    status: 'playing',
    is_live: false,
    position_seconds: 10,
    duration_seconds: 3_600,
    rate: 1,
    updated_at_ms: 1_000,
    sent_at_ms: 1_000,
    ...overrides,
  };
}

function device(
  sessionIdText: string,
  overrides: Partial<Omit<DTOPlaybackDevice, 'session_id_text'>> = {}
): DTOPlaybackDevice {
  return {
    session_id_text: sessionIdText,
    client_type: 'web',
    device_label: null,
    session_created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('estimatePlaybackPositionSeconds', () => {
  it('advances a playing item by the combined server age and client elapsed time', () => {
    const state = positionState({
      position_seconds: 10,
      rate: 1,
      updated_at_ms: 1_000,
      sent_at_ms: 4_000,
    });

    expect(
      estimatePlaybackPositionSeconds({
        state,
        receivedAtMs: 10_000,
        nowMs: 12_000,
      })
    ).toBe(15);
  });

  it('doubles the advance at rate 2', () => {
    const state = positionState({
      position_seconds: 10,
      rate: 2,
      updated_at_ms: 1_000,
      sent_at_ms: 4_000,
    });

    expect(
      estimatePlaybackPositionSeconds({
        state,
        receivedAtMs: 10_000,
        nowMs: 12_000,
      })
    ).toBe(20);
  });

  it('does not advance while paused or loading', () => {
    const statuses: Array<'paused' | 'loading'> = ['paused', 'loading'];
    for (const status of statuses) {
      const state = positionState({ status, position_seconds: 10, updated_at_ms: 1_000 });
      expect(estimatePlaybackPositionAtServerTime(state, 11_000)).toBe(10);
      expect(
        estimatePlaybackPositionSeconds({
          state,
          receivedAtMs: 0,
          nowMs: 10_000,
        })
      ).toBe(10);
    }
  });

  it('clamps the result at duration and at 0', () => {
    const belowZero = positionState({
      status: 'paused',
      position_seconds: -4,
      duration_seconds: 600,
      updated_at_ms: 0,
      sent_at_ms: 0,
    });
    expect(estimatePlaybackPositionSeconds({ state: belowZero, receivedAtMs: 0, nowMs: 0 })).toBe(
      0
    );
    expect(estimatePlaybackPositionAtServerTime(belowZero, 0)).toBe(0);
  });

  it('counts a negative client elapsed time as 0', () => {
    const state = positionState({
      position_seconds: 10,
      rate: 1,
      updated_at_ms: 1_000,
      sent_at_ms: 2_000,
    });

    expect(
      estimatePlaybackPositionSeconds({
        state,
        receivedAtMs: 20_000,
        nowMs: 15_000,
      })
    ).toBe(11);
  });

  it('returns null for a live item and for a null position', () => {
    const live = positionState({
      is_live: true,
      position_seconds: 12,
      updated_at_ms: 0,
      sent_at_ms: 0,
    });
    expect(estimatePlaybackPositionAtServerTime(live, 5_000)).toBeNull();
    expect(
      estimatePlaybackPositionSeconds({ state: live, receivedAtMs: 0, nowMs: 5_000 })
    ).toBeNull();

    const missingPosition = positionState({
      is_live: false,
      position_seconds: null,
      updated_at_ms: 0,
      sent_at_ms: 0,
    });
    expect(estimatePlaybackPositionAtServerTime(missingPosition, 5_000)).toBeNull();
    expect(
      estimatePlaybackPositionSeconds({ state: missingPosition, receivedAtMs: 0, nowMs: 5_000 })
    ).toBeNull();
  });

  it('agrees with the server-time estimate when no client time has passed', () => {
    const state = positionState({
      position_seconds: 10,
      rate: 1,
      updated_at_ms: 1_000,
      sent_at_ms: 6_000,
    });

    expect(estimatePlaybackPositionAtServerTime(state, 6_000)).toBe(15);
    expect(
      estimatePlaybackPositionSeconds({
        state,
        receivedAtMs: 50_000,
        nowMs: 50_000,
      })
    ).toBe(15);
  });

  it('reads the end of the bar only from duration_seconds on the state', () => {
    const bounded = positionState({
      position_seconds: 590,
      duration_seconds: 600,
      rate: 1,
      updated_at_ms: 0,
      sent_at_ms: 0,
    });
    expect(
      estimatePlaybackPositionSeconds({ state: bounded, receivedAtMs: 0, nowMs: 60_000 })
    ).toBe(600);
    expect(
      estimatePlaybackPositionSeconds({ state: bounded, receivedAtMs: 0, nowMs: 120_000 })
    ).toBe(600);
    expect(estimatePlaybackPositionAtServerTime(bounded, 60_000)).toBe(600);

    const unbounded = positionState({
      position_seconds: 590,
      duration_seconds: null,
      rate: 1,
      updated_at_ms: 0,
      sent_at_ms: 0,
    });
    expect(
      estimatePlaybackPositionSeconds({ state: unbounded, receivedAtMs: 0, nowMs: 60_000 })
    ).toBe(650);
    expect(estimatePlaybackPositionAtServerTime(unbounded, 60_000)).toBe(650);
  });
});

describe('isPlaybackCommandAllowed', () => {
  const allowedForLive: PlaybackCommandType[] = [
    'play',
    'pause',
    'next',
    'previous',
    'play_item',
    'take_over',
  ];
  const disallowedForLive: PlaybackCommandType[] = ['seek', 'set_rate'];

  it('rejects seek and set_rate for a live item and allows them otherwise', () => {
    for (const commandType of disallowedForLive) {
      expect(isPlaybackCommandAllowed(commandType, { isLive: true })).toBe(false);
      expect(isPlaybackCommandAllowed(commandType, { isLive: false })).toBe(true);
    }
  });

  it('allows take over, play, pause, next, previous, and play item whether or not the item is live', () => {
    expect(PLAYBACK_COMMANDS_ALLOWED_FOR_LIVE).toEqual(allowedForLive);
    for (const commandType of allowedForLive) {
      expect(isPlaybackCommandAllowed(commandType, { isLive: true })).toBe(true);
      expect(isPlaybackCommandAllowed(commandType, { isLive: false })).toBe(true);
    }
  });
});

describe('getPlaybackRemoteControls', () => {
  it('hides progress, seek, skip, and rate for a live item and keeps transfer, next, and previous', () => {
    expect(getPlaybackRemoteControls({ isLive: true })).toEqual({
      canPlayPause: true,
      canSeek: false,
      canSkip: false,
      canSetRate: false,
      showsProgress: false,
      canTransfer: true,
      canTrackNext: true,
      canTrackPrevious: true,
    });
  });

  it('enables every control when the item is not live', () => {
    expect(getPlaybackRemoteControls({ isLive: false })).toEqual({
      canPlayPause: true,
      canSeek: true,
      canSkip: true,
      canSetRate: true,
      showsProgress: true,
      canTransfer: true,
      canTrackNext: true,
      canTrackPrevious: true,
    });
  });
});

describe('resolvePlaybackRole', () => {
  it('is idle when no session is active, including when this session is unknown', () => {
    expect(resolvePlaybackRole({ thisSessionIdText: null, activeSessionIdText: null })).toBe(
      'idle'
    );
    expect(resolvePlaybackRole({ thisSessionIdText: 'session-a', activeSessionIdText: null })).toBe(
      'idle'
    );
  });

  it('is active when this session is the active session', () => {
    expect(
      resolvePlaybackRole({ thisSessionIdText: 'session-a', activeSessionIdText: 'session-a' })
    ).toBe('active');
  });

  it('is remote when a different session is active', () => {
    expect(
      resolvePlaybackRole({ thisSessionIdText: 'session-a', activeSessionIdText: 'session-b' })
    ).toBe('remote');
    expect(resolvePlaybackRole({ thisSessionIdText: null, activeSessionIdText: 'session-b' })).toBe(
      'remote'
    );
  });
});

describe('isNewerPlaybackRevision', () => {
  it('replaces a missing state or a higher revision only', () => {
    expect(isNewerPlaybackRevision(null, { revision: 1 })).toBe(true);
    expect(isNewerPlaybackRevision({ revision: 1 }, { revision: 2 })).toBe(true);
    expect(isNewerPlaybackRevision({ revision: 2 }, { revision: 2 })).toBe(false);
    expect(isNewerPlaybackRevision({ revision: 3 }, { revision: 2 })).toBe(false);
  });
});

describe('buildPlaybackDeviceList', () => {
  it('lists this device first and leaves the active device in its sorted place', () => {
    const devices = [
      device('later', {
        device_label: 'Later',
        session_created_at: '2026-01-03T00:00:00.000Z',
      }),
      device('this', {
        device_label: 'This',
        session_created_at: '2026-01-02T00:00:00.000Z',
      }),
      device('earlier', {
        device_label: 'Earlier',
        session_created_at: '2026-01-01T00:00:00.000Z',
      }),
    ];

    const entries = buildPlaybackDeviceList({
      devices,
      thisSessionIdText: 'this',
      activeSessionIdText: 'later',
    });

    expect(entries.map((entry) => entry.device.session_id_text)).toEqual([
      'this',
      'earlier',
      'later',
    ]);
    expect(entries.map((entry) => entry.isThisDevice)).toEqual([true, false, false]);
    expect(entries.map((entry) => entry.isActive)).toEqual([false, false, true]);
    expect(entries.map((entry) => entry.sameLabelNumber)).toEqual([null, null, null]);
  });

  it('sorts every device when this session is not in the list', () => {
    const entries = buildPlaybackDeviceList({
      devices: [
        device('b', { device_label: 'B', session_created_at: '2026-01-02T00:00:00.000Z' }),
        device('a', { device_label: 'A', session_created_at: '2026-01-01T00:00:00.000Z' }),
      ],
      thisSessionIdText: 'missing',
      activeSessionIdText: null,
    });

    expect(entries.map((entry) => entry.device.session_id_text)).toEqual(['a', 'b']);
    expect(entries.map((entry) => entry.isThisDevice)).toEqual([false, false]);
  });

  it('numbers shared labels by creation time, independent of which device is this one', () => {
    const devices = [
      device('late-phone', {
        device_label: 'iPhone · iOS',
        session_created_at: '2026-02-02T00:00:00.000Z',
      }),
      device('early-phone', {
        device_label: 'iPhone · iOS',
        session_created_at: '2026-02-01T00:00:00.000Z',
      }),
      device('laptop', {
        device_label: 'Mac',
        session_created_at: '2026-01-01T00:00:00.000Z',
      }),
    ];

    const numbersFor = (thisSessionIdText: string) =>
      buildPlaybackDeviceList({
        devices,
        thisSessionIdText,
        activeSessionIdText: null,
      }).map((entry) => [entry.device.session_id_text, entry.sameLabelNumber]);

    expect(numbersFor('early-phone')).toEqual([
      ['early-phone', 1],
      ['laptop', null],
      ['late-phone', 2],
    ]);
    expect(numbersFor('late-phone')).toEqual([
      ['late-phone', 2],
      ['laptop', null],
      ['early-phone', 1],
    ]);
  });

  it('numbers label-less sessions of one client type and leaves a different client type alone', () => {
    const entries = buildPlaybackDeviceList({
      devices: [
        device('web-late', {
          client_type: 'web',
          device_label: null,
          session_created_at: '2026-03-02T00:00:00.000Z',
        }),
        device('web-early', {
          client_type: 'web',
          device_label: null,
          session_created_at: '2026-03-01T00:00:00.000Z',
        }),
        device('phone', {
          client_type: 'mobile',
          device_label: null,
          session_created_at: '2026-03-01T00:00:00.000Z',
        }),
        device('labeled-web', {
          client_type: 'web',
          device_label: 'web',
          session_created_at: '2026-03-03T00:00:00.000Z',
        }),
      ],
      thisSessionIdText: 'phone',
      activeSessionIdText: null,
    });

    expect(entries.map((entry) => [entry.device.session_id_text, entry.sameLabelNumber])).toEqual([
      ['phone', null],
      ['web-early', 1],
      ['web-late', 2],
      ['labeled-web', null],
    ]);
  });

  it('groups a blank label with other label-less sessions of the same client type', () => {
    const entries = buildPlaybackDeviceList({
      devices: [
        device('blank', {
          device_label: '   ',
          session_created_at: '2026-03-01T00:00:00.000Z',
        }),
        device('plain', {
          device_label: 'iPhone · iOS',
          session_created_at: '2026-03-01T00:00:00.000Z',
        }),
        device('trimmed', {
          device_label: ' iPhone · iOS ',
          session_created_at: '2026-03-02T00:00:00.000Z',
        }),
        device('null-label', {
          device_label: null,
          session_created_at: '2026-03-02T00:00:00.000Z',
        }),
      ],
      thisSessionIdText: null,
      activeSessionIdText: null,
    });

    expect(entries.map((entry) => [entry.device.session_id_text, entry.sameLabelNumber])).toEqual([
      ['blank', 1],
      ['plain', 1],
      ['null-label', 2],
      ['trimmed', 2],
    ]);
  });

  it('keeps the first device when a session id is repeated', () => {
    const entries = buildPlaybackDeviceList({
      devices: [
        device('dup', {
          device_label: 'First',
          session_created_at: '2026-04-02T00:00:00.000Z',
        }),
        device('dup', {
          device_label: 'Second',
          session_created_at: '2026-04-01T00:00:00.000Z',
        }),
        device('other', {
          device_label: 'Other',
          session_created_at: '2026-04-03T00:00:00.000Z',
        }),
      ],
      thisSessionIdText: null,
      activeSessionIdText: 'dup',
    });

    expect(entries.map((entry) => entry.device.session_id_text)).toEqual(['dup', 'other']);
    expect(entries.map((entry) => entry.device.device_label)).toEqual(['First', 'Other']);
    expect(entries.map((entry) => entry.isActive)).toEqual([true, false]);
    expect(entries.map((entry) => entry.isThisDevice)).toEqual([false, false]);
  });

  it('sorts other devices by creation time, breaks ties with session id, and puts unparsable times last', () => {
    const entries = buildPlaybackDeviceList({
      devices: [
        device('b-same', {
          device_label: 'B',
          session_created_at: '2026-05-01T00:00:00.000Z',
        }),
        device('bad', {
          device_label: 'Bad',
          session_created_at: 'not-a-date',
        }),
        device('a-same', {
          device_label: 'A',
          session_created_at: '2026-05-01T00:00:00.000Z',
        }),
        device('this', {
          device_label: 'This',
          session_created_at: '2026-06-01T00:00:00.000Z',
        }),
      ],
      thisSessionIdText: 'this',
      activeSessionIdText: null,
    });

    expect(entries.map((entry) => entry.device.session_id_text)).toEqual([
      'this',
      'a-same',
      'b-same',
      'bad',
    ]);
  });
});

describe('shouldShowPlaybackDeviceSwitch', () => {
  it('is true only when two distinct sessions are present', () => {
    expect(shouldShowPlaybackDeviceSwitch([])).toBe(false);
    expect(shouldShowPlaybackDeviceSwitch([device('only')])).toBe(false);
    expect(
      shouldShowPlaybackDeviceSwitch([
        device('dup', { device_label: 'A' }),
        device('dup', { device_label: 'B' }),
      ])
    ).toBe(false);
    expect(shouldShowPlaybackDeviceSwitch([device('a'), device('b')])).toBe(true);
  });
});
