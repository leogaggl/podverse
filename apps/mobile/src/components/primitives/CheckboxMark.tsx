import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

const BOX_SIZE = 22;
const CHECK_SIZE = 16;

type CheckboxMarkProps = {
  checked: boolean;
};

/**
 * Drawn checkbox. Checked uses the primary button fill with a check in that button's label color.
 * A label belongs on `CheckboxRow`, which centers that text on this box.
 */
export function CheckboxMark({ checked }: CheckboxMarkProps) {
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: {
          alignItems: 'center',
          backgroundColor: checked ? themeStyles.buttonPrimary.backgroundColor : 'transparent',
          borderColor: checked
            ? themeStyles.buttonPrimary.backgroundColor
            : themeStyles.textPrimary.color,
          borderRadius: tokens.spacing.sm,
          borderWidth: 1.5,
          height: BOX_SIZE,
          justifyContent: 'center',
          width: BOX_SIZE,
        },
      }),
    [checked, themeStyles, tokens]
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      {checked ? (
        <Ionicons color={themeStyles.buttonPrimary.color} name="checkmark" size={CHECK_SIZE} />
      ) : null}
    </View>
  );
}

export type CheckboxRowProps = {
  checked: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Checkbox with its label on the right. The row centers that label on the box.
 */
export function CheckboxRow({ checked, label, onPress, style, testID }: CheckboxRowProps) {
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
          flex: 1,
          includeFontPadding: false,
          textAlignVertical: 'center',
        },
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.md,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.row, style]}
      testID={testID}
    >
      <CheckboxMark checked={checked} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
