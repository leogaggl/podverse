import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '../../hooks/useReduceMotion';

const FADE_MS = 200;
const VISIBLE_MS = 3000;
const HIT_SIZE = 44;
const INSET = 8;

type VideoCornerChromeProps = {
  actionTestID: string;
  bottomInset: number;
  iconName: 'contract-outline' | 'expand-outline';
  label: string;
  onAction: () => void;
  revealTestID: string;
  rightInset: number;
};

/**
 * A tap on the video fades a corner button in. A second tap on the video fades it out.
 * The button stays in the accessibility tree while it is visually hidden.
 */
export function VideoCornerChrome({
  actionTestID,
  bottomInset,
  iconName,
  label,
  onAction,
  revealTestID,
  rightInset,
}: VideoCornerChromeProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = (): void => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const fadeTo = (next: boolean): void => {
    setRevealed(next);
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(next ? 1 : 0);
      return;
    }
    Animated.timing(opacity, {
      duration: FADE_MS,
      toValue: next ? 1 : 0,
      useNativeDriver: true,
    }).start();
  };

  const reveal = (): void => {
    clearHideTimer();
    fadeTo(true);
    hideTimer.current = setTimeout(() => {
      fadeTo(false);
    }, VISIBLE_MS);
  };

  const hide = (): void => {
    clearHideTimer();
    fadeTo(false);
  };

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessible={false}
        onPress={revealed ? hide : reveal}
        style={StyleSheet.absoluteFill}
        testID={revealTestID}
      />
      <Animated.View
        pointerEvents={revealed ? 'box-none' : 'none'}
        style={[styles.corner, { bottom: bottomInset, opacity, right: rightInset }]}
      >
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={onAction}
          style={styles.hit}
          testID={actionTestID}
        >
          <Ionicons color="#ffffff" name={iconName} size={22} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
  },
  hit: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 8,
    height: HIT_SIZE,
    justifyContent: 'center',
    width: HIT_SIZE,
  },
});

export const videoCornerChromeInset = INSET;
