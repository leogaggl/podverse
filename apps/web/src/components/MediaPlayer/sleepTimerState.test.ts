import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getSleepTimerMinutes,
  setSleepTimerMinutes,
  sleepTimerDelayMs,
  subscribeSleepTimer,
} from './sleepTimerState';

afterEach(() => {
  setSleepTimerMinutes(null);
});

describe('sleepTimer', () => {
  it('notifies subscribers when the duration changes and ignores the same value', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSleepTimer(listener);

    setSleepTimerMinutes(15);
    expect(getSleepTimerMinutes()).toBe(15);
    expect(listener).toHaveBeenCalledTimes(1);

    setSleepTimerMinutes(15);
    expect(listener).toHaveBeenCalledTimes(1);

    setSleepTimerMinutes(null);
    expect(getSleepTimerMinutes()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setSleepTimerMinutes(30);
    expect(listener).toHaveBeenCalledTimes(2);
    setSleepTimerMinutes(null);
  });

  it('waits the chosen number of minutes', () => {
    expect(sleepTimerDelayMs(15)).toBe(15 * 60 * 1000);
    expect(sleepTimerDelayMs(30)).toBe(30 * 60 * 1000);
    expect(sleepTimerDelayMs(60)).toBe(60 * 60 * 1000);
  });
});
