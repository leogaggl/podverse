import { useSyncExternalStore } from 'react';

/**
 * Whether a segment strip is showing above the player bar. The strip's title follows the
 * playhead, but this only changes when a segment appears or clears, so the page spacer and the
 * floating video read it without re-rendering on every tick. Desktop and mobile web each mount a
 * strip, so the store tracks instances and is visible while any one of them is.
 */
type Listener = () => void;

const visibleInstanceIds = new Set<string>();
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach((listener) => {
    listener();
  });
};

export const getMediaPlayerSegmentStripVisible = (): boolean => visibleInstanceIds.size > 0;

export const subscribeMediaPlayerSegmentStrip = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setMediaPlayerSegmentStripVisible = (instanceId: string, visible: boolean): void => {
  const wasVisible = getMediaPlayerSegmentStripVisible();
  if (visible) {
    visibleInstanceIds.add(instanceId);
  } else {
    visibleInstanceIds.delete(instanceId);
  }
  if (getMediaPlayerSegmentStripVisible() !== wasVisible) {
    emit();
  }
};

const getServerSnapshot = (): boolean => false;

export function useMediaPlayerSegmentStripVisible(): boolean {
  return useSyncExternalStore(
    subscribeMediaPlayerSegmentStrip,
    getMediaPlayerSegmentStripVisible,
    getServerSnapshot
  );
}
