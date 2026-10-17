import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { View } from 'react-native';

/**
 * Height of the bottom chrome drawn over the scene (sync, offline, segment, mini player).
 * Screens under the tab scaffold read it. The full player and sheets sit above that chrome, so
 * they stay outside the provider and read 0.
 */
const BottomChromeOverlayHeightContext = createContext(0);

export function BottomChromeOverlayHeightProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: number;
}) {
  return (
    <BottomChromeOverlayHeightContext.Provider value={value}>
      {children}
    </BottomChromeOverlayHeightContext.Provider>
  );
}

export function useBottomChromeOverlayHeight(): number {
  return useContext(BottomChromeOverlayHeightContext);
}

/** Scroll-indicator inset so the bar is not hidden under the overlay. */
export function useBottomChromeScrollIndicatorInsets(): { bottom: number } | undefined {
  const overlayHeight = useBottomChromeOverlayHeight();
  if (overlayHeight <= 0) {
    return undefined;
  }
  return { bottom: overlayHeight };
}

/**
 * Space after the last row so it can scroll clear of the overlay. A fixed-height tail, not
 * padding on the centering box, so a fill empty state does not move when the bars appear.
 */
export function BottomChromeScrollSpacer() {
  const overlayHeight = useBottomChromeOverlayHeight();
  if (overlayHeight <= 0) {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: overlayHeight }}
    />
  );
}
