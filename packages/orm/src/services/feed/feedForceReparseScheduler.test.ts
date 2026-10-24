import { describe, expect, it, vi } from 'vitest';

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceRead: { getRepository: () => ({}) },
  AppDataSourceReadWrite: { getRepository: () => ({}) },
}));

import {
  buildFeedForceReparseDedupeKey,
  FEED_FORCE_REPARSE_JOB_TYPE,
  parseFeedForceReparsePayload,
} from './feedForceReparseScheduler.js';

describe('parseFeedForceReparsePayload', () => {
  it('accepts a positive integer feed id and a known reason', () => {
    expect(parseFeedForceReparsePayload({ feedId: 42, reason: 'description_tier_change' })).toEqual(
      { feedId: 42, reason: 'description_tier_change' }
    );
    expect(parseFeedForceReparsePayload({ feedId: 7, reason: 'description_tier_change' })).toEqual({
      feedId: 7,
      reason: 'description_tier_change',
    });
  });

  it('rejects a missing, string, or non-positive feed id', () => {
    expect(parseFeedForceReparsePayload({ reason: 'description_tier_change' })).toBeNull();
    expect(
      parseFeedForceReparsePayload({ feedId: '42', reason: 'description_tier_change' })
    ).toBeNull();
    expect(
      parseFeedForceReparsePayload({ feedId: 0, reason: 'description_tier_change' })
    ).toBeNull();
    expect(
      parseFeedForceReparsePayload({ feedId: 1.5, reason: 'description_tier_change' })
    ).toBeNull();
    expect(parseFeedForceReparsePayload(null)).toBeNull();
  });

  it('rejects an unknown reason', () => {
    expect(parseFeedForceReparsePayload({ feedId: 42, reason: 'other' })).toBeNull();
    expect(parseFeedForceReparsePayload({ feedId: 42 })).toBeNull();
  });
});

describe('buildFeedForceReparseDedupeKey', () => {
  it('keys one job per feed', () => {
    expect(buildFeedForceReparseDedupeKey(42)).toBe(`${FEED_FORCE_REPARSE_JOB_TYPE}:42`);
  });
});
