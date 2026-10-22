import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '../../components/form';
import { getMobileConfig } from '../../config';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AddByRssCredentialsForm } from './useAddByRssCredentialsForm';

export type AddByRssCredentialsFieldsProps = {
  form: AddByRssCredentialsForm;
  testIDPrefix: string;
};

const createStyles = ({ styles: themeStyles, tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    fields: {
      gap: tokens.spacing.lg,
    },
    notice: {
      color: themeStyles.textSecondary.color,
      fontSize: 14,
      marginTop: tokens.spacing.md,
    },
  });

/**
 * Username and password fields for one add-by-RSS feed, plus the notice under them.
 *
 * The caller renders the button. The testID prefix keeps the credentials screen and the channel
 * settings pane on different Maestro locators.
 */
export function AddByRssCredentialsFields({ form, testIDPrefix }: AddByRssCredentialsFieldsProps) {
  const { t } = useTranslation();
  const { isE2e } = getMobileConfig();
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <View style={styles.fields}>
        <TextField
          accessibilityLabel={t('features.add_by_rss.basic_auth_username')}
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          eyebrow={t('features.add_by_rss.basic_auth_username')}
          onChangeText={form.setUsername}
          placeholder={t('misc.required')}
          testID={`${testIDPrefix}-username`}
          textContentType="username"
          value={form.username}
        />
        <TextField
          accessibilityLabel={t('features.add_by_rss.basic_auth_password')}
          autoCapitalize="none"
          autoComplete={isE2e ? 'off' : 'current-password'}
          autoCorrect={false}
          eyebrow={t('features.add_by_rss.basic_auth_password')}
          onChangeText={form.setPassword}
          placeholder={t('misc.required')}
          // iOS Autofill plus a secure field blocks Maestro inputText. E2E shows the password in plaintext.
          secureTextEntry={!isE2e}
          testID={`${testIDPrefix}-password`}
          textContentType={isE2e ? 'none' : 'password'}
          value={form.password}
        />
      </View>
      {form.noticeKey !== null ? (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.notice}
          testID={`${testIDPrefix}-notice`}
        >
          {t(form.noticeKey)}
        </Text>
      ) : null}
    </View>
  );
}
