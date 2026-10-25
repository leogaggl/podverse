import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AccountPlaybackStreamEvent,
  DTOPlaybackDevices,
  DTOPlaybackState,
  PlaybackPresenceResponse,
} from '@podverse/helpers/accountPlaybackStream';
import { ACCOUNT_PLAYBACK_STREAM_EVENT } from '@podverse/helpers/accountPlaybackStream';
import { MediumEnum } from '@podverse/helpers/medium';

import type { NotificationStreamConnection } from '../../notifications/notificationStreamStore';
import type { CrossDevicePlaybackAvailability } from './crossDevicePlaybackStore';
import {
  getCrossDevicePlaybackView,
  resetCrossDevicePlaybackStore,
} from './crossDevicePlaybackStore';
import {
  createCrossDevicePresenceController,
  resolveCrossDevicePlaybackAvailability,
} from './crossDevicePresenceController';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';

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

const presenceResponse = (
  overrides: Partial<PlaybackPresenceResponse> = {}
): PlaybackPresenceResponse => ({
  session_id_text: THIS_SESSION,
  devices: playbackDevices(1),
  state: null,
  ...overrides,
});

const snapshotEvent = (revision: number): AccountPlaybackStreamEvent => ({
  type: ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot,
  data: { devices: playbackDevices(revision), state: playbackState({ revision }) },
});

class MembershipRefusalError extends Error {}

/** Lets the timer queue and every pending promise callback run. */
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const availability = (): CrossDevicePlaybackAvailability =>
  getCrossDevicePlaybackView().availability;

type PendingCheckIn = {
  resolve: (response: PlaybackPresenceResponse) => void;
  reject: (error: unknown) => void;
};

const createHarness = () => {
  let nowMs = 1_000_000;
  const pending: PendingCheckIn[] = [];
  const checkIn = vi.fn(
    () =>
      new Promise<PlaybackPresenceResponse>((resolve, reject) => {
        pending.push({ resolve, reject });
      })
  );
  const controller = createCrossDevicePresenceController({
    checkIn,
    isMembershipRefusal: (error) => error instanceof MembershipRefusalError,
    now: () => nowMs,
  });

  const takeOldestCheckIn = (): PendingCheckIn => {
    const next = pending.shift();
    if (next === undefined) {
      throw new Error('no check-in is waiting');
    }
    return next;
  };

  return {
    checkIn,
    controller,
    setConnection: (connection: NotificationStreamConnection, featureEnabled = true): void => {
      controller.setInputs({ featureEnabled, connection });
    },
    /** Turns the feature on and moves the stream from `connecting` to `open`. */
    open: (): void => {
      controller.setInputs({ featureEnabled: true, connection: 'connecting' });
      controller.setInputs({ featureEnabled: true, connection: 'open' });
    },
    respond: async (response: PlaybackPresenceResponse = presenceResponse()): Promise<void> => {
      takeOldestCheckIn().resolve(response);
      await flush();
    },
    fail: async (error: unknown): Promise<void> => {
      takeOldestCheckIn().reject(error);
      await flush();
    },
    /** Moves the wall clock and fires every timer due in that span, as in the foreground. */
    advance: async (ms: number): Promise<void> => {
      nowMs += ms;
      await vi.advanceTimersByTimeAsync(ms);
    },
    /** Moves only the wall clock, as when Android holds JS timers in the background. */
    moveWallClock: (ms: number): void => {
      nowMs += ms;
    },
  };
};

type Harness = ReturnType<typeof createHarness>;

type AvailabilityParams = Parameters<typeof resolveCrossDevicePlaybackAvailability>[0];

describe('resolveCrossDevicePlaybackAvailability', () => {
  const resolve = (overrides: Partial<AvailabilityParams>): CrossDevicePlaybackAvailability =>
    resolveCrossDevicePlaybackAvailability({
      featureEnabled: true,
      refused: false,
      connection: 'open',
      previous: 'pending',
      hasFreshView: true,
      thisSessionIdText: THIS_SESSION,
      ...overrides,
    });

  const cases: Array<{
    name: string;
    overrides: Partial<AvailabilityParams>;
    expected: CrossDevicePlaybackAvailability;
  }> = [
    { name: 'off while the feature is off', overrides: { featureEnabled: false }, expected: 'off' },
    {
      name: 'off after a refusal, even from ready',
      overrides: { refused: true, previous: 'ready' },
      expected: 'off',
    },
    { name: 'off while the stream is idle', overrides: { connection: 'idle' }, expected: 'off' },
    {
      name: 'unavailable while retrying',
      overrides: { connection: 'retrying' },
      expected: 'unavailable',
    },
    {
      name: 'unavailable once stopped',
      overrides: { connection: 'stopped' },
      expected: 'unavailable',
    },
    {
      name: 'pending while connecting from off',
      overrides: { connection: 'connecting', previous: 'off' },
      expected: 'pending',
    },
    {
      name: 'ready when open with this session and a fresh view',
      overrides: {},
      expected: 'ready',
    },
    {
      name: 'pending when open without this session',
      overrides: { thisSessionIdText: null },
      expected: 'pending',
    },
    {
      name: 'pending when open without a fresh view',
      overrides: { hasFreshView: false },
      expected: 'pending',
    },
    {
      name: 'ready stays ready while reconnecting',
      overrides: { connection: 'connecting', previous: 'ready', hasFreshView: false },
      expected: 'ready',
    },
  ];

  it.each(cases)('$name', ({ overrides, expected }) => {
    expect(resolve(overrides)).toBe(expected);
  });
});

describe('createCrossDevicePresenceController', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    resetCrossDevicePlaybackStore();
    harness = createHarness();
  });

  afterEach(() => {
    harness.controller.dispose();
    resetCrossDevicePlaybackStore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('goes pending, then ready on a presence response, and stays ready through a reconnect', async () => {
    harness.setConnection('connecting');
    expect(availability()).toBe('pending');

    harness.setConnection('open');
    expect(availability()).toBe('pending');

    await harness.respond();
    expect(availability()).toBe('ready');
    expect(getCrossDevicePlaybackView().thisSessionIdText).toBe(THIS_SESSION);

    harness.setConnection('connecting');
    expect(availability()).toBe('ready');
    harness.setConnection('retrying');
    expect(availability()).toBe('unavailable');
    harness.setConnection('stopped');
    expect(availability()).toBe('unavailable');
    harness.setConnection('idle');
    expect(availability()).toBe('off');
  });

  it('needs a new snapshot or presence response before ready again after leaving ready', async () => {
    harness.open();
    await harness.respond();
    expect(availability()).toBe('ready');

    harness.setConnection('idle');
    harness.setConnection('connecting');
    harness.setConnection('open');
    expect(availability()).toBe('pending');

    harness.controller.applyStreamEvent(snapshotEvent(2));
    expect(availability()).toBe('ready');
    await harness.respond();

    harness.setConnection('retrying');
    harness.setConnection('connecting');
    harness.setConnection('open');
    expect(availability()).toBe('pending');

    await harness.respond();
    expect(availability()).toBe('ready');
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
  });

  it('checks in at once when the stream opens, then every 15 s, and never while not open', async () => {
    harness.setConnection('connecting');
    await harness.advance(60_000);
    expect(harness.checkIn).not.toHaveBeenCalled();

    harness.setConnection('open');
    expect(harness.checkIn).toHaveBeenCalledTimes(1);
    await harness.respond();

    await harness.advance(14_999);
    expect(harness.checkIn).toHaveBeenCalledTimes(1);
    await harness.advance(1);
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
    await harness.respond();

    await harness.advance(15_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
    await harness.respond();

    harness.setConnection('connecting');
    await harness.advance(60_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
  });

  it('skips a check-in while one is in flight', async () => {
    harness.open();
    await harness.advance(15_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(1);

    await harness.respond();
    await harness.advance(15_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
  });

  it('checks in on a progress sample only when one is due and the stream is open', async () => {
    harness.open();
    await harness.respond();

    harness.moveWallClock(14_999);
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(1);
    harness.moveWallClock(1);
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
    await harness.respond();

    harness.moveWallClock(10_000);
    harness.controller.notePresenceRefreshed();
    harness.moveWallClock(14_999);
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
    harness.moveWallClock(1);
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
    await harness.respond();

    harness.setConnection('connecting');
    harness.moveWallClock(60_000);
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
  });

  it('latches off on a membership refusal until the feature turns off and on again', async () => {
    harness.open();
    await harness.fail(new MembershipRefusalError('membership_expired'));

    expect(availability()).toBe('off');
    expect(harness.controller.isRunning()).toBe(false);
    await harness.advance(60_000);
    harness.controller.noteHeartbeat();
    harness.setConnection('open');
    expect(harness.checkIn).toHaveBeenCalledTimes(1);
    expect(availability()).toBe('off');

    harness.setConnection('open', false);
    harness.setConnection('open', true);
    expect(harness.controller.isRunning()).toBe(true);
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
    await harness.respond();
    expect(availability()).toBe('ready');

    harness.controller.noteMembershipRefusal();
    expect(availability()).toBe('off');
    await harness.advance(60_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(2);
  });

  it('keeps the view after any other failure and checks in again on the next tick', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    harness.open();
    await harness.respond(presenceResponse({ devices: playbackDevices(3) }));
    const view = getCrossDevicePlaybackView();

    await harness.advance(15_000);
    await harness.fail(new Error('Request failed with status code 503'));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(getCrossDevicePlaybackView()).toBe(view);
    expect(availability()).toBe('ready');
    harness.controller.noteHeartbeat();
    expect(harness.checkIn).toHaveBeenCalledTimes(2);

    await harness.advance(15_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(3);
  });

  it('drops a check-in response that lands after the feature turned off', async () => {
    harness.open();
    harness.setConnection('open', false);
    await harness.respond();

    expect(getCrossDevicePlaybackView().thisSessionIdText).toBeNull();
    expect(availability()).toBe('off');
  });

  it('dispose stops check-ins and ignores a response that arrives later', async () => {
    harness.open();
    harness.controller.dispose();
    await harness.respond();

    expect(getCrossDevicePlaybackView().thisSessionIdText).toBeNull();
    await harness.advance(60_000);
    expect(harness.checkIn).toHaveBeenCalledTimes(1);
    expect(harness.controller.isRunning()).toBe(false);
  });

  it('ignores events while not running and returns a state event only when it applied', () => {
    expect(harness.controller.applyStreamEvent(snapshotEvent(2))).toBeNull();
    expect(getCrossDevicePlaybackView().devices).toBeNull();

    harness.setConnection('connecting');
    expect(harness.controller.applyStreamEvent(snapshotEvent(2))).toBeNull();
    expect(getCrossDevicePlaybackView().devices?.revision).toBe(2);

    const newer = playbackState({ revision: 10 });
    expect(
      harness.controller.applyStreamEvent({
        type: ACCOUNT_PLAYBACK_STREAM_EVENT.state,
        data: newer,
      })
    ).toBe(newer);
    expect(
      harness.controller.applyStreamEvent({
        type: ACCOUNT_PLAYBACK_STREAM_EVENT.state,
        data: playbackState({ revision: 9 }),
      })
    ).toBeNull();
    expect(getCrossDevicePlaybackView().state).toBe(newer);

    expect(
      harness.controller.applyStreamEvent({
        type: ACCOUNT_PLAYBACK_STREAM_EVENT.devices,
        data: playbackDevices(3),
      })
    ).toBeNull();
    expect(getCrossDevicePlaybackView().devices?.revision).toBe(3);

    expect(
      harness.controller.applyStreamEvent({
        type: ACCOUNT_PLAYBACK_STREAM_EVENT.command,
        data: {
          command_id: 'command-1',
          sender_session_id_text: OTHER_SESSION,
          target_session_id_text: THIS_SESSION,
          issued_at_ms: 5_000,
          expires_at_ms: 10_000,
          command: { type: 'pause' },
          state: null,
        },
      })
    ).toBeNull();
  });
});
