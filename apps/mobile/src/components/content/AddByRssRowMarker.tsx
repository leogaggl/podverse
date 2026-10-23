import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

export type AddByRssRowMarkerProps = { testID: string };

/**
 * Marks a row as one of the member's Add by RSS feeds, on screens that mix it with directory rows.
 */
export const AddByRssRowMarker = memo(function AddByRssRowMarker({
  testID,
}: AddByRssRowMarkerProps) {
  const { t } = useTranslation();
  const { styles: themeStyles } = useTheme();

  return (
    <View
      accessibilityLabel={t('features.add_by_rss.label')}
      accessibilityRole="image"
      accessible
      testID={testID}
    >
      <Ionicons
        accessible={false}
        color={themeStyles.textSecondary.color}
        importantForAccessibility="no"
        name="logo-rss"
        size={16}
      />
    </View>
  );
});
