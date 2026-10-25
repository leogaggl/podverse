import { describe, expect, it } from 'vitest';

import type { AddByRSSListContextState, AddByRSSListSortOrder } from '../addByRSSListWalk.js';
import {
  buildAddByRSSListContext,
  orderAddByRSSEpisodeIdTexts,
  resolveAddByRSSAdjacentStep,
  selectAddByRSSAdjacentIdTexts,
} from '../addByRSSListWalk.js';

const newestFirst = ['newest', 'newer', 'older', 'oldest'];
const oldestFirst = ['oldest', 'older', 'newer', 'newest'];

function listContext(
  itemIdTexts: string[],
  currentIndex: number,
  sortOrder?: AddByRSSListSortOrder
): AddByRSSListContextState {
  return {
    feedIdText: 'feed-1',
    itemIdTexts,
    currentIndex,
    ...(sortOrder === undefined ? {} : { sortOrder }),
  };
}

describe('orderAddByRSSEpisodeIdTexts', () => {
  const episodes = [
    { idText: 'mid', pubDateMs: 20 },
    { idText: 'newest', pubDateMs: 30 },
    { idText: 'oldest', pubDateMs: 10 },
  ];

  it('sorts newest first for recent and oldest first for oldest without mutating the input', () => {
    const before = episodes.map((episode) => episode.idText);

    expect(orderAddByRSSEpisodeIdTexts(episodes, 'recent')).toEqual(['newest', 'mid', 'oldest']);
    expect(orderAddByRSSEpisodeIdTexts(episodes, 'oldest')).toEqual(['oldest', 'mid', 'newest']);
    expect(episodes.map((episode) => episode.idText)).toEqual(before);
  });
});

describe('buildAddByRSSListContext', () => {
  it('returns null for an empty list and for a current id that is not in the list', () => {
    expect(
      buildAddByRSSListContext({
        feedIdText: 'feed-1',
        orderedIdTexts: [],
        currentIdText: 'mid',
        sortOrder: 'recent',
      })
    ).toBeNull();
    expect(
      buildAddByRSSListContext({
        feedIdText: 'feed-1',
        orderedIdTexts: newestFirst,
        currentIdText: 'missing',
        sortOrder: 'oldest',
      })
    ).toBeNull();
  });

  it('copies the ordered ids and records the current index', () => {
    const orderedIdTexts = ['newest', 'mid', 'oldest'];
    const context = buildAddByRSSListContext({
      feedIdText: 'feed-1',
      orderedIdTexts,
      currentIdText: 'mid',
      sortOrder: 'recent',
    });

    expect(context).toEqual({
      feedIdText: 'feed-1',
      itemIdTexts: ['newest', 'mid', 'oldest'],
      currentIndex: 1,
      sortOrder: 'recent',
    });
    if (context === null) {
      return;
    }
    context.itemIdTexts.push('extra');
    expect(orderedIdTexts).toEqual(['newest', 'mid', 'oldest']);
  });
});

describe('resolveAddByRSSAdjacentStep', () => {
  it('steps to the newer neighbor on next and the older neighbor on previous', () => {
    const recent = listContext(newestFirst, 2, 'recent');
    const oldest = listContext(oldestFirst, 1, 'oldest');

    expect(resolveAddByRSSAdjacentStep(recent, 'next')).toEqual({
      kind: 'step',
      idText: 'newer',
      nextContext: listContext(newestFirst, 1, 'recent'),
    });
    expect(resolveAddByRSSAdjacentStep(recent, 'previous')).toEqual({
      kind: 'step',
      idText: 'oldest',
      nextContext: null,
    });
    expect(resolveAddByRSSAdjacentStep(oldest, 'next')).toEqual({
      kind: 'step',
      idText: 'newer',
      nextContext: listContext(oldestFirst, 2, 'oldest'),
    });
    expect(resolveAddByRSSAdjacentStep(oldest, 'previous')).toEqual({
      kind: 'step',
      idText: 'oldest',
      nextContext: null,
    });
  });

  it('returns a null next context when the step lands on the end of that direction', () => {
    expect(resolveAddByRSSAdjacentStep(listContext(newestFirst, 1, 'recent'), 'next')).toEqual({
      kind: 'step',
      idText: 'newest',
      nextContext: null,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(oldestFirst, 2, 'oldest'), 'next')).toEqual({
      kind: 'step',
      idText: 'newest',
      nextContext: null,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(oldestFirst, 1, 'oldest'), 'previous')).toEqual({
      kind: 'step',
      idText: 'oldest',
      nextContext: null,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(newestFirst, 2, 'recent'), 'previous')).toEqual({
      kind: 'step',
      idText: 'oldest',
      nextContext: null,
    });
  });

  it('clears the context only when next steps past the newest end', () => {
    expect(resolveAddByRSSAdjacentStep(listContext(newestFirst, 0, 'recent'), 'next')).toEqual({
      kind: 'none',
      clearContext: true,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(oldestFirst, 3, 'oldest'), 'next')).toEqual({
      kind: 'none',
      clearContext: true,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(newestFirst, 3, 'recent'), 'previous')).toEqual({
      kind: 'none',
      clearContext: false,
    });
    expect(resolveAddByRSSAdjacentStep(listContext(oldestFirst, 0, 'oldest'), 'previous')).toEqual({
      kind: 'none',
      clearContext: false,
    });
  });

  it('treats a missing sort order as recent and does not clear a null or empty context', () => {
    expect(resolveAddByRSSAdjacentStep(listContext(newestFirst, 2), 'next')).toEqual({
      kind: 'step',
      idText: 'newer',
      nextContext: listContext(newestFirst, 1, 'recent'),
    });
    expect(resolveAddByRSSAdjacentStep(null, 'next')).toEqual({
      kind: 'none',
      clearContext: false,
    });
    expect(resolveAddByRSSAdjacentStep(null, 'previous')).toEqual({
      kind: 'none',
      clearContext: false,
    });
    expect(resolveAddByRSSAdjacentStep(listContext([], 0, 'recent'), 'next')).toEqual({
      kind: 'none',
      clearContext: false,
    });
  });

  it('does not step onto a missing or empty id', () => {
    const withGap = listContext(['newest', '', 'older', 'oldest'], 2, 'recent');

    expect(resolveAddByRSSAdjacentStep(withGap, 'next')).toEqual({
      kind: 'none',
      clearContext: false,
    });
  });
});

describe('selectAddByRSSAdjacentIdTexts', () => {
  it('returns up to limit ids ahead and stops at the list end', () => {
    const recent = listContext(newestFirst, 3, 'recent');

    expect(selectAddByRSSAdjacentIdTexts(recent, 'next', 1)).toEqual(['older']);
    expect(selectAddByRSSAdjacentIdTexts(recent, 'next', 10)).toEqual(['older', 'newer', 'newest']);
    expect(
      selectAddByRSSAdjacentIdTexts(listContext(oldestFirst, 1, 'oldest'), 'previous', 10)
    ).toEqual(['oldest']);
  });

  it('stops at the first empty id and returns nothing for a null context or a non-positive limit', () => {
    const withGap = listContext(['newest', '', 'newer', 'oldest'], 3, 'recent');

    expect(selectAddByRSSAdjacentIdTexts(withGap, 'next', 10)).toEqual(['newer']);
    expect(selectAddByRSSAdjacentIdTexts(null, 'next', 3)).toEqual([]);
    expect(selectAddByRSSAdjacentIdTexts(listContext(newestFirst, 2, 'recent'), 'next', 0)).toEqual(
      []
    );
    expect(
      selectAddByRSSAdjacentIdTexts(listContext(newestFirst, 2, 'recent'), 'previous', -1)
    ).toEqual([]);
  });
});
