import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRemotePlaybackWholeSeconds, subscribeRemotePlaybackClock } from './remotePlaybackClock';

const clockStore = vi.hoisted(() => {
  const state: {
    estimate: number | null;
    status: 'playing' | 'paused' | 'loading';
    isLive: boolean;
    listeners: Set<() => void>;
    getEstimatedPositionSeconds: ReturnType<typeof vi.fn<() => number | null>>;
  } = {
    estimate: null,
    status: 'paused',
    isLive: false,
    listeners: new Set(),
    getEstimatedPositionSeconds: vi.fn((): number | null => null),
  };
  state.getEstimatedPositionSeconds.mockImplementation(() => state.estimate);
  return state;
});

vi.mock('./crossDevicePlaybackStore', () => ({
  crossDevicePlaybackStore: {
    getEstimatedPositionSeconds: () => clockStore.getEstimatedPositionSeconds(),
    getSnapshot: () => ({
      displayState: {
        status: clockStore.status,
        is_live: clockStore.isLive,
      },
    }),
    subscribe(listener: () => void) {
      clockStore.listeners.add(listener);
      return () => {
        clockStore.listeners.delete(listener);
      };
    },
  },
}));

const subscriptions: Array<() => void> = [];

function watch(listener: () => void = vi.fn()): () => void {
  const unsubscribe = subscribeRemotePlaybackClock(listener);
  subscriptions.push(unsubscribe);
  return unsubscribe;
}

function emitPlaybackStore(): void {
  for (const listener of [...clockStore.listeners]) {
    listener();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  clockStore.estimate = null;
  clockStore.status = 'paused';
  clockStore.isLive = false;
  clockStore.getEstimatedPositionSeconds.mockClear();
});

afterEach(() => {
  for (const unsubscribe of subscriptions) {
    unsubscribe();
  }
  subscriptions.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('remotePlaybackClock', () => {
  it('notifies when the estimate crosses a whole second and not within it', () => {
    clockStore.status = 'playing';
    clockStore.estimate = 10.2;
    const listener = vi.fn();
    watch(listener);
    listener.mockClear();

    clockStore.estimate = 10.9;
    expect(getRemotePlaybackWholeSeconds()).toBe(10);
    vi.advanceTimersByTime(250);
    expect(listener).not.toHaveBeenCalled();

    clockStore.estimate = 11.1;
    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRemotePlaybackWholeSeconds()).toBe(11);
  });

  it('does not poll the estimate while playback is paused', () => {
    clockStore.status = 'paused';
    clockStore.estimate = 10.2;
    watch();
    clockStore.getEstimatedPositionSeconds.mockClear();

    clockStore.estimate = 11.4;
    vi.advanceTimersByTime(1_000);
    expect(clockStore.getEstimatedPositionSeconds).not.toHaveBeenCalled();
  });

  it('does not poll while a live item is playing', () => {
    clockStore.status = 'playing';
    clockStore.isLive = true;
    clockStore.estimate = 3.2;
    watch();
    clockStore.getEstimatedPositionSeconds.mockClear();

    vi.advanceTimersByTime(1_000);
    expect(clockStore.getEstimatedPositionSeconds).not.toHaveBeenCalled();
  });

  it('starts the interval when playback starts and stops it when playback pauses', () => {
    clockStore.status = 'paused';
    clockStore.estimate = 4.2;
    const listener = vi.fn();
    watch(listener);
    listener.mockClear();

    clockStore.status = 'playing';
    emitPlaybackStore();
    listener.mockClear();
    clockStore.getEstimatedPositionSeconds.mockClear();

    clockStore.estimate = 5.1;
    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    clockStore.status = 'paused';
    emitPlaybackStore();
    clockStore.getEstimatedPositionSeconds.mockClear();
    clockStore.estimate = 9.8;
    vi.advanceTimersByTime(1_000);
    expect(clockStore.getEstimatedPositionSeconds).not.toHaveBeenCalled();
  });

  it('clears the interval and the store subscription when the last listener unsubscribes', () => {
    clockStore.status = 'playing';
    clockStore.estimate = 1.2;
    const unsubscribeFirst = watch();
    const unsubscribeSecond = watch();
    expect(clockStore.listeners.size).toBe(1);

    unsubscribeFirst();
    expect(clockStore.listeners.size).toBe(1);

    clockStore.getEstimatedPositionSeconds.mockClear();
    unsubscribeSecond();
    expect(clockStore.listeners.size).toBe(0);

    clockStore.estimate = 8.4;
    vi.advanceTimersByTime(1_000);
    expect(clockStore.getEstimatedPositionSeconds).not.toHaveBeenCalled();
  });

  it('reads the estimate directly when nobody is subscribed', () => {
    expect(clockStore.listeners.size).toBe(0);
    clockStore.estimate = 10.2;
    expect(getRemotePlaybackWholeSeconds()).toBe(10);
    clockStore.estimate = 10.9;
    expect(getRemotePlaybackWholeSeconds()).toBe(10);
    clockStore.estimate = null;
    expect(getRemotePlaybackWholeSeconds()).toBeNull();
  });
});
