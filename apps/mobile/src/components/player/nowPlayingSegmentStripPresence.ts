import { useSyncExternalStore } from 'react';

/**
 * Whether the now-playing segment strip is on screen.
 *
 * The strip's label follows the playhead, but its height only changes when a segment appears or
 * clears. The tab scaffold reads this store for the overlap margin. It does not subscribe to the
 * playhead, which would re-render the tab tree on every tick.
 */

type Listener = () => void;

let segmentStripVisible = false;
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach((listener) => {
    listener();
  });
};

export const getNowPlayingSegmentStripVisible = (): boolean => segmentStripVisible;

export const subscribeNowPlayingSegmentStrip = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setNowPlayingSegmentStripVisible = (visible: boolean): void => {
  if (visible === segmentStripVisible) {
    return;
  }
  segmentStripVisible = visible;
  emit();
};

export function useNowPlayingSegmentStripVisible(): boolean {
  return useSyncExternalStore(
    subscribeNowPlayingSegmentStrip,
    getNowPlayingSegmentStripVisible,
    getNowPlayingSegmentStripVisible
  );
}
