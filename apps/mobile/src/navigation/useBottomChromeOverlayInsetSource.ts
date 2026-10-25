import { StyleSheet } from 'react-native';

import { useNowPlayingSegmentStripVisible } from '../components/player/nowPlayingSegmentStripPresence';
import { useMiniPlayerVisible } from '../components/player/useMiniPlayerVisible';
import { countInProgressDownloads } from '../downloads/inProgressDownloadCount';
import { useDownloadsList } from '../downloads/useDownloads';
import { useOfflineStatus } from '../prefs/offlineStatus';
import { useSync } from '../sync';
import {
  bottomChromeStripOverlayHeight,
  globalActivityBarLayout,
  miniPlayerOverlayHeight,
} from '../theme/bottomChromeOverlay';
import { useTheme } from '../theme/useTheme';

/**
 * Height of everything the tab scaffold draws above the tab bar, computed in the same render as
 * those bars. The segment strip is the exception: its presence comes from a store the strip
 * updates when a segment appears or clears, not from the playhead.
 */
export function useBottomChromeOverlayInsetSource(): number {
  const { tokens } = useTheme();
  const { state } = useSync();
  const { downloads } = useDownloadsList();
  const { cause } = useOfflineStatus();
  const miniPlayerVisible = useMiniPlayerVisible();
  const segmentVisible = useNowPlayingSegmentStripVisible();

  const syncVisible = state.status === 'running' && state.activeLabelKey !== null;
  const downloadsVisible = countInProgressDownloads(downloads) > 0;
  const activityHeight = globalActivityBarLayout({
    borderTopWidth: StyleSheet.hairlineWidth,
    downloadsVisible,
    spacing: tokens.spacing,
    syncVisible,
  }).overlayHeight;

  return (
    activityHeight +
    bottomChromeStripOverlayHeight(cause !== null, tokens.spacing) +
    bottomChromeStripOverlayHeight(segmentVisible, tokens.spacing) +
    miniPlayerOverlayHeight(miniPlayerVisible)
  );
}
