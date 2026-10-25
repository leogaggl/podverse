import { describe, expect, it } from 'vitest';

import { shouldThisTabHandleTakeOver } from './takeOverTabChoice';

describe('shouldThisTabHandleTakeOver', () => {
  it('lets the last focused tab handle it and not the stream leader', () => {
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-a', lastFocusedTabId: 'tab-a', isStreamLeader: false },
        tabChannelAvailable: true,
        isVisible: false,
      })
    ).toBe(true);
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-b', lastFocusedTabId: 'tab-a', isStreamLeader: true },
        tabChannelAvailable: true,
        isVisible: true,
      })
    ).toBe(false);
  });

  it('lets the stream leader handle it when no tab is recorded as last focused', () => {
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-a', lastFocusedTabId: null, isStreamLeader: true },
        tabChannelAvailable: true,
        isVisible: false,
      })
    ).toBe(true);
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-b', lastFocusedTabId: null, isStreamLeader: false },
        tabChannelAvailable: true,
        isVisible: true,
      })
    ).toBe(false);
  });

  it('lets only a visible tab handle it when the tab channel is unavailable', () => {
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-a', lastFocusedTabId: 'tab-a', isStreamLeader: true },
        tabChannelAvailable: false,
        isVisible: false,
      })
    ).toBe(false);
    expect(
      shouldThisTabHandleTakeOver({
        snapshot: { tabId: 'tab-a', lastFocusedTabId: null, isStreamLeader: false },
        tabChannelAvailable: false,
        isVisible: true,
      })
    ).toBe(true);
  });
});
