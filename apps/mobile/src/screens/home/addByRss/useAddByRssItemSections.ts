import { useCallback, useEffect, useRef, useState } from 'react';

import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { useAuth } from '../../../auth/AuthProvider';
import { segmentsRepository } from '../../../data/repositories';
import type { AddByRssItemSections } from '../../../lib/addByRss/itemSections';

/**
 * Chapters and transcript for the Add by RSS item on screen, fetched once per visit the first time
 * `enabled` turns true. Errors stay until `retry`; a new item clears both.
 */
export function useAddByRssItemSections(input: {
  enabled: boolean;
  feedUrl: string | null;
  itemBundle: AddByRSSMappedFeed['items'][number] | null;
  itemIdText: string | null;
}): {
  errorKey: 'errors.generic' | null;
  retry: () => void;
  sections: AddByRssItemSections | null;
} {
  const { enabled, feedUrl, itemBundle, itemIdText } = input;
  const { accessToken, clearSession, refreshToken, setTokens } = useAuth();
  const [sections, setSections] = useState<AddByRssItemSections | null>(null);
  const [errorKey, setErrorKey] = useState<'errors.generic' | null>(null);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    setSections(null);
    setErrorKey(null);
  }, [itemIdText]);

  useEffect(() => {
    if (
      !enabled ||
      sections !== null ||
      errorKey !== null ||
      inFlightRef.current ||
      feedUrl === null ||
      itemBundle === null ||
      itemIdText === null
    ) {
      return;
    }

    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    void (async () => {
      try {
        const next = await segmentsRepository.getAddByRssChaptersAndTranscript(
          { accessToken, clearSession, refreshToken, setTokens },
          { feedUrl, itemBundle, itemIdText }
        );
        if (requestId === requestIdRef.current) {
          setSections(next);
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setErrorKey('errors.generic');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
        }
      }
    })();
  }, [
    accessToken,
    clearSession,
    enabled,
    errorKey,
    feedUrl,
    itemBundle,
    itemIdText,
    refreshToken,
    sections,
    setTokens,
  ]);

  const retry = useCallback(() => {
    setErrorKey(null);
  }, []);

  return { errorKey, retry, sections };
}
