'use client';

import { useCallback } from 'react';

import { resolveAddByRSSAdjacentStep } from '@podverse/playback-core';

import type { AddByRSSListContextState } from '../contexts/AddByRSSListContext';
import { useAddByRSSListContext } from '../contexts/AddByRSSListContext';
import { getAddByRSSItemByIdText, getAddByRSSLivestreamByIdText } from '../utils/addByRSS/storage';
import { usePlayAddByRSS } from './usePlayAddByRSS';

/**
 * Returns a function to try playing the next add-by-RSS item from list context (for autoplay when current ends).
 * Next is the newer neighbor. Loads that item from IndexedDB and plays it, then advances or clears context.
 * When list context is empty, caller may pass a fallback context (e.g. resolved from IndexedDB by current item).
 * Returns true if playback was started, false otherwise.
 */
export function useAddByRSSPlayNext() {
  const { listContext, setAddByRSSListContext } = useAddByRSSListContext();
  const playAddByRSS = usePlayAddByRSS();

  return useCallback(
    async (fallbackContext?: AddByRSSListContextState | null): Promise<boolean> => {
      const effectiveContext = listContext ?? fallbackContext ?? null;
      const step = resolveAddByRSSAdjacentStep(effectiveContext, 'next');
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
