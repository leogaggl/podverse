import { describe, expect, it } from 'vitest';

import { isSeekHoldSampleLanded, SEEK_HOLD_TOLERANCE_SECONDS } from './seekPositionHold';

describe('isSeekHoldSampleLanded', () => {
  it('keeps holding while a sample still reports the pre-seek playhead', () => {
    expect(isSeekHoldSampleLanded({ positionSeconds: 312, seekSeconds: 1200 })).toBe(false);
    expect(isSeekHoldSampleLanded({ positionSeconds: 1500, seekSeconds: 1200 })).toBe(false);
  });

  it('releases once a sample lands near the seek, on either side', () => {
    expect(isSeekHoldSampleLanded({ positionSeconds: 1200.4, seekSeconds: 1200 })).toBe(true);
    expect(
      isSeekHoldSampleLanded({
        positionSeconds: 1200 - SEEK_HOLD_TOLERANCE_SECONDS,
        seekSeconds: 1200,
      })
    ).toBe(true);
  });

  it('treats a non-finite sample as not landed', () => {
    expect(isSeekHoldSampleLanded({ positionSeconds: Number.NaN, seekSeconds: 0 })).toBe(false);
  });
});
