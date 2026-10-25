import { crossDevicePlaybackStore } from './crossDevicePlaybackStore';

/** How often a playing item's estimated position is sampled, in milliseconds. */
const REMOTE_POSITION_TICK_MS = 250;

const listeners = new Set<() => void>();
let cached: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let unsubscribeStore: (() => void) | null = null;

function read(): number | null {
  const positionSeconds = crossDevicePlaybackStore.getEstimatedPositionSeconds();
  if (positionSeconds === null) {
    return null;
  }
  return Math.floor(positionSeconds);
}

function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function clearTick(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** A live item has no estimated position, so the tab does not sample it. */
function isPlayingNonLive(): boolean {
  const displayState = crossDevicePlaybackStore.getSnapshot().displayState;
  if (displayState === null) {
    return false;
  }
  return displayState.status === 'playing' && !displayState.is_live;
}

function sync(): void {
  const next = read();
  if (next !== cached) {
    cached = next;
    notify();
  }
  if (listeners.size === 0) {
    clearTick();
    return;
  }
  if (isPlayingNonLive()) {
    if (intervalId === null) {
      intervalId = setInterval(sync, REMOTE_POSITION_TICK_MS);
    }
    return;
  }
  clearTick();
}

/** Whole seconds of the playing device's estimated position; null when unknown or live. */
export function getRemotePlaybackWholeSeconds(): number | null {
  if (listeners.size === 0) {
    return read();
  }
  return cached;
}

/**
 * Notifies when the whole-second estimate changes. While anyone listens and the shared status
 * is `playing` (and the item is not live), one 250 ms interval runs for the whole tab.
 */
export function subscribeRemotePlaybackClock(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    unsubscribeStore = crossDevicePlaybackStore.subscribe(sync);
    sync();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size !== 0) {
      return;
    }
    clearTick();
    if (unsubscribeStore !== null) {
      unsubscribeStore();
      unsubscribeStore = null;
    }
  };
}
