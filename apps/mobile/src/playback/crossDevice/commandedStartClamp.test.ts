import { describe, expect, it } from 'vitest';

import type { CommandedStartGuard } from './commandedStartClamp';
import {
  createCommandedStartGuard,
  resolveCommandedStartOnEnded,
  resolveCommandedStartOnProgress,
} from './commandedStartClamp';

const SEEK_ISSUED_AT_MS = 50_000;

const guardAfterCorrectingSeek = (): CommandedStartGuard => {
  const action = resolveCommandedStartOnProgress({
    guard: createCommandedStartGuard(3700),
    positionSeconds: 3600,
    durationSeconds: 3600,
    nowMs: SEEK_ISSUED_AT_MS,
  });
  if (action.kind !== 'seek') {
    throw new Error(`expected a correcting seek, got ${action.kind}`);
  }
  return action.guard;
};

describe('resolveCommandedStartOnProgress', () => {
  it('keeps the guard while the engine reports no duration yet', () => {
    const guard = createCommandedStartGuard(3700);

    const action = resolveCommandedStartOnProgress({
      guard,
      positionSeconds: 0,
      durationSeconds: 0,
      nowMs: 1_000,
    });

    expect(action).toEqual({ kind: 'keep', guard });
  });

  it('clears the guard when the requested start is inside the file', () => {
    const action = resolveCommandedStartOnProgress({
      guard: createCommandedStartGuard(120),
      positionSeconds: 120,
      durationSeconds: 3600,
      nowMs: 1_000,
    });

    expect(action).toEqual({ kind: 'clear' });
  });

  it('seeks to 5 seconds before the end when the requested start is past the file end', () => {
    const action = resolveCommandedStartOnProgress({
      guard: createCommandedStartGuard(3700),
      positionSeconds: 3600,
      durationSeconds: 3600,
      nowMs: SEEK_ISSUED_AT_MS,
    });

    expect(action).toEqual({
      kind: 'seek',
      seconds: 3595,
      guard: { requestedSeconds: 3700, clampedSeconds: 3595, clampIssuedAtMs: SEEK_ISSUED_AT_MS },
    });
  });

  it('clears the guard once a sample lands near the correcting seek', () => {
    const action = resolveCommandedStartOnProgress({
      guard: guardAfterCorrectingSeek(),
      positionSeconds: 3596,
      durationSeconds: 3600,
      nowMs: SEEK_ISSUED_AT_MS + 1_000,
    });

    expect(action).toEqual({ kind: 'clear' });
  });

  it('keeps the guard while samples are still far from the correcting seek', () => {
    const guard = guardAfterCorrectingSeek();

    const action = resolveCommandedStartOnProgress({
      guard,
      positionSeconds: 3700,
      durationSeconds: 3600,
      nowMs: SEEK_ISSUED_AT_MS + 1_000,
    });

    expect(action).toEqual({ kind: 'keep', guard });
  });

  it('clears the guard 5001 ms after the correcting seek even when no sample landed', () => {
    const action = resolveCommandedStartOnProgress({
      guard: guardAfterCorrectingSeek(),
      positionSeconds: 3700,
      durationSeconds: 3600,
      nowMs: SEEK_ISSUED_AT_MS + 5_001,
    });

    expect(action).toEqual({ kind: 'clear' });
  });
});

describe('resolveCommandedStartOnEnded', () => {
  it('restarts 5 seconds before the end when the engine knows the duration', () => {
    expect(
      resolveCommandedStartOnEnded({
        guard: createCommandedStartGuard(3700),
        durationSeconds: 3600,
      })
    ).toEqual({ kind: 'restart_before_end', seconds: 3595 });
  });

  it('advances as usual when the engine still reports no duration', () => {
    expect(
      resolveCommandedStartOnEnded({
        guard: createCommandedStartGuard(3700),
        durationSeconds: 0,
      })
    ).toEqual({ kind: 'advance' });
  });
});
