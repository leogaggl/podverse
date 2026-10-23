import { describe, expect, it } from 'vitest';

import type { SimulatedDailyCounts } from './simulatedPopularityStats.js';
import {
  assignSimulatedStatsCohort,
  buildSimulatedChannelDailyCounts,
  buildSimulatedItemDailyCounts,
  SIMULATED_STATS_WINDOW_DAYS,
  simulatedCompletionCount,
} from './simulatedPopularityStats.js';

function allTimeTotal(counts: SimulatedDailyCounts): number {
  return counts.window.reduce((total, value) => total + value, 0) + counts.history;
}

function expectNonNegativeIntegers(counts: SimulatedDailyCounts): void {
  expect(counts.window).toHaveLength(SIMULATED_STATS_WINDOW_DAYS);
  for (const value of [...counts.window, counts.history]) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
}

describe('simulated popularity stats', () => {
  it('assigns staggered cohorts across a ranked set', () => {
    const cohorts = Array.from({ length: 20 }, (_, rank) =>
      assignSimulatedStatsCohort(rank, 20, 100 + rank)
    );

    expect(new Set(cohorts).size).toBeGreaterThan(1);
    expect(cohorts[0]).toBe('headliner');
    expect(cohorts[19]).toBe('tail');
  });

  it('is deterministic for the same inputs', () => {
    const channelInput = { entityId: 42, rank: 2, total: 10 };
    const channel = buildSimulatedChannelDailyCounts(channelInput);
    expect(channel).toEqual(buildSimulatedChannelDailyCounts(channelInput));

    const itemInput = {
      channelCounts: channel,
      entityId: 900,
      itemCount: 8,
      itemIndex: 1,
    };
    expect(buildSimulatedItemDailyCounts(itemInput)).toEqual(
      buildSimulatedItemDailyCounts(itemInput)
    );
  });

  it('builds a 31-day window and a channel all-time total of at least 1', () => {
    for (let rank = 0; rank < 12; rank += 1) {
      const channel = buildSimulatedChannelDailyCounts({ entityId: 7 + rank, rank, total: 12 });
      expectNonNegativeIntegers(channel);
      expect(allTimeTotal(channel)).toBeGreaterThanOrEqual(1);

      const item = buildSimulatedItemDailyCounts({
        channelCounts: channel,
        entityId: 700 + rank,
        itemCount: 4,
        itemIndex: rank % 4,
      });
      expectNonNegativeIntegers(item);
    }
  });

  it('keeps item daily totals at or below the channel', () => {
    const channel = buildSimulatedChannelDailyCounts({ entityId: 9, rank: 0, total: 4 });
    for (let itemIndex = 0; itemIndex < 8; itemIndex += 1) {
      const item = buildSimulatedItemDailyCounts({
        channelCounts: channel,
        entityId: 900 + itemIndex,
        itemCount: 8,
        itemIndex,
      });

      item.window.forEach((value, day) => {
        expect(value).toBeLessThanOrEqual(channel.window[day] ?? 0);
      });
      expect(item.history).toBeLessThanOrEqual(channel.history);
    }
  });

  it('gives the top-ranked tenth a higher mean all-time total than the bottom half', () => {
    const total = 200;
    const totals = Array.from({ length: total }, (_, rank) =>
      allTimeTotal(buildSimulatedChannelDailyCounts({ entityId: 1000 + rank, rank, total }))
    );
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const topTenth = totals.slice(0, total / 10);
    const bottomHalf = totals.slice(total / 2);

    expect(mean(topTenth)).toBeGreaterThan(mean(bottomHalf));
  });

  it('keeps completion counts between 30% and the listener total', () => {
    expect(simulatedCompletionCount(0, 4, 1)).toBe(0);
    for (const listenerCount of [1, 2, 3, 10, 40, 100]) {
      for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
        const completion = simulatedCompletionCount(listenerCount, 17, dayOffset);
        expect(completion).toBeGreaterThanOrEqual(Math.round(0.3 * listenerCount));
        expect(completion).toBeLessThanOrEqual(listenerCount);
        expect(Number.isInteger(completion)).toBe(true);
      }
    }
  });
});
