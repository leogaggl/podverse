/**
 * A seek writes the new position before the engine has moved. Until a sample lands within this
 * distance of the requested position, native progress and reconcile reads still describe the
 * pre-seek playhead and are ignored, so the title, chapter art, and clock do not snap back.
 */
export const SEEK_HOLD_TOLERANCE_SECONDS = 1.5;

/** Release the hold if the engine never reports a position near the seek. */
export const SEEK_HOLD_MAX_MS = 1500;

export function isSeekHoldSampleLanded(params: {
  positionSeconds: number;
  seekSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  if (!Number.isFinite(params.positionSeconds)) {
    return false;
  }
  const tolerance = params.toleranceSeconds ?? SEEK_HOLD_TOLERANCE_SECONDS;
  return Math.abs(params.positionSeconds - params.seekSeconds) <= tolerance;
}
