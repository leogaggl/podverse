'use client';

import { useEffect } from 'react';

import { useAccount } from '../contexts/Account';
import { runAddByRSSBackgroundRefresh } from '../utils/addByRSS/backgroundRefresh';

/** Refreshes Add by RSS feeds on load and whenever the tab comes back into view. Renders nothing. */
export function AddByRSSBackgroundRefresh(): null {
  const { loggedInAccount } = useAccount();

  useEffect(() => {
    if (!loggedInAccount) {
      return undefined;
    }
    const run = () => {
      void runAddByRSSBackgroundRefresh(loggedInAccount);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        run();
      }
    };

    run();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loggedInAccount]);

  return null;
}
