'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useMediaPlayerControls } from '../../contexts/MediaPlayerControls';
import {
  getSleepTimerMinutes,
  setSleepTimerMinutes,
  sleepTimerDelayMs,
  subscribeSleepTimer,
} from './sleepTimerState';

/**
 * Pauses the active player once when the sleep timer elapses. One instance owns the timeout so
 * the desktop and narrow player menus cannot each schedule a pause.
 */
export function SleepTimer() {
  const minutes = useSyncExternalStore(
    subscribeSleepTimer,
    getSleepTimerMinutes,
    getSleepTimerMinutes
  );
  const { pause } = useMediaPlayerControls();
  const pauseRef = useRef(pause);
  pauseRef.current = pause;

  useEffect(() => {
    if (minutes === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      pauseRef.current();
      setSleepTimerMinutes(null);
    }, sleepTimerDelayMs(minutes));
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [minutes]);

  return null;
}
