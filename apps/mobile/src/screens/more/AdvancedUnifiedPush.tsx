import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { validateHttpsUrl } from '@podverse/helpers-validation/client';

import { requestWithMobileAuthRefresh } from '../../auth';
import { useAuth } from '../../auth/AuthProvider';
import { FormActions } from '../../components/form/FormActions';
import { SettingsRowDescription, SettingsSwitchRow } from '../../components/form/SettingsSwitchRow';
import { TextField } from '../../components/form/TextField';
import { getMobileConfig } from '../../config';
import { resolveSupportedLocale } from '../../i18n/locale';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import {
  disableUserUnifiedPush,
  enableUserUnifiedPush,
  forgetRegisteredUnifiedPushEndpoint,
  isUnifiedPushRegisteredOnDevice,
  rememberRegisteredUnifiedPushEndpoint,
} from '../../push/unifiedPushDeviceSync';
import { typography } from '../../theme/typography';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';

const createStyles = ({ styles: themeStyles, tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    endpoint: {
      ...typography.caption,
      color: themeStyles.textSecondary.color,
    },
    error: {
      ...typography.caption,
      color: tokens.text.danger,
    },
    form: {
      gap: tokens.spacing.base,
      paddingBottom: tokens.spacing.lg,
      paddingHorizontal: tokens.spacing.lg,
    },
    registered: {
      gap: tokens.spacing.xs,
      paddingBottom: tokens.spacing.lg,
      paddingHorizontal: tokens.spacing.lg,
    },
  });

export function AdvancedUnifiedPush() {
  const { i18n, t } = useTranslation();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { handleGateError } = useMembershipGate();
  const styles = useThemedStyles(createStyles);
  const isAuthenticated = status === 'authenticated';
  const [registered, setRegistered] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [endpointInput, setEndpointInput] = useState('');
  const [authKeyInput, setAuthKeyInput] = useState('');
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requestContext = {
    accessToken,
    clearSession,
    refreshToken,
    setTokens,
  };

  const showLoginAlert = useCallback(() => {
    Alert.alert(
      t('settings.notifications.login_required_title'),
      t('settings.notifications.login_required_message'),
      [{ text: t('misc.ok') }]
    );
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setRegistered(false);
      setEndpoint(null);
      return;
    }

    void (async () => {
      try {
        const device = await requestWithMobileAuthRefresh(requestContext, (api) =>
          api.reqAccountUPDeviceGetForAccount()
        );
        if (cancelled) {
          return;
        }
        if (device) {
          await rememberRegisteredUnifiedPushEndpoint(device.up_endpoint);
          setRegistered(true);
          setEndpoint(device.up_endpoint);
          return;
        }
        await forgetRegisteredUnifiedPushEndpoint();
        setRegistered(false);
        setEndpoint(null);
      } catch (error) {
        if (!cancelled) {
          console.warn('Could not load Unified Push', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearSession, isAuthenticated, refreshToken, setTokens]);

  const handleToggle = (next: boolean) => {
    setFormError(null);
    if (!isAuthenticated) {
      showLoginAlert();
      return;
    }

    if (next) {
      const configured = getMobileConfig().unifiedPushEndpoint;
      setShowForm(true);
      setEndpointInput(endpoint ?? configured ?? '');
      setAuthKeyInput('');
      setEndpointError(null);
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        await disableUserUnifiedPush({ auth: requestContext });
        setRegistered(false);
        setEndpoint(null);
        setShowForm(false);
      } catch (error) {
        if (!handleGateError(error)) {
          setFormError(t('settings.notifications.up_enable_error'));
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  const enable = () => {
    const validation = validateHttpsUrl(endpointInput);
    if (!validation.isValid) {
      setEndpointError(t('settings.notifications.up_endpoint_invalid'));
      return;
    }

    setEndpointError(null);
    setFormError(null);
    setSaving(true);
    void (async () => {
      try {
        const trimmedAuth = authKeyInput.trim();
        await enableUserUnifiedPush({
          auth: requestContext,
          authKey: trimmedAuth === '' ? null : trimmedAuth,
          endpoint: endpointInput.trim(),
          locale: resolveSupportedLocale(i18n.language),
        });
        const ready = await isUnifiedPushRegisteredOnDevice();
        if (!ready) {
          setFormError(t('settings.notifications.up_enable_error'));
          return;
        }
        setRegistered(true);
        setEndpoint(endpointInput.trim());
        setShowForm(false);
        setAuthKeyInput('');
      } catch (error) {
        if (!handleGateError(error)) {
          setFormError(t('settings.notifications.up_enable_error'));
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <View testID="more-advanced-unified-push">
      <SettingsSwitchRow
        onValueChange={handleToggle}
        switchTestID="more-advanced-unified-push-switch"
        testID="more-advanced-unified-push-row"
        title={t('settings.notifications.unified_push')}
        value={registered}
      >
        <SettingsRowDescription>
          {t('settings.notifications.unified_push_help')}
        </SettingsRowDescription>
      </SettingsSwitchRow>
      {showForm && !registered ? (
        <View style={styles.form}>
          <TextField
            accessibilityLabel={t('settings.notifications.up_endpoint_label')}
            autoCapitalize="none"
            autoCorrect={false}
            eyebrow={t('settings.notifications.up_endpoint_label')}
            invalid={endpointError !== null}
            keyboardType="url"
            onChangeText={(value) => {
              setEndpointInput(value);
              setEndpointError(null);
            }}
            placeholder={t('settings.notifications.up_endpoint_placeholder')}
            testID="more-advanced-unified-push-endpoint"
            value={endpointInput}
          />
          {endpointError !== null ? (
            <Text style={styles.error} testID="more-advanced-unified-push-endpoint-error">
              {endpointError}
            </Text>
          ) : null}
          <TextField
            accessibilityLabel={t('settings.notifications.up_auth_key_label')}
            autoCapitalize="none"
            autoCorrect={false}
            eyebrow={t('settings.notifications.up_auth_key_label')}
            onChangeText={setAuthKeyInput}
            placeholder={t('settings.notifications.up_auth_key_placeholder')}
            secureTextEntry
            testID="more-advanced-unified-push-auth-key"
            value={authKeyInput}
          />
          {formError !== null ? (
            <Text style={styles.error} testID="more-advanced-unified-push-error">
              {formError}
            </Text>
          ) : null}
          <FormActions
            actions={[
              {
                label: t('settings.notifications.cancel'),
                onPress: () => {
                  setShowForm(false);
                  setEndpointInput('');
                  setAuthKeyInput('');
                  setEndpointError(null);
                  setFormError(null);
                },
                testID: 'more-advanced-unified-push-cancel',
                variant: 'secondary',
              },
              {
                disabled: endpointInput.trim() === '' || saving,
                label: t('settings.notifications.enable'),
                loading: saving,
                onPress: enable,
                testID: 'more-advanced-unified-push-enable',
                variant: 'primary',
              },
            ]}
          />
        </View>
      ) : null}
      {registered && endpoint !== null && endpoint !== '' ? (
        <View style={styles.registered}>
          <Text style={styles.endpoint}>
            {t('settings.notifications.up_current_endpoint')} {endpoint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
