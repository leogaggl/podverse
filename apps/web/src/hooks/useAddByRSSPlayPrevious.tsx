'use client';

import { useCallback } from 'react';

import { resolveAddByRSSAdjacentStep } from '@podverse/playback-core';

import type { AddByRSSListContextState } from '../contexts/AddByRSSListContext';
import { useAddByRSSListContext } from '../contexts/AddByRSSListContext';
import { getAddByRSSItemByIdText, getAddByRSSLivestreamByIdText } from '../utils/addByRSS/storage';
import { usePlayAddByRSS } from './usePlayAddByRSS';

/**
 * Returns a function to try playing the previous add-by-RSS item from list context.
 * Previous = chronologically older (one step back in oldest-to-newest order).
 * When list context is empty, caller may pass a fallback context (e.g. resolved from IndexedDB).
 * Returns true if playback was started, false otherwise (caller should seek to 0 when false).
 */
export function useAddByRSSPlayPrevious() {
  const { listContext, setAddByRSSListContext } = useAddByRSSListContext();
  const playAddByRSS = usePlayAddByRSS();

  return useCallback(
    async (fallbackContext?: AddByRSSListContextState | null): Promise<boolean> => {
      const effectiveContext = listContext ?? fallbackContext ?? null;
      const step = resolveAddByRSSAdjacentStep(effectiveContext, 'previous');
      if (step.kind === 'none') {
        if (step.clearContext) {
          setAddByRSSListContext(null);
        }
        return false;
      }
      const item = await getAddByRSSItemByIdText(step.idText);
      const indexItem = item ?? (await getAddByRSSLivestreamByIdText(step.idText));
      if (!indexItem) {
        return false;
      }
      await playAddByRSS(indexItem);
      setAddByRSSListContext(step.nextContext);
      return true;
    },
    [listContext, setAddByRSSListContext, playAddByRSS]
  );
}
