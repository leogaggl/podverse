/**
 * The phone's side of the commanded-start end clamp (`clampCommandStartToFileEnd`). A position
 * another device sent can land at or past the end of the file this phone loaded. Neither engine
 * knows the file's length until the item is prepared, and both apply the start at that same
 * moment, so a commanded start arms a guard instead of clamping up front. The first progress
 * sample that carries the engine duration decides whether to seek back before the end, and an
 * `ended` that beats that sample restarts there instead of advancing.
 *
 * Only this phone's own engine duration decides. Never the shared `duration_seconds` or the feed's
 * duration hint: dynamic ad insertion can give the same enclosure a different length per device.
 */
import { clampCommandStartToFileEnd } from '@podverse/playback-core/clampNearEndSeconds';

export type CommandedStartGuard = {
  requestedSeconds: number;
  /** Set once the correcting seek was issued. */
  clampedSeconds: number | null;
  clampIssuedAtMs: number | null;
};

/** A sample this close to the correcting seek shows the seek landed. */
export const COMMANDED_START_LANDED_TOLERANCE_SECONDS = 2;
/** The guard drops this long after the correcting seek, landed or not. */
export const COMMANDED_START_SETTLE_MS = 5_000;

export function createCommandedStartGuard(requestedSeconds: number): CommandedStartGuard {
  return { requestedSeconds, clampedSeconds: null, clampIssuedAtMs: null };
}

export type CommandedStartProgressAction =
  | { kind: 'keep'; guard: CommandedStartGuard }
  | { kind: 'seek'; seconds: number; guard: CommandedStartGuard }
  | { kind: 'clear' };

const isKnownDuration = (durationSeconds: number): boolean =>
  Number.isFinite(durationSeconds) && durationSeconds > 0;

/**
 * One progress sample from the item the guard was armed for. Keeps waiting until the sample
 * carries a duration, then clears when the request is inside the file, or asks for one seek to
 * the clamped position and waits for it to land (or settle) before clearing.
 */
export function resolveCommandedStartOnProgress(params: {
  guard: CommandedStartGuard;
  positionSeconds: number;
  durationSeconds: number;
  nowMs: number;
}): CommandedStartProgressAction {
  const { guard } = params;
  if (!isKnownDuration(params.durationSeconds)) {
    return { kind: 'keep', guard };
  }

  if (guard.clampedSeconds === null) {
    const clampedSeconds = clampCommandStartToFileEnd({
      seconds: guard.requestedSeconds,
      fileDurationSeconds: params.durationSeconds,
    });
    if (clampedSeconds === guard.requestedSeconds) {
      return { kind: 'clear' };
    }
    return {
      kind: 'seek',
      seconds: clampedSeconds,
      guard: { ...guard, clampedSeconds, clampIssuedAtMs: params.nowMs },
    };
  }

  const landed =
    Math.abs(params.positionSeconds - guard.clampedSeconds) <=
    COMMANDED_START_LANDED_TOLERANCE_SECONDS;
  const settled =
    guard.clampIssuedAtMs !== null &&
    params.nowMs - guard.clampIssuedAtMs > COMMANDED_START_SETTLE_MS;
  if (landed || settled) {
    return { kind: 'clear' };
  }
  return { kind: 'keep', guard };
}

/**
 * The engine ended while the guard was armed: the commanded start reached the end before a sample
 * could correct it. With the engine duration known, restart before the end; with it still 0, the
 * item advances as usual.
 */
export function resolveCommandedStartOnEnded(params: {
  guard: CommandedStartGuard;
  durationSeconds: number;
}): { kind: 'restart_before_end'; seconds: number } | { kind: 'advance' } {
  if (!isKnownDuration(params.durationSeconds)) {
    return { kind: 'advance' };
  }
  return {
    kind: 'restart_before_end',
    seconds: clampCommandStartToFileEnd({
      seconds: params.durationSeconds,
      fileDurationSeconds: params.durationSeconds,
    }),
  };
}
