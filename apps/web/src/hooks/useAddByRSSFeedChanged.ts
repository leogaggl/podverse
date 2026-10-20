'use client';

import { useEffect, useRef } from 'react';

import {
  onAddByRSSFeedChanged,
  toAddByRSSFeedChangedUrl,
} from '../utils/addByRSS/feedChangedEvent';

/** Runs `handler` whenever this browser's stored copy of `feedUrl` changes. Null listens to nothing. */
export function useAddByRSSFeedChanged(
  feedUrl: string | null,
  handler: (feedUrl: string) => void
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (feedUrl === null) {
      return undefined;
    }
    const watched = toAddByRSSFeedChangedUrl(feedUrl);
    return onAddByRSSFeedChanged((changed) => {
      if (changed === watched) {
        handlerRef.current(changed);
      }
    });
  }, [feedUrl]);
}
