import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, TextStyle } from 'react-native';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useMarqueeTurn } from '../../hooks/useMarqueeTurn';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
  MARQUEE_EDGE_HOLD_MS,
  MARQUEE_LOOP_GAP,
  marqueeLoopDistance,
  marqueeScrollDurationMs,
  shouldMarqueeScroll,
  stabilizeMeasuredWidth,
} from '../../lib/text/marqueeScroll';
import type { MarqueeTurnGroup } from '../../lib/text/marqueeTurns';

export type MarqueeTextProps = {
  /**
   * Where the label sits when it fits. A scrolling label rests on its first word, at the leading
   * edge unless `restInset` is set, since the pass has to begin at the first word.
   */
  align?: 'center' | 'left';
  children: string;
  /**
   * Space before the first word while the label is at rest. The space travels with the scrolling
   * copy, so the glyphs still leave at the clip edge.
   */
  restInset?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  /**
   * Labels in the same group scroll one at a time, handing off after each pass. Ungrouped labels
   * loop on their own.
   */
  turnGroup?: MarqueeTurnGroup;
  /** Position in the group's rotation. Lower goes first. */
  turnOrder?: number;
};

/**
 * Single-line label that scrolls itself when it is too long for the space it has, and truncates
 * instead under Reduce Motion.
 *
 * Built for player chrome, where the bar is one line tall and the full title is the thing the
 * listener is looking for. Overflowing labels rest on the first word before every pass, then
 * travel at a constant speed with a second copy parked after a seam gap so the wrap is a
 * continuation, not a snap. Labels that share a group move one at a time and hand off after
 * each pass. A label with no group repeats on its own.
 * The moving glyphs are painted out of flow so their natural width cannot widen the clip box.
 * An off-screen copy of the label measures that natural width, since a one-line `Text` inside a
 * flex row reports only the width it was allowed.
 */
export function MarqueeText({
  align = 'left',
  children,
  restInset = 0,
  style,
  testID,
  turnGroup,
  turnOrder,
}: MarqueeTextProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const offset = useRef(new Animated.Value(0)).current;

  const scrolls = shouldMarqueeScroll({
    contentWidth,
    reduceMotion,
    viewportWidth: Math.max(0, viewportWidth - restInset),
  });
  const { finish, turn } = useMarqueeTurn({ group: turnGroup, order: turnOrder ?? 0, scrolls });

  useEffect(() => {
    offset.setValue(0);
    if (!scrolls || turn === null) {
      return;
    }
    const distance = marqueeLoopDistance(contentWidth);
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;

    const startPass = (onFinished: () => void) => {
      animation = Animated.sequence([
        Animated.delay(MARQUEE_EDGE_HOLD_MS),
        Animated.timing(offset, {
          duration: marqueeScrollDurationMs(distance),
          easing: Easing.linear,
          toValue: -distance,
          useNativeDriver: true,
        }),
      ]);
      animation.start(({ finished }) => {
        if (finished && !cancelled) {
          onFinished();
        }
      });
    };

    if (turnGroup === undefined) {
      const runPass = () => {
        if (cancelled) {
          return;
        }
        offset.setValue(0);
        startPass(runPass);
      };
      runPass();
    } else {
      startPass(() => {
        offset.setValue(0);
        finish();
      });
    }

    return () => {
      cancelled = true;
      animation?.stop();
      offset.setValue(0);
    };
    // `children` restarts from the first word when the now-playing label changes.
  }, [children, contentWidth, finish, offset, scrolls, turn, turnGroup]);

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setViewportWidth((previous) => stabilizeMeasuredWidth(previous, next));
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setContentWidth((previous) => stabilizeMeasuredWidth(previous, next));
  };

  const copyStyle = [style, scrolls ? { width: contentWidth } : null];

  return (
    <View style={styles.root} testID={testID}>
      <View collapsable={false} onLayout={handleViewportLayout} style={styles.viewport}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          style={[style, styles.sizer]}
        >
          {children}
        </Text>
        <Animated.View
          style={[
            styles.paint,
            scrolls ? { transform: [{ translateX: offset }] } : styles.paintFit,
          ]}
        >
          {scrolls && restInset > 0 ? <View style={{ width: restInset }} /> : null}
          <Text
            numberOfLines={1}
            style={[
              copyStyle,
              align === 'center' && !scrolls ? styles.centered : null,
              scrolls ? null : styles.fitCopy,
              !scrolls && align === 'left' && restInset > 0 ? { paddingLeft: restInset } : null,
            ]}
          >
            {children}
          </Text>
          {scrolls ? (
            <>
              <View style={styles.seam} />
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                numberOfLines={1}
                style={copyStyle}
              >
                {children}
              </Text>
            </>
          ) : null}
        </Animated.View>
      </View>
      {/*
        Natural-width measurement. The wrapper is far wider than any bar, so the label lays out at
        the width it wants instead of the width the row allows. It is a sibling of the clip box so
        that 10_000dp cannot leak into the viewport's onLayout.
      */}
      <View pointerEvents="none" style={styles.measureWrapper}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          onLayout={handleContentLayout}
          style={[style, styles.measureText]}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

/** Wider than any phone or tablet bar, so measurement is never clamped by the row. */
const MEASURE_MAX_WIDTH = 10_000;

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  fitCopy: {
    flex: 1,
  },
  measureText: {
    alignSelf: 'flex-start',
  },
  measureWrapper: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: MEASURE_MAX_WIDTH,
  },
  paint: {
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
  },
  paintFit: {
    right: 0,
  },
  root: {
    alignSelf: 'stretch',
    minWidth: 0,
    width: '100%',
  },
  seam: {
    width: MARQUEE_LOOP_GAP,
  },
  sizer: {
    opacity: 0,
  },
  viewport: {
    overflow: 'hidden',
    width: '100%',
  },
});
