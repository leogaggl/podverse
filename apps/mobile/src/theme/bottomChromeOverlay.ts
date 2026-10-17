import type { ThemeTokens } from '@podverse/design-tokens';

import { bottomChromeStripHeight } from './bottomChromeStrip';
import { MINI_PLAYER_ARTWORK_SIZE, MINI_PLAYER_PROGRESS_EDGE_HEIGHT } from './screenLayout';

export type GlobalActivityBarLayoutInput = {
  /** Top border of the bar. The component and the overlap margin must pass the same value. */
  borderTopWidth: number;
  /** Extra padding under the rows. Zero when a tab bar already owns the home-indicator inset. */
  bottomInset?: number;
  downloadsVisible: boolean;
  spacing: ThemeTokens['spacing'];
  syncVisible: boolean;
};

export type GlobalActivityBarLayout = {
  borderTopWidth: number;
  downloadsFollowMarginTop: number;
  overlayHeight: number;
  paddingBottom: number;
  rowHeight: number;
  syncPaddingTop: number;
};

/**
 * Row metrics for the sync / download bar, and the height that bar adds above the tab bar.
 *
 * `overlayHeight` is what the tab scaffold overlaps by. The bar's styles read the same numbers,
 * so a padding change cannot leave the scene short by a different amount than the bar paints.
 */
export function globalActivityBarLayout(
  input: GlobalActivityBarLayoutInput
): GlobalActivityBarLayout {
  const rowHeight = bottomChromeStripHeight(input.spacing);
  const syncPaddingTop = input.spacing.sm;
  const downloadsFollowMarginTop = input.spacing.sm;
  const paddingBottom = input.bottomInset ?? 0;
  const borderTopWidth = input.borderTopWidth;

  let overlayHeight = 0;
  if (input.syncVisible || input.downloadsVisible) {
    overlayHeight = borderTopWidth + paddingBottom;
    if (input.syncVisible) {
      overlayHeight += syncPaddingTop + rowHeight;
    }
    if (input.downloadsVisible) {
      if (input.syncVisible) {
        overlayHeight += downloadsFollowMarginTop;
      }
      overlayHeight += rowHeight;
    }
  }

  return {
    borderTopWidth,
    downloadsFollowMarginTop,
    overlayHeight,
    paddingBottom,
    rowHeight,
    syncPaddingTop,
  };
}

/** Fixed-height status strip (offline, current clip/chapter). Zero when that strip is hidden. */
export function bottomChromeStripOverlayHeight(
  visible: boolean,
  spacing: ThemeTokens['spacing']
): number {
  if (!visible) {
    return 0;
  }
  return bottomChromeStripHeight(spacing);
}

/** Mini player row plus its progress edge. Zero when nothing is loaded. */
export function miniPlayerOverlayHeight(visible: boolean): number {
  if (!visible) {
    return 0;
  }
  return MINI_PLAYER_ARTWORK_SIZE + MINI_PLAYER_PROGRESS_EDGE_HEIGHT;
}

/**
 * How far a block centered in `parentHeight` must move up so its bottom edge clears an overlay
 * of `overlayHeight` along the parent's bottom edge.
 *
 * Clearance means `0`: the block already sits above the overlay, and moving it would be the jump
 * this overlay exists to avoid. Only the covered amount is returned.
 */
export function centeredFillClearanceShift(
  parentHeight: number,
  contentHeight: number,
  overlayHeight: number
): number {
  if (parentHeight <= 0 || contentHeight <= 0 || overlayHeight <= 0) {
    return 0;
  }

  const spaceBelow = (parentHeight - contentHeight) / 2;
  const overlap = overlayHeight - spaceBelow;
  if (overlap <= 0) {
    return 0;
  }
  return overlap;
}
