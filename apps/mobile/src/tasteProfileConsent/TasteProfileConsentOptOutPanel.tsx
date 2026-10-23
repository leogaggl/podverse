import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FormActions } from '../components/form';
import { formActionsTopGap } from '../theme/screenLayout';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

type TasteProfileConsentOptOutPanelProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function TasteProfileConsentOptOutPanel({
  onCancel,
  onConfirm,
}: TasteProfileConsentOptOutPanelProps) {
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
    <View testID="taste-profile-consent-opt-out-panel">
      <Text style={styles.body}>{t('taste_profile_consent.opt_out_confirm_body')}</Text>
      <FormActions
        actions={[
          {
            label: t('misc.cancel'),
            onPress: onCancel,
            testID: 'taste-profile-consent-opt-out-cancel',
            variant: 'secondary',
          },
          {
            label: t('taste_profile_consent.opt_out_confirm_action'),
            onPress: onConfirm,
            testID: 'taste-profile-consent-opt-out-confirm',
            variant: 'danger',
          },
        ]}
        style={styles.actions}
      />
    </View>
  );
}
