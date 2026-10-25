/**
 * Pure Add by RSS list walk shared by web and mobile.
 *
 * A list context is one feed's item ids in list order, plus the index of the item playing.
 * Next steps to the newer neighbor and Previous to the older one, for either sort.
 * Callers look up items, order livestream ids, and apply `nextContext` only after that item loads.
 * A failed lookup leaves the context unchanged. `clearContext` means set the context to null.
 */

export type AddByRSSListSortOrder = 'recent' | 'oldest';

export type AddByRSSListContextState = {
  feedIdText: string;
  itemIdTexts: string[];
  currentIndex: number;
  /** 'recent' = newest first (index 0 is newest); 'oldest' = oldest first. Absent means 'recent'. */
  sortOrder?: AddByRSSListSortOrder;
};

export type AddByRSSListEpisode = {
  idText: string;
  pubDateMs: number;
};

export type AddByRSSAdjacentDirection = 'next' | 'previous';

export type AddByRSSAdjacentStep =
  | { kind: 'none'; clearContext: boolean }
  | { kind: 'step'; idText: string; nextContext: AddByRSSListContextState | null };

function resolvedSortOrder(sortOrder: AddByRSSListSortOrder | undefined): AddByRSSListSortOrder {
  return sortOrder === 'oldest' ? 'oldest' : 'recent';
}

/** Next moves toward the newer end; Previous moves toward the older end. */
function adjacentIndexDelta(
  sortOrder: AddByRSSListSortOrder | undefined,
  direction: AddByRSSAdjacentDirection
): number {
  const oldestFirst = resolvedSortOrder(sortOrder) === 'oldest';
  if (direction === 'next') {
    return oldestFirst ? 1 : -1;
  }
  return oldestFirst ? -1 : 1;
}

function isNewestEnd(
  sortOrder: AddByRSSListSortOrder | undefined,
  index: number,
  lastIndex: number
): boolean {
  return resolvedSortOrder(sortOrder) === 'oldest' ? index === lastIndex : index === 0;
}

function isOldestEnd(
  sortOrder: AddByRSSListSortOrder | undefined,
  index: number,
  lastIndex: number
): boolean {
  return resolvedSortOrder(sortOrder) === 'oldest' ? index === 0 : index === lastIndex;
}

function readIdTextAt(itemIdTexts: readonly string[], index: number): string | null {
  const idText = itemIdTexts[index];
  if (typeof idText !== 'string' || idText === '') {
    return null;
  }
  return idText;
}

export function orderAddByRSSEpisodeIdTexts(
  episodes: readonly AddByRSSListEpisode[],
  sortOrder: AddByRSSListSortOrder
): string[] {
  const ordered = [...episodes];
  ordered.sort((left, right) =>
    sortOrder === 'recent' ? right.pubDateMs - left.pubDateMs : left.pubDateMs - right.pubDateMs
  );
  return ordered.map((episode) => episode.idText);
}

export function buildAddByRSSListContext(params: {
  feedIdText: string;
  orderedIdTexts: readonly string[];
  currentIdText: string;
  sortOrder: AddByRSSListSortOrder;
}): AddByRSSListContextState | null {
  if (params.orderedIdTexts.length === 0) {
    return null;
  }
  const currentIndex = params.orderedIdTexts.indexOf(params.currentIdText);
  if (currentIndex < 0) {
    return null;
  }
  return {
    feedIdText: params.feedIdText,
    itemIdTexts: [...params.orderedIdTexts],
    currentIndex,
    sortOrder: params.sortOrder,
  };
}

export function resolveAddByRSSAdjacentStep(
  context: AddByRSSListContextState | null,
  direction: AddByRSSAdjacentDirection
): AddByRSSAdjacentStep {
  if (context === null || context.itemIdTexts.length === 0) {
    return { kind: 'none', clearContext: false };
  }

  const targetIndex = context.currentIndex + adjacentIndexDelta(context.sortOrder, direction);
  if (targetIndex < 0 || targetIndex >= context.itemIdTexts.length) {
    return { kind: 'none', clearContext: direction === 'next' };
  }

  const idText = readIdTextAt(context.itemIdTexts, targetIndex);
  if (idText === null) {
    return { kind: 'none', clearContext: false };
  }

  const lastIndex = context.itemIdTexts.length - 1;
  const atEnd =
    direction === 'next'
      ? isNewestEnd(context.sortOrder, targetIndex, lastIndex)
      : isOldestEnd(context.sortOrder, targetIndex, lastIndex);

  return {
    kind: 'step',
    idText,
    nextContext: atEnd
      ? null
      : {
          ...context,
          currentIndex: targetIndex,
          sortOrder: resolvedSortOrder(context.sortOrder),
        },
  };
}

export function selectAddByRSSAdjacentIdTexts(
  context: AddByRSSListContextState | null,
  direction: AddByRSSAdjacentDirection,
  limit: number
): string[] {
  if (context === null || limit <= 0) {
    return [];
  }

  const delta = adjacentIndexDelta(context.sortOrder, direction);
  const idTexts: string[] = [];
  let index = context.currentIndex;
  while (idTexts.length < limit) {
    index += delta;
    if (index < 0 || index >= context.itemIdTexts.length) {
      break;
    }
    const idText = readIdTextAt(context.itemIdTexts, index);
    if (idText === null) {
      break;
    }
    idTexts.push(idText);
  }
  return idTexts;
}
