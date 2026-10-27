export type VideoOrientationLock = 'portrait' | 'landscape' | 'free';

/**
 * After fullscreen forces landscape, free rotation waits until the phone itself is sideways.
 * Releasing the lock while the phone is still upright snaps Android back to portrait.
 * Once free, later samples stay free until fullscreen ends.
 */
export function videoOrientationLockAfterSample(input: {
  alreadyFree: boolean;
  deviceLandscape: boolean;
  landscapeLockApplied: boolean;
}): VideoOrientationLock {
  if (input.alreadyFree) {
    return 'free';
  }
  if (input.landscapeLockApplied && input.deviceLandscape) {
    return 'free';
  }
  return 'landscape';
}
