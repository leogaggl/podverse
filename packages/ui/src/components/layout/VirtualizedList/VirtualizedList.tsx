'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';

import { resolveTranscriptScrollAlign } from '@podverse/helpers/transcript';

export type VirtualizedListProps<T> = {
  items: T[];
  height: number;
  renderItem: (item: T, index: number) => ReactNode;
  highlightedIndex?: number;
  autoScrollOn?: boolean;
};

export function VirtualizedList<T>({
  items,
  height,
  renderItem,
  highlightedIndex,
  autoScrollOn,
}: VirtualizedListProps<T>) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const visibleRangeRef = useRef<{ startIndex: number; endIndex: number } | null>(null);

  const safeItems = items ?? [];
  const itemCount = safeItems.length;

  const isValidIndex =
    itemCount > 0 &&
    highlightedIndex !== undefined &&
    highlightedIndex >= 0 &&
    highlightedIndex < itemCount;

  useEffect(() => {
    if (!autoScrollOn || !virtuosoRef.current || !isValidIndex) {
      return;
    }
    if (highlightedIndex === undefined) {
      return;
    }

    const visible = visibleRangeRef.current;
    if (visible !== null) {
      const align = resolveTranscriptScrollAlign({
        activeIndex: highlightedIndex,
        visibleEndIndex: visible.endIndex,
        visibleStartIndex: visible.startIndex,
      });
      if (align === null) {
        return;
      }
      virtuosoRef.current.scrollToIndex({
        index: highlightedIndex,
        align,
        behavior: 'smooth',
      });
      return;
    }

    virtuosoRef.current.scrollToIndex({
      index: highlightedIndex,
      align: 'start',
      behavior: 'smooth',
    });
  }, [highlightedIndex, autoScrollOn, isValidIndex]);

  if (itemCount === 0) {
    return <div style={{ height }} />;
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height }}
      totalCount={itemCount}
      rangeChanged={(range) => {
        visibleRangeRef.current = {
          endIndex: range.endIndex,
          startIndex: range.startIndex,
        };
      }}
      itemContent={(index: number) => {
        const item = safeItems[index];
        return item ? renderItem(item, index) : null;
      }}
    />
  );
}
