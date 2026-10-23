'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiRequestService } from '../factories/apiRequestService';

const POLL_INTERVAL_MS = 60_000;
const READ_EVENT_NAME = 'podverse:notifications-read';

type UseNotificationsUnreadCountOptions = {
  enabled: boolean;
  /** True while the notification stream is open; the poll runs only when false. */
  streamOpen: boolean;
};

export function emitNotificationsReadEvent() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(READ_EVENT_NAME));
}

export function useNotificationsUnreadCount({
  enabled,
  streamOpen,
}: UseNotificationsUnreadCountOptions): {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
} {
  const [unreadCount, setUnreadCountState] = useState(0);
  // A stream update bumps this so a fetch that started earlier cannot overwrite it.
  const countVersionRef = useRef(0);

  const setUnreadCount = useCallback((count: number) => {
    countVersionRef.current += 1;
    setUnreadCountState(count);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    const version = countVersionRef.current;
    try {
      const data = await getApiRequestService().reqNotificationsUnreadCount();
      if (countVersionRef.current !== version) {
        return;
      }
      setUnreadCountState(data.unread_count);
    } catch {
      if (countVersionRef.current !== version) {
        return;
      }
      setUnreadCountState(0);
    }
  }, [enabled, setUnreadCount]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadCount();
      }
    };
    const handleRead = () => {
      void refreshUnreadCount();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(READ_EVENT_NAME, handleRead);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(READ_EVENT_NAME, handleRead);
    };
  }, [enabled, refreshUnreadCount, setUnreadCount]);

  useEffect(() => {
    if (!enabled || streamOpen) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, streamOpen, refreshUnreadCount]);

  return { unreadCount, setUnreadCount };
}
