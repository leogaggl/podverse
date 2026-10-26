import { describe, expect, it } from 'vitest';

import { formatCountBadgeFace } from './countBadgeFace';

describe('formatCountBadgeFace', () => {
  it('shows the full count when max is omitted', () => {
    expect(formatCountBadgeFace(1)).toBe('1');
    expect(formatCountBadgeFace(99)).toBe('99');
    expect(formatCountBadgeFace(100)).toBe('100');
    expect(formatCountBadgeFace(142)).toBe('142');
  });

  it('caps a count above max and leaves the max itself uncapped', () => {
    expect(formatCountBadgeFace(99, 99)).toBe('99');
    expect(formatCountBadgeFace(100, 99)).toBe('99+');
    expect(formatCountBadgeFace(142, 99)).toBe('99+');
  });
});
