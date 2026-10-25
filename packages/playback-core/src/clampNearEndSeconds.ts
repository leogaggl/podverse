/**
 * Single home for the "treat positions within 5 seconds of `duration`
 * as 0" rule, also known as the **5-second near-end clamp**.
 *
 * Mirrors the existing inline rule in
 * `apps/web/src/hooks/useMediaPlayerResourceUpdate.tsx`
 * (`getAbridgedAndSet`):
 *
 * ```
 * if (duration > 0 && currentTime >= duration - 5) {
 *   currentTime = 0;
 * }
 * ```
 *
 * Both inputs are expected to already be finite non-negative seconds
 * (see `parsePlaybackSeconds`). When `durationSeconds` is `0` or
 * negative, the clamp never applies — the caller's `currentSeconds`
 * passes through unchanged.
 */
export function clampNearEndSeconds({
  currentSeconds,
  durationSeconds,
}: {
  currentSeconds: number;
  durationSeconds: number;
}): number {
  if (durationSeconds > 0 && currentSeconds >= durationSeconds - 5) {
    return 0;
  }
  return currentSeconds;
}

/** Clamp a playback position before persisting to storage or the server. */
export function clampPlaybackPositionForStorage(
  positionSeconds: number,
  durationSeconds: number | undefined
): number {
  if (durationSeconds !== undefined && durationSeconds > 0) {
    return clampNearEndSeconds({ currentSeconds: positionSeconds, durationSeconds });
  }
  return positionSeconds;
}

/** Seconds a commanded start backs off from the end of this device's file. */
export const COMMAND_START_FILE_END_BACKOFF_SECONDS = 5;

/**
 * Where a position sent by another device starts in the file this device loaded.
 *
 * Below the file's duration the position is kept. At or past it, playback starts
 * `COMMAND_START_FILE_END_BACKOFF_SECONDS` before the end (never below 0), so the item plays its
 * last seconds instead of ending at once. With no known duration (`undefined`, `null`, not finite,
 * or not positive) the position is kept. Negative or non-finite positions start at 0.
 */
export function clampCommandStartToFileEnd({
  seconds,
  fileDurationSeconds,
}: {
  seconds: number;
  fileDurationSeconds: number | null | undefined;
}): number {
  const start = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  if (
    fileDurationSeconds === null ||
    fileDurationSeconds === undefined ||
    !Number.isFinite(fileDurationSeconds) ||
    fileDurationSeconds <= 0
  ) {
    return start;
  }
  if (start >= fileDurationSeconds) {
    return Math.max(0, fileDurationSeconds - COMMAND_START_FILE_END_BACKOFF_SECONDS);
  }
  return start;
}
