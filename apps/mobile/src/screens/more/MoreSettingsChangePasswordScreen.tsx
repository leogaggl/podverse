import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACCOUNT_CHANGE_PASSWORD_ERROR_CODES,
  getErrorResponseBodyCode,
  getErrorResponseStatus,
} from '@podverse/helpers/error';
import {
  getPasswordErrorKey,
  getPasswordRequirementsInfoKey,
} from '@podverse/helpers-validation/client';

import { useAuth } from '../../auth/AuthProvider';
import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import { FormActions, TextField } from '../../components/form';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { AuthAwareLoadState } from '../../components/state/AuthAwareLoadState';
import { ListEmpty } from '../../components/state/ListEmpty';
import { getMobileConfig } from '../../config';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import { handleRateLimitMessage } from '../../lib/rateLimit/handleRateLimitMessage';
import { useOfflineMode } from '../../prefs/offlineMode';
import { formActionsTopGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

export function MoreSettingsChangePasswordScreen() {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const { isE2e } = getMobileConfig();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string | undefined>();
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actions: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        body: {
          gap: tokens.spacing.md,
        },
        description: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        error: {
          ...typography.body,
          color: tokens.text.danger,
        },
        fieldBlock: {
          gap: tokens.spacing.xs,
        },
        requirements: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        success: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
        },
      }),
    [themeStyles, tokens]
  );

  const onCurrentPasswordChange = (value: string) => {
    setCurrentPassword(value);
    setCurrentPasswordError(undefined);
    setFormError(undefined);
    setSuccessMessage(undefined);
  };

  const onNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setNewPasswordError(undefined);
    setFormError(undefined);
    setSuccessMessage(undefined);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }
    if (currentPassword.trim() === '' || newPassword.trim() === '') {
      setSuccessMessage(undefined);
      setFormError(t('settings.account.change_password.missing_field'));
      return;
    }
    if (getPasswordErrorKey(newPassword) !== undefined) {
      setSuccessMessage(undefined);
      setFormError(undefined);
      setNewPasswordError(t('authentication.invalid_password'));
      return;
    }

    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setFormError(undefined);
    setSuccessMessage(undefined);
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await requestWithMobileAuthRefresh(
        { accessToken, clearSession, refreshToken, setTokens },
        (api) =>
          api.reqAccountChangePassword({
            current_password: currentPassword,
            new_password: newPassword,
          })
      );
      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage(t('settings.account.change_password.success'));
    } catch (error: unknown) {
      const rateLimitText = handleRateLimitMessage(error, t);
      if (rateLimitText !== null) {
        setFormError(rateLimitText);
        return;
      }
      if (getErrorResponseStatus(error) === 401) {
        return;
      }
      const code = getErrorResponseBodyCode(error);
      if (code === ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.CURRENT_PASSWORD_INCORRECT) {
        setCurrentPasswordError(t('settings.account.change_password.current_incorrect'));
        return;
      }
      if (code === ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.INVALID_NEW_PASSWORD) {
        setNewPasswordError(t('authentication.invalid_password'));
        return;
      }
      if (getErrorResponseStatus(error) === 400 && code === undefined) {
        setFormError(t('settings.account.change_password.missing_field'));
        return;
      }
      console.warn('[MoreSettingsChangePasswordScreen] change password failed', error);
      setFormError(t('settings.account.change_password.error'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (status !== 'authenticated') {
    return (
      <MobileScreenContainer testID="more-settings-change-password-screen">
        <AuthAwareLoadState
          authMessageKey="authentication.login_required"
          emptyTestID="more-settings-change-password-login-required"
          errorKey={null}
          isLoading={false}
          onRetry={() => undefined}
          showAuthRequired
        />
      </MobileScreenContainer>
    );
  }

  if (offlineModeEnabled) {
    return (
      <MobileScreenContainer testID="more-settings-change-password-screen">
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="more-settings-change-password-offline"
        />
      </MobileScreenContainer>
    );
  }

  const isSubmitDisabled =
    currentPassword.trim() === '' || getPasswordErrorKey(newPassword) !== undefined;

  return (
    <MobileScreenContainer
      automaticallyAdjustKeyboardInsets
      testID="more-settings-change-password-screen"
    >
      <View style={styles.body}>
        <Text style={styles.description}>{t('settings.account.change_password.description')}</Text>
        <View style={styles.fieldBlock}>
          <TextField
            accessibilityLabel={t('settings.account.change_password.current_password')}
            autoCapitalize="none"
            autoComplete={isE2e ? 'off' : 'current-password'}
            autoCorrect={false}
            eyebrow={t('settings.account.change_password.current_password')}
            invalid={currentPasswordError !== undefined}
            onChangeText={onCurrentPasswordChange}
            placeholder={t('settings.account.change_password.current_password_placeholder')}
            secureTextEntry={!isE2e}
            testID="more-settings-change-password-current"
            textContentType={isE2e ? 'none' : 'password'}
            value={currentPassword}
          />
          {currentPasswordError !== undefined ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.error}
              testID="more-settings-change-password-current-error"
            >
              {currentPasswordError}
            </Text>
          ) : null}
        </View>
        <View style={styles.fieldBlock}>
          <TextField
            accessibilityLabel={t('settings.account.change_password.new_password')}
            autoCapitalize="none"
            autoComplete={isE2e ? 'off' : 'new-password'}
            autoCorrect={false}
            eyebrow={t('settings.account.change_password.new_password')}
            invalid={newPasswordError !== undefined}
            onChangeText={onNewPasswordChange}
            placeholder={t('authentication.password_hint')}
            secureTextEntry={!isE2e}
            testID="more-settings-change-password-new"
            textContentType={isE2e ? 'none' : 'newPassword'}
            value={newPassword}
          />
          {newPasswordError !== undefined ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.error}
              testID="more-settings-change-password-new-error"
            >
              {newPasswordError}
            </Text>
          ) : null}
        </View>
        <Text style={styles.requirements}>
          {t(`authentication.${getPasswordRequirementsInfoKey()}`)}
        </Text>
        {formError !== undefined ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.error}
            testID="more-settings-change-password-error"
          >
            {formError}
          </Text>
        ) : null}
        {successMessage !== undefined ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.success}
            testID="more-settings-change-password-success"
          >
            {successMessage}
          </Text>
        ) : null}
      </View>
      <FormActions
        actions={[
          {
            disabled: isSubmitDisabled,
            label: t('settings.account.change_password.submit'),
            loading: isSubmitting,
            onPress: () => {
              void handleSubmit();
            },
            testID: 'more-settings-change-password-submit',
            variant: 'primary',
          },
        ]}
        style={styles.actions}
      />
    </MobileScreenContainer>
  );
}
