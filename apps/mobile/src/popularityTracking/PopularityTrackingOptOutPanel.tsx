import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FormActions } from '../components/form';
import { formActionsTopGap } from '../theme/screenLayout';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

type PopularityTrackingOptOutPanelProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function PopularityTrackingOptOutPanel({
  onCancel,
  onConfirm,
}: PopularityTrackingOptOutPanelProps) {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actions: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        body: {
          ...typography.prose,
          color: themeStyles.textSecondary.color,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <View testID="popularity-tracking-opt-out-panel">
      <Text style={styles.body}>{t('popularity_tracking.opt_out_confirm_body')}</Text>
      <FormActions
        actions={[
          {
            label: t('misc.cancel'),
            onPress: onCancel,
            testID: 'popularity-tracking-opt-out-cancel',
            variant: 'secondary',
          },
          {
            label: t('popularity_tracking.opt_out_confirm_action'),
            onPress: onConfirm,
            testID: 'popularity-tracking-opt-out-confirm',
            variant: 'danger',
          },
        ]}
        style={styles.actions}
      />
    </View>
  );
}
