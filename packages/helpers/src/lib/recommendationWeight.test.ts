import { describe, expect, it } from 'vitest';

import {
  recommendationStrength,
  recommendationWeightFromListenCount,
} from './recommendationWeight.js';

describe('recommendationWeightFromListenCount', () => {
  it('steps up one level every five listens and caps at 5', () => {
    expect(recommendationWeightFromListenCount(0, null)).toBe(1);
    expect(recommendationWeightFromListenCount(4, null)).toBe(1);
    expect(recommendationWeightFromListenCount(5, null)).toBe(2);
    expect(recommendationWeightFromListenCount(9, null)).toBe(2);
    expect(recommendationWeightFromListenCount(10, null)).toBe(3);
    expect(recommendationWeightFromListenCount(14, null)).toBe(3);
    expect(recommendationWeightFromListenCount(15, null)).toBe(4);
    expect(recommendationWeightFromListenCount(19, null)).toBe(4);
    expect(recommendationWeightFromListenCount(20, null)).toBe(5);
    expect(recommendationWeightFromListenCount(100, null)).toBe(5);
  });

  it('keeps an applied override in place of the listen level', () => {
    expect(recommendationWeightFromListenCount(100, 1)).toBe(1);
    expect(recommendationWeightFromListenCount(0, 5)).toBe(5);
  });
});

describe('recommendationStrength', () => {
  it('marks the top score 5 and scales the rest down to a floor of 1', () => {
    expect(recommendationStrength(10, 10)).toBe(5);
    expect(recommendationStrength(5, 10)).toBe(3);
    expect(recommendationStrength(1, 10)).toBe(1);
    expect(recommendationStrength(0, 10)).toBe(1);
    expect(recommendationStrength(4, 0)).toBe(1);
  });
});
