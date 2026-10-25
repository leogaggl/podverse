/**
 * Runs the `playback.command` events the server sends to this phone while it is the active
 * device. Every command goes through the same local path a tap uses, so the events it writes
 * (now-playing, position, history) are written by the device whose audio plays.
 *
 * Commands run one at a time in arrival order. Each is dropped when it waited longer than
 * `PLAYBACK_COMMAND_TTL_MS` on this device's clock before it could run, and a repeated
 * `command_id` is ignored. Live items accept no `seek` or `set_rate`. `next` and `previous` are
 * never dropped or reported here: the Next and Previous tap handlers decide, including doing
 * nothing on a live item, exactly as a press on this phone would.
 *
 * A phone never reports `autoplay_blocked`: a native app starts audio when told. It reports
 * `load_failed` when a start path fails, or when the engine reports an error within
 * `PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS` of a commanded start.
 */
import type {
  DTOPlaybackCommandEnvelope,
  DTOPlaybackResourceRef,
  PlaybackCommandType,
  PlaybackStartFailedReason,
} from '@podverse/helpers/accountPlaybackStream';
import { PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS } from '@podverse/helpers/accountPlaybackStream';
import type { AddByRSSResourceData } from '@podverse/helpers/dto';

import {
  createSeenPlaybackCommandIds,
  isPlaybackCommandStale,
  resolvePlaybackTakeOverStart,
} from './crossDevicePlaybackPolicy';

export type LocalPlaybackStartResult = 'started' | 'failed';

/** The local paths an incoming command runs through. */
export type CrossDevicePlaybackCommandPort = {
  resume: () => Promise<void>;
  pause: () => void;
  /** Applies the end clamp for a commanded position; resolves once the seek is issued. */
  seekTo: (seconds: number) => Promise<void>;
  setRate: (rate: number) => void;
  /** The Next button's tap handler. */
  skipToNext: () => Promise<void>;
  /** The Previous button's tap handler. */
  skipToPrevious: () => Promise<void>;
  playResource: (params: {
    ref: DTOPlaybackResourceRef;
    addByRssResourceData: AddByRSSResourceData | null;
    /** Null plays from the saved position, or the live point. */
    startSeconds: number | null;
  }) => Promise<LocalPlaybackStartResult>;
  hasLoadedTarget: () => boolean;
  isLoadedTargetLive: () => boolean;
};

/**
 * Everything the cross-device hook reaches in the local player. The runner calls only the command
 * paths; the hook uses the rest to adopt the shared state when another device stops being active.
 */
export type CrossDevicePlaybackLocalPort = CrossDevicePlaybackCommandPort & {
  /** Load without playing or writing playback events. Rejects when the resource cannot load. */
  loadResourcePaused: (params: {
    ref: DTOPlaybackResourceRef;
    startSeconds: number | null;
  }) => Promise<void>;
  /** Move the loaded item's position without writing playback events. */
  adoptPosition: (seconds: number) => void;
  loadedRef: () => DTOPlaybackResourceRef | null;
};

export type CrossDevicePlaybackCommandRunnerDeps = {
  port: CrossDevicePlaybackCommandPort;
  reportStartFailed: (commandIdText: string, reason: PlaybackStartFailedReason) => Promise<void>;
  readThisSessionIdText: () => string | null;
  now: () => number;
};

export type CrossDevicePlaybackCommandRunner = {
  receive: (envelope: DTOPlaybackCommandEnvelope) => void;
  /** The local player reported an error. */
  notePlaybackError: () => void;
  dispose: () => void;
};

const SEEN_COMMAND_ID_LIMIT = 100;

type QueuedPlaybackCommand = {
  envelope: DTOPlaybackCommandEnvelope;
  receivedAtMs: number;
};

type WatchedPlaybackStart = {
  commandIdText: string;
  untilMs: number;
};

const isStartCommandType = (type: PlaybackCommandType): boolean =>
  type === 'play_item' || type === 'take_over';

export function createCrossDevicePlaybackCommandRunner(
  deps: CrossDevicePlaybackCommandRunnerDeps
): CrossDevicePlaybackCommandRunner {
  const seenCommandIds = createSeenPlaybackCommandIds(SEEN_COMMAND_ID_LIMIT);
  const queue: QueuedPlaybackCommand[] = [];
  let draining = false;
  let disposed = false;
  let watched: WatchedPlaybackStart | null = null;

  const reportLoadFailed = (commandIdText: string): void => {
    if (disposed) {
      return;
    }
    deps.reportStartFailed(commandIdText, 'load_failed').catch((error: unknown) => {
      console.warn('[cross-device] start-failed report failed', error);
    });
  };

  const watch = (commandIdText: string): void => {
    watched = { commandIdText, untilMs: deps.now() + PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS };
  };

  const startResource = async (
    commandIdText: string,
    params: Parameters<CrossDevicePlaybackCommandPort['playResource']>[0]
  ): Promise<void> => {
    // This load replaces whatever an earlier start was watching.
    watched = null;
    const result = await deps.port.playResource(params);
    if (disposed) {
      return;
    }
    if (result === 'failed') {
      reportLoadFailed(commandIdText);
      return;
    }
    watch(commandIdText);
  };

  const dispatch = async ({ envelope, receivedAtMs }: QueuedPlaybackCommand): Promise<void> => {
    const { command } = envelope;
    const { port } = deps;
    switch (command.type) {
      case 'play':
        if (!port.hasLoadedTarget()) {
          return;
        }
        await port.resume();
        if (!disposed) {
          watch(envelope.command_id);
        }
        return;
      case 'pause':
        port.pause();
        return;
      case 'seek':
        if (!port.hasLoadedTarget() || port.isLoadedTargetLive()) {
          return;
        }
        await port.seekTo(Math.max(0, command.position_seconds));
        return;
      case 'set_rate':
        if (!port.hasLoadedTarget() || port.isLoadedTargetLive()) {
          return;
        }
        port.setRate(command.rate);
        return;
      case 'next':
        await port.skipToNext();
        return;
      case 'previous':
        await port.skipToPrevious();
        return;
      case 'play_item':
        await startResource(envelope.command_id, {
          ref: command.resource,
          addByRssResourceData: command.add_by_rss_resource_data,
          startSeconds: command.start_seconds,
        });
        return;
      case 'take_over': {
        const start =
          envelope.state === null
            ? null
            : resolvePlaybackTakeOverStart({
                state: envelope.state,
                receivedAtMs,
                nowMs: deps.now(),
              });
        if (start === null) {
          reportLoadFailed(envelope.command_id);
          return;
        }
        await startResource(envelope.command_id, {
          ref: start.ref,
          addByRssResourceData: null,
          startSeconds: start.startSeconds,
        });
        return;
      }
      default: {
        const unexpected: never = command;
        return unexpected;
      }
    }
  };

  const runCommand = async (entry: QueuedPlaybackCommand): Promise<void> => {
    try {
      await dispatch(entry);
    } catch (error) {
      const { command, command_id: commandIdText } = entry.envelope;
      console.warn('[cross-device] playback command failed', { type: command.type, error });
      if (isStartCommandType(command.type)) {
        reportLoadFailed(commandIdText);
      }
    }
  };

  const drain = async (): Promise<void> => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (!disposed) {
        const next = queue.shift();
        if (next === undefined) {
          break;
        }
        if (isPlaybackCommandStale({ receivedAtMs: next.receivedAtMs, nowMs: deps.now() })) {
          continue;
        }
        await runCommand(next);
      }
    } finally {
      draining = false;
    }
  };

  const receive = (envelope: DTOPlaybackCommandEnvelope): void => {
    if (disposed) {
      return;
    }
    if (envelope.target_session_id_text !== deps.readThisSessionIdText()) {
      return;
    }
    if (seenCommandIds.has(envelope.command_id)) {
      return;
    }
    seenCommandIds.add(envelope.command_id);
    queue.push({ envelope, receivedAtMs: deps.now() });
    void drain();
  };

  const notePlaybackError = (): void => {
    if (disposed || watched === null) {
      return;
    }
    const current = watched;
    watched = null;
    if (deps.now() < current.untilMs) {
      reportLoadFailed(current.commandIdText);
    }
  };

  const dispose = (): void => {
    disposed = true;
    queue.length = 0;
    watched = null;
  };

  return { receive, notePlaybackError, dispose };
}
