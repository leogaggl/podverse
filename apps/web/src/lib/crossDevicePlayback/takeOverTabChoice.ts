import type { CrossDevicePlaybackSnapshot } from './crossDevicePlaybackStore';

/**
 * A take-over command reaches every tab of the target session; exactly one of them handles it.
 * The last focused tab does, else the stream leader. Without the tab channel the tabs cannot
 * agree, so a tab handles it only while visible.
 */
export function shouldThisTabHandleTakeOver(params: {
  snapshot: Pick<CrossDevicePlaybackSnapshot, 'tabId' | 'lastFocusedTabId' | 'isStreamLeader'>;
  tabChannelAvailable: boolean;
  isVisible: boolean;
}): boolean {
  const { snapshot, tabChannelAvailable, isVisible } = params;
  if (!tabChannelAvailable) {
    return isVisible;
  }
  if (snapshot.lastFocusedTabId !== null) {
    return snapshot.lastFocusedTabId === snapshot.tabId;
  }
  return snapshot.isStreamLeader;
}
