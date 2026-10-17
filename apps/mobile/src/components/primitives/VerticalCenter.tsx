import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { centeredFillClearanceShift } from '../../theme/bottomChromeOverlay';
import { useBottomChromeOverlayHeight } from '../../theme/bottomChromeOverlayInset';
import { useTheme } from '../../theme/useTheme';

export type VerticalCenterProps = {
  children: ReactNode;
  testID?: string;
};

/**
 * Fills its parent and centers children on both axes.
 *
 * The parent controls the available height, so this stays between surrounding navigation or list
 * controls without screen-specific positioning. Use as a FlatList `ListEmptyComponent` only inside
 * `FillList`, which locks scroll for this fill state.
 *
 * Bottom chrome overlaps the scene. This keeps the center in the full parent and moves the block
 * up only when that overlay would cover it.
 */
export function VerticalCenter({ children, testID }: VerticalCenterProps) {
  const overlayHeight = useBottomChromeOverlayHeight();
  const { tokens } = useTheme();
  const [parentHeight, setParentHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const shift = centeredFillClearanceShift(parentHeight, contentHeight, overlayHeight);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.lg,
        },
        content: {
          alignItems: 'center',
          alignSelf: 'stretch',
          width: '100%',
        },
      }),
    [tokens]
  );

  const onParentLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setParentHeight((current) => (current === next ? current : next));
  };

  const onContentLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setContentHeight((current) => (current === next ? current : next));
  };

  return (
    <View onLayout={onParentLayout} style={styles.container} testID={testID}>
      <View
        onLayout={onContentLayout}
        style={[styles.content, shift > 0 ? { transform: [{ translateY: -shift }] } : null]}
      >
        {children}
      </View>
    </View>
  );
}
