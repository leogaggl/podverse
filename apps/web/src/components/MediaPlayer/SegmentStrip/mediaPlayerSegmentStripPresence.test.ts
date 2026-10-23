import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getMediaPlayerSegmentStripVisible,
  setMediaPlayerSegmentStripVisible,
  subscribeMediaPlayerSegmentStrip,
} from './mediaPlayerSegmentStripPresence';

const touchedIds = new Set<string>();

const setVisible = (instanceId: string, visible: boolean): void => {
  touchedIds.add(instanceId);
  setMediaPlayerSegmentStripVisible(instanceId, visible);
};

afterEach(() => {
  for (const instanceId of touchedIds) {
    setMediaPlayerSegmentStripVisible(instanceId, false);
  }
  touchedIds.clear();
});

describe('media player segment strip presence', () => {
  it('stays visible without notifying when one of two instances hides, then notifies once when the last one hides', () => {
    setVisible('desktop', true);
    setVisible('mobile', true);
    const listener = vi.fn();
    const unsubscribe = subscribeMediaPlayerSegmentStrip(listener);

    try {
      setVisible('desktop', false);

      expect(getMediaPlayerSegmentStripVisible()).toBe(true);
      expect(listener).not.toHaveBeenCalled();

      setVisible('mobile', false);

      expect(getMediaPlayerSegmentStripVisible()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('does not notify when an instance is set to the state it already has', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMediaPlayerSegmentStrip(listener);

    try {
      setVisible('bar', true);
      setVisible('bar', true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getMediaPlayerSegmentStripVisible()).toBe(true);

      setVisible('bar', false);
      setVisible('bar', false);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(getMediaPlayerSegmentStripVisible()).toBe(false);
    } finally {
      unsubscribe();
    }
  });
});
