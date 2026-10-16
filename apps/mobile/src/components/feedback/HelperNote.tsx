import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

/** Info glyph on a compact helper note. */
export const HELPER_NOTE_ICON_SIZE = 18;

/** Info glyph on a reading helper note. Same edge as a header action glyph. */
export const HELPER_NOTE_READING_ICON_SIZE = 22;

export type HelperNoteScale = 'compact' | 'reading';

export type HelperNoteProps = {
  /** Already localized. The note's accessible name. */
  message: string;
  /**
   * `compact` is caption type for a short instruction. `reading` is body type for a sentence
   * beside a title and description.
   */
  scale?: HelperNoteScale;
  testID?: string;
};

/**
 * In-page explainer beside the content it explains. Tertiary fill and a leading info icon,
 * centered on the sentence.
 */
export function HelperNote({ message, scale = 'compact', testID }: HelperNoteProps) {
  const { styles: themeStyles, tokens } = useTheme();
  const messageType = scale === 'reading' ? typography.body : typography.caption;
  const iconSize = scale === 'reading' ? HELPER_NOTE_READING_ICON_SIZE : HELPER_NOTE_ICON_SIZE;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        message: {
          ...messageType,
          color: themeStyles.textSecondary.color,
          flex: 1,
        },
        note: {
          alignItems: 'center',
          backgroundColor: tokens.background.tertiary,
          borderRadius: tokens.radii.md,
          flexDirection: 'row',
          gap: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.base,
        },
      }),
    [messageType, themeStyles, tokens]
  );

  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="text"
      accessible
      style={styles.note}
      testID={testID}
    >
      <Ionicons
        accessibilityElementsHidden
        accessible={false}
        color={themeStyles.textSecondary.color}
        importantForAccessibility="no"
        name="information-circle-outline"
        size={iconSize}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
