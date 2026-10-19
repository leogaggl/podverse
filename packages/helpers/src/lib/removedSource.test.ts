import { describe, expect, it } from 'vitest';

import { isRemovedSource } from './removedSource.js';

describe('isRemovedSource', () => {
  it('is true only for a non-empty source_removed_at string', () => {
    expect(isRemovedSource({ source_removed_at: '2020-01-02T03:04:05.000Z' })).toBe(true);
    expect(isRemovedSource({})).toBe(false);
    expect(isRemovedSource({ source_removed_at: null })).toBe(false);
    expect(isRemovedSource({ source_removed_at: '' })).toBe(false);
  });
});
