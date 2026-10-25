/**
 * Sends this phone's controls to the account's active device while another device plays, and keeps
 * the bookkeeping for moving playback to another device.
 *
 * A control names no target: the server delivers it to whichever device is active. At most one
 * `seek` is in flight; a newer seek during it replaces the waiting one, and only the newest goes
 * out when the first settles. A control that cannot reach the active device records a command
 * failure for the player to show, except `play` and `play_item` with no active device, which the
 * caller plays on this phone instead.
 *
 * A transfer (`take_over` to another device) is pending until that device becomes active, a
 * `playback.start_failed` for its command arrives, or `PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS`
 * passes; the last two record a failure. This phone keeps playing until the target claims.
 * Moving playback to this phone is a local start, never a command.
 */
import type {
  DTOPlaybackCommand,
  DTOPlaybackStartFailed,
  PlaybackCommandSendBody,
  PlaybackCommandSendResponse,
  PlaybackCommandType,
} from '@podverse/helpers/accountPlaybackStream';
import {
  PLAYBACK_ERROR_CODES,
  PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS,
} from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackApiError } from '@podverse/helpers-requests';

import type { CrossDevicePlaybackTransferFailureReason } from './crossDevicePlaybackStore';
import {
  beginCrossDevicePlaybackTransfer,
  getCrossDevicePlaybackView,
  recordCrossDevicePlaybackCommandFailure,
  recordCrossDevicePlaybackTransferFailure,
  settleCrossDevicePlaybackTransfer,
} from './crossDevicePlaybackStore';

/**
 * - `sent`: the server accepted it for the active device.
 * - `no_device`: no device is active, or the active one is not connected.
 * - `failed`: any other failure.
 * - `refused`: the account's membership does not allow cross-device playback.
 */
export type RemoteControlOutcome = 'sent' | 'no_device' | 'failed' | 'refused';

export type CrossDevicePlaybackRemoteControlDeps = {
  send: (body: PlaybackCommandSendBody) => Promise<PlaybackCommandSendResponse>;
  now: () => number;
  parsePlaybackError: (error: unknown) => PlaybackApiError | null;
  isMembershipRefusal: (error: unknown) => boolean;
  onMembershipRefusal: () => void;
};

export type CrossDevicePlaybackRemoteControl = {
  sendControl: (command: DTOPlaybackCommand) => Promise<RemoteControlOutcome>;
  sendSeek: (positionSeconds: number) => void;
  transferTo: (targetSessionIdText: string) => Promise<void>;
  noteStartFailed: (event: DTOPlaybackStartFailed) => void;
  /** Call after every store change: settles a transfer once the target is active. */
  noteViewChanged: () => void;
  dispose: () => void;
};

/** With no active device the caller plays these on this phone, so they record no failure. */
const PLAYS_HERE_WITHOUT_ACTIVE_DEVICE: readonly PlaybackCommandType[] = ['play', 'play_item'];

type PendingTransfer = {
  commandIdText: string;
  targetSessionIdText: string;
  timer: ReturnType<typeof setTimeout>;
};

export function createCrossDevicePlaybackRemoteControl(
  deps: CrossDevicePlaybackRemoteControlDeps
): CrossDevicePlaybackRemoteControl {
  let disposed = false;
  let seekInFlight = false;
  let waitingSeekSeconds: number | null = null;
  /** A take-over send not answered yet; another press for the same target sends nothing. */
  let sendingTransferTargetIdText: string | null = null;
  let pendingTransfer: PendingTransfer | null = null;

  const sendControl = async (command: DTOPlaybackCommand): Promise<RemoteControlOutcome> => {
    try {
      await deps.send({ command });
      return 'sent';
    } catch (error) {
      const code = deps.parsePlaybackError(error)?.code;
      if (
        code === PLAYBACK_ERROR_CODES.noActiveDevice ||
        code === PLAYBACK_ERROR_CODES.deviceNotConnected
      ) {
        if (!PLAYS_HERE_WITHOUT_ACTIVE_DEVICE.includes(command.type)) {
          recordCrossDevicePlaybackCommandFailure({ commandType: command.type, atMs: deps.now() });
        }
        return 'no_device';
      }
      if (deps.isMembershipRefusal(error)) {
        deps.onMembershipRefusal();
        return 'refused';
      }
      console.warn('[cross-device] playback command send failed', { type: command.type, error });
      recordCrossDevicePlaybackCommandFailure({ commandType: command.type, atMs: deps.now() });
      return 'failed';
    }
  };

  const drainSeeks = async (firstSeconds: number): Promise<void> => {
    seekInFlight = true;
    try {
      let nextSeconds: number | null = firstSeconds;
      while (nextSeconds !== null && !disposed) {
        await sendControl({ type: 'seek', position_seconds: nextSeconds });
        nextSeconds = waitingSeekSeconds;
        waitingSeekSeconds = null;
      }
    } finally {
      seekInFlight = false;
    }
  };

  const sendSeek = (positionSeconds: number): void => {
    if (disposed || !Number.isFinite(positionSeconds)) {
      return;
    }
    const seconds = Math.max(0, positionSeconds);
    if (seekInFlight) {
      waitingSeekSeconds = seconds;
      return;
    }
    void drainSeeks(seconds);
  };

  const clearPendingTransfer = (): PendingTransfer | null => {
    const current = pendingTransfer;
    if (current !== null) {
      clearTimeout(current.timer);
      pendingTransfer = null;
    }
    return current;
  };

  const settlePendingTransfer = (
    failureReason: CrossDevicePlaybackTransferFailureReason | null
  ): void => {
    const current = clearPendingTransfer();
    if (current === null) {
      return;
    }
    settleCrossDevicePlaybackTransfer({
      commandIdText: current.commandIdText,
      failure:
        failureReason === null
          ? null
          : {
              targetSessionIdText: current.targetSessionIdText,
              reason: failureReason,
              atMs: deps.now(),
            },
    });
  };

  const noteViewChanged = (): void => {
    const current = pendingTransfer;
    if (current === null) {
      return;
    }
    const view = getCrossDevicePlaybackView();
    // The store no longer holds this transfer (sign-out reset); there is nothing left to settle.
    if (view.transfer?.commandIdText !== current.commandIdText) {
      clearPendingTransfer();
      return;
    }
    if (view.activeSessionIdText === current.targetSessionIdText) {
      settlePendingTransfer(null);
    }
  };

  const recordTransferSendFailure = (targetSessionIdText: string, error: unknown): void => {
    const code = deps.parsePlaybackError(error)?.code;
    if (code === PLAYBACK_ERROR_CODES.targetAlreadyActive) {
      return;
    }
    if (deps.isMembershipRefusal(error)) {
      deps.onMembershipRefusal();
      return;
    }
    let reason: CrossDevicePlaybackTransferFailureReason = 'not_connected';
    if (code !== PLAYBACK_ERROR_CODES.deviceNotConnected) {
      console.warn('[cross-device] take-over send failed', error);
      reason = 'send_failed';
    }
    recordCrossDevicePlaybackTransferFailure({ targetSessionIdText, reason, atMs: deps.now() });
  };

  const transferTo = async (targetSessionIdText: string): Promise<void> => {
    if (disposed) {
      return;
    }
    const view = getCrossDevicePlaybackView();
    if (
      targetSessionIdText === view.thisSessionIdText ||
      targetSessionIdText === sendingTransferTargetIdText ||
      targetSessionIdText === view.transfer?.targetSessionIdText
    ) {
      return;
    }
    sendingTransferTargetIdText = targetSessionIdText;
    let response: PlaybackCommandSendResponse;
    try {
      response = await deps.send({
        target_session_id_text: targetSessionIdText,
        command: { type: 'take_over' },
      });
    } catch (error) {
      if (!disposed) {
        recordTransferSendFailure(targetSessionIdText, error);
      }
      return;
    } finally {
      if (sendingTransferTargetIdText === targetSessionIdText) {
        sendingTransferTargetIdText = null;
      }
    }
    if (disposed) {
      return;
    }
    clearPendingTransfer();
    const commandIdText = response.command_id;
    pendingTransfer = {
      commandIdText,
      targetSessionIdText,
      timer: setTimeout(() => {
        if (pendingTransfer?.commandIdText === commandIdText) {
          settlePendingTransfer('timeout');
        }
      }, PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS),
    };
    beginCrossDevicePlaybackTransfer({
      commandIdText,
      targetSessionIdText,
      startedAtMs: deps.now(),
    });
    // The target can claim before this response arrives.
    noteViewChanged();
  };

  const noteStartFailed = (event: DTOPlaybackStartFailed): void => {
    if (pendingTransfer?.commandIdText !== event.command_id) {
      return;
    }
    settlePendingTransfer(event.reason);
  };

  const dispose = (): void => {
    disposed = true;
    waitingSeekSeconds = null;
    clearPendingTransfer();
  };

  return { sendControl, sendSeek, transferTo, noteStartFailed, noteViewChanged, dispose };
}
