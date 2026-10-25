import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DTOPlaybackState,
  PlaybackCommandSendBody,
  PlaybackCommandSendResponse,
  PlaybackErrorCode,
  PlaybackPresenceResponse,
  PlaybackStartFailedReason,
} from '@podverse/helpers/accountPlaybackStream';
import {
  PLAYBACK_ERROR_CODES,
  PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS,
} from '@podverse/helpers/accountPlaybackStream';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackApiError } from '@podverse/helpers-requests';

import type { CrossDevicePlaybackRemoteControl } from './crossDevicePlaybackRemoteControl';
import { createCrossDevicePlaybackRemoteControl } from './crossDevicePlaybackRemoteControl';
import {
  applyCrossDevicePlaybackPresence,
  applyCrossDevicePlaybackState,
  getCrossDevicePlaybackView,
  resetCrossDevicePlaybackStore,
  subscribeCrossDevicePlaybackView,
} from './crossDevicePlaybackStore';

const THIS_SESSION = 'session-this';
const ACTIVE_SESSION = 'session-active';
const TARGET_SESSION = 'session-target';

const sharedState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState => ({
  revision: 5,
  active_session_id_text: ACTIVE_SESSION,
  resource: {
    ref: { kind: 'item', item_id_text: 'item-1' },
    medium: MediumEnum.Podcast,
    title: 'Episode',
    channel_title: 'Podcast',
    image_url: null,
  },
  status: 'playing',
  is_live: false,
  position_seconds: 30,
  duration_seconds: 600,
  rate: 1,
  updated_at_ms: 5_000,
  sent_at_ms: 5_000,
  ...overrides,
});

const presence = (state: DTOPlaybackState): PlaybackPresenceResponse => ({
  session_id_text: THIS_SESSION,
  devices: { revision: 1, devices: [] },
  state,
});

class MembershipRefusalError extends Error {}

class PlaybackRequestError extends Error {
  readonly playbackError: PlaybackApiError;

  constructor(code: PlaybackErrorCode) {
    super(code);
    this.playbackError = { code };
  }
}

/** Lets the timer queue and every pending promise callback run. */
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const view = () => getCrossDevicePlaybackView();

type PendingSend = {
  body: PlaybackCommandSendBody;
  resolve: (response: PlaybackCommandSendResponse) => void;
  reject: (error: unknown) => void;
};

const controls: CrossDevicePlaybackRemoteControl[] = [];
const unsubscribes: (() => void)[] = [];
let nextCommandNumber = 1;

const createHarness = () => {
  const sends: PendingSend[] = [];
  const onMembershipRefusal = vi.fn();
  const control = createCrossDevicePlaybackRemoteControl({
    send: (body) =>
      new Promise<PlaybackCommandSendResponse>((resolve, reject) => {
        sends.push({ body, resolve, reject });
      }),
    now: () => Date.now(),
    parsePlaybackError: (error) =>
      error instanceof PlaybackRequestError ? error.playbackError : null,
    isMembershipRefusal: (error) => error instanceof MembershipRefusalError,
    onMembershipRefusal,
  });
  controls.push(control);
  unsubscribes.push(
    subscribeCrossDevicePlaybackView(() => {
      control.noteViewChanged();
    })
  );

  const sendAt = (index: number): PendingSend => {
    const pending = sends[index];
    if (pending === undefined) {
      throw new Error(`No send at index ${index}`);
    }
    return pending;
  };

  /** Answers a send as the server does and returns the command id it assigned. */
  const accept = (index: number): string => {
    const pending = sendAt(index);
    const commandIdText = `command-${nextCommandNumber}`;
    nextCommandNumber += 1;
    pending.resolve({
      command_id: commandIdText,
      target_session_id_text: pending.body.target_session_id_text ?? ACTIVE_SESSION,
      expires_at_ms: Date.now() + 5_000,
    });
    return commandIdText;
  };

  const reject = (index: number, error: unknown): void => {
    sendAt(index).reject(error);
  };

  return { accept, control, onMembershipRefusal, reject, sendAt, sends };
};

/** Starts a transfer to `TARGET_SESSION` and returns the command id the server assigned. */
const beginTransfer = async (harness: ReturnType<typeof createHarness>): Promise<string> => {
  const done = harness.control.transferTo(TARGET_SESSION);
  const commandIdText = harness.accept(harness.sends.length - 1);
  await done;
  return commandIdText;
};

const startFailed = (commandIdText: string, reason: PlaybackStartFailedReason) => ({
  command_id: commandIdText,
  sender_session_id_text: THIS_SESSION,
  target_session_id_text: TARGET_SESSION,
  reason,
});

describe('createCrossDevicePlaybackRemoteControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resetCrossDevicePlaybackStore();
    applyCrossDevicePlaybackPresence(presence(sharedState()), Date.now());
  });

  afterEach(() => {
    for (const unsubscribe of unsubscribes.splice(0)) {
      unsubscribe();
    }
    for (const control of controls.splice(0)) {
      control.dispose();
    }
    resetCrossDevicePlaybackStore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('sendSeek', () => {
    it('sends the first seek, then only the newest of the seeks made while it was in flight', async () => {
      const harness = createHarness();

      harness.control.sendSeek(10);
      harness.control.sendSeek(20);
      harness.control.sendSeek(30);
      harness.control.sendSeek(40);
      await flush();
      expect(harness.sends).toHaveLength(1);

      harness.accept(0);
      await flush();
      harness.accept(1);
      await flush();

      expect(harness.sends.map((send) => send.body)).toEqual([
        { command: { type: 'seek', position_seconds: 10 } },
        { command: { type: 'seek', position_seconds: 40 } },
      ]);
    });
  });

  describe('sendControl', () => {
    it('returns no_device for play with no active device and records no failure', async () => {
      const harness = createHarness();

      const outcome = harness.control.sendControl({ type: 'play' });
      harness.reject(0, new PlaybackRequestError(PLAYBACK_ERROR_CODES.noActiveDevice));

      expect(await outcome).toBe('no_device');
      expect(view().commandFailure).toBeNull();
    });

    it('records a failure for pause and for next with no active device', async () => {
      const harness = createHarness();

      const pauseOutcome = harness.control.sendControl({ type: 'pause' });
      harness.reject(0, new PlaybackRequestError(PLAYBACK_ERROR_CODES.noActiveDevice));
      expect(await pauseOutcome).toBe('no_device');
      expect(view().commandFailure).toEqual({ commandType: 'pause', atMs: Date.now() });

      const nextOutcome = harness.control.sendControl({ type: 'next' });
      harness.reject(1, new PlaybackRequestError(PLAYBACK_ERROR_CODES.deviceNotConnected));
      expect(await nextOutcome).toBe('no_device');
      expect(view().commandFailure).toEqual({ commandType: 'next', atMs: Date.now() });
    });

    it('returns failed and records a failure when the server is unavailable', async () => {
      const harness = createHarness();

      const outcome = harness.control.sendControl({ type: 'set_rate', rate: 1.5 });
      harness.reject(0, new PlaybackRequestError(PLAYBACK_ERROR_CODES.unavailable));

      expect(await outcome).toBe('failed');
      expect(view().commandFailure).toEqual({ commandType: 'set_rate', atMs: Date.now() });
    });

    it('reports a membership refusal and records no failure', async () => {
      const harness = createHarness();

      const outcome = harness.control.sendControl({ type: 'pause' });
      harness.reject(0, new MembershipRefusalError());

      expect(await outcome).toBe('refused');
      expect(harness.onMembershipRefusal).toHaveBeenCalledTimes(1);
      expect(view().commandFailure).toBeNull();
    });

    it('sends previous with no target', async () => {
      const harness = createHarness();

      const outcome = harness.control.sendControl({ type: 'previous' });
      expect(harness.sendAt(0).body).toEqual({ command: { type: 'previous' } });
      harness.accept(0);

      expect(await outcome).toBe('sent');
    });
  });

  describe('transferTo', () => {
    it('begins a transfer with the server command id and settles it when the target becomes active', async () => {
      const harness = createHarness();
      const startedAtMs = Date.now();

      const commandIdText = await beginTransfer(harness);

      expect(harness.sendAt(0).body).toEqual({
        target_session_id_text: TARGET_SESSION,
        command: { type: 'take_over' },
      });
      expect(view().transfer).toEqual({
        commandIdText,
        targetSessionIdText: TARGET_SESSION,
        startedAtMs,
      });

      applyCrossDevicePlaybackState(
        sharedState({ revision: 6, active_session_id_text: TARGET_SESSION }),
        Date.now()
      );
      expect(view().transfer).toBeNull();
      expect(view().transferFailure).toBeNull();

      await vi.advanceTimersByTimeAsync(PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS);
      expect(view().transferFailure).toBeNull();
    });

    it.each<PlaybackStartFailedReason>(['load_failed', 'autoplay_blocked'])(
      'records %s from a start_failed for the pending command',
      async (reason) => {
        const harness = createHarness();
        const commandIdText = await beginTransfer(harness);

        harness.control.noteStartFailed(startFailed(commandIdText, reason));

        expect(view().transfer).toBeNull();
        expect(view().transferFailure).toEqual({
          targetSessionIdText: TARGET_SESSION,
          reason,
          atMs: Date.now(),
        });
      }
    );

    it('ignores a start_failed for another command', async () => {
      const harness = createHarness();
      const commandIdText = await beginTransfer(harness);

      harness.control.noteStartFailed(startFailed('command-other', 'load_failed'));

      expect(view().transfer?.commandIdText).toBe(commandIdText);
      expect(view().transferFailure).toBeNull();
    });

    it('records a timeout when the target neither claims nor fails in time', async () => {
      const harness = createHarness();
      await beginTransfer(harness);

      await vi.advanceTimersByTimeAsync(PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS - 1);
      expect(view().transfer).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      expect(view().transfer).toBeNull();
      expect(view().transferFailure).toEqual({
        targetSessionIdText: TARGET_SESSION,
        reason: 'timeout',
        atMs: Date.now(),
      });
    });

    it('sends nothing for this session or for a target that is already pending', async () => {
      const harness = createHarness();

      await harness.control.transferTo(THIS_SESSION);
      expect(harness.sends).toHaveLength(0);

      await beginTransfer(harness);
      await harness.control.transferTo(TARGET_SESSION);
      expect(harness.sends).toHaveLength(1);
    });

    it('records nothing when the target is already active', async () => {
      const harness = createHarness();

      const done = harness.control.transferTo(TARGET_SESSION);
      harness.reject(0, new PlaybackRequestError(PLAYBACK_ERROR_CODES.targetAlreadyActive));
      await done;

      expect(view().transfer).toBeNull();
      expect(view().transferFailure).toBeNull();
    });

    it('records not_connected when the target is not connected', async () => {
      const harness = createHarness();

      const done = harness.control.transferTo(TARGET_SESSION);
      harness.reject(0, new PlaybackRequestError(PLAYBACK_ERROR_CODES.deviceNotConnected));
      await done;

      expect(view().transfer).toBeNull();
      expect(view().transferFailure).toEqual({
        targetSessionIdText: TARGET_SESSION,
        reason: 'not_connected',
        atMs: Date.now(),
      });
    });
  });
});
