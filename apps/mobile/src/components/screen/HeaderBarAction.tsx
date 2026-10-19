import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { LIST_ROW_ACTION_SIZE } from '../../theme/screenLayout';
import { useTheme } from '../../theme/useTheme';

/** `bar` is the 44pt title-bar slot. `inline` sizes the control to the glyph. */
export type HeaderBarActionLayout = 'bar' | 'inline';

export type HeaderBarActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  iconSize?: number;
  label?: string;
  /**
   * `bar` reserves a 44pt slot and centers the glyph. `inline` sizes the control to the glyph
   * and keeps a 44pt hit target with hitSlop, so the icon can line up with a neighboring title.
   */
  layout?: HeaderBarActionLayout;
  onPress: () => void;
  /** Set when the control toggles a pane, so assistive tech hears the same selected state. */
  selected?: boolean;
  testID: string;
};

/**
 * Title-bar control for the trailing (or leading) header slot. Pass an icon, a localized label,
 * or both. Screens and the image viewer share this so top-right actions stay one control.
 * Glyph and label use `tokens.text.primary` (same as the title), never accent/link blue.
 * A press dims to the same 0.7 opacity `Button` uses so the tap is visible.
 */
export function HeaderBarAction({
  accessibilityLabel,
  disabled = false,
  icon,
  iconColor,
  iconSize = 26,
  label,
  layout = 'bar',
  onPress,
  selected,
  testID,
}: HeaderBarActionProps) {
  const { tokens } = useTheme();
  const inline = layout === 'inline';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          alignItems: 'center',
          justifyContent: 'center',
          ...(inline
            ? {
                height: iconSize,
                width: iconSize,
              }
            : {
                minHeight: LIST_ROW_ACTION_SIZE,
                minWidth: LIST_ROW_ACTION_SIZE,
                paddingHorizontal: tokens.spacing.sm,
              }),
        },
        buttonDisabled: {
          opacity: 0.4,
        },
        buttonPressed: {
          opacity: 0.7,
        },
        inlineIcon: {
          includeFontPadding: false,
          lineHeight: iconSize,
        },
        label: {
          color: tokens.text.primary,
          fontSize: 16,
          fontWeight: '700',
        },
      }),
    [iconSize, inline, tokens]
  );

  const inlineHitSlop = Math.max(0, (LIST_ROW_ACTION_SIZE - iconSize) / 2);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        ...(selected !== undefined ? { selected } : {}),
      }}
      disabled={disabled}
      hitSlop={inline ? inlineHitSlop : 8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : null,
        !disabled && pressed ? styles.buttonPressed : null,
      ]}
      testID={testID}
    >
      {icon !== undefined ? (
        <Ionicons
          color={iconColor ?? tokens.text.primary}
          name={icon}
          size={iconSize}
          style={inline ? styles.inlineIcon : undefined}
        />
      ) : null}
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}
