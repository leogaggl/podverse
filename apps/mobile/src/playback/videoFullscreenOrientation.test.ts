import { describe, expect, it } from 'vitest';

import { videoOrientationLockAfterSample } from './videoFullscreenOrientation';

describe('videoOrientationLockAfterSample', () => {
  it('keeps landscape until the phone is sideways', () => {
    expect(
      videoOrientationLockAfterSample({
        alreadyFree: false,
        deviceLandscape: false,
        landscapeLockApplied: true,
      })
    ).toBe('landscape');
  });

  it('frees rotation once the landscape lock is on and the phone is sideways', () => {
    expect(
      videoOrientationLockAfterSample({
        alreadyFree: false,
        deviceLandscape: true,
        landscapeLockApplied: true,
      })
    ).toBe('free');
  });

  it('does not free rotation before the landscape lock is applied', () => {
    expect(
      videoOrientationLockAfterSample({
        alreadyFree: false,
        deviceLandscape: true,
        landscapeLockApplied: false,
      })
    ).toBe('landscape');
  });

  it('stays free after the first sideways sample', () => {
    expect(
      videoOrientationLockAfterSample({
        alreadyFree: true,
        deviceLandscape: false,
        landscapeLockApplied: true,
      })
    ).toBe('free');
  });
});
