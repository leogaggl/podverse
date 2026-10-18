import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOAccountNotificationPreference } from '@podverse/helpers';
import { NotificationCategoryEnum } from '@podverse/helpers';

import { requestWithMobileAuthRefresh } from '../../auth';
import { useAuth } from '../../auth/AuthProvider';
import type { SyncedNotificationType } from '../../auth/syncAccountPrefs';
import {
  syncAutoEnableOnSubscribeToAccountSettings,
  syncNotificationTypeToAccountSettings,
} from '../../auth/syncAccountPrefs';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { SettingsRowDescription, SettingsSwitchRow } from '../../components/form';
import { Card } from '../../components/primitives/Card';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { getMobileConfig } from '../../config';
import { notificationsRepository } from '../../data/repositories';
import { subscriptionsRepository } from '../../data/repositories/subscriptionsRepository';
import { resolveSupportedLocale } from '../../i18n/locale';
import { NOTIFICATION_TYPE_ROWS } from '../../lib/notifications/notificationTypeRows';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import { registerFcmDeviceForAccount } from '../../push/fcmDeviceSync';
import {
  openSystemNotificationSettings,
  requestFcmPermissionAfterUserAction,
} from '../../push/fcmTransport';
import { registerUnifiedPushDeviceForAccount } from '../../push/unifiedPushDeviceSync';
import { settingsCardGap, settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

type NotificationPreferenceRow = {
  category: NotificationCategoryEnum;
  descriptionKey: string;
  forceInAppEnabled: boolean;
  labelKey: string;
};

const NOTIFICATION_PREFERENCE_ROWS: readonly NotificationPreferenceRow[] = [
  {
    category: NotificationCategoryEnum.NewContent,
    descriptionKey: 'settings.notifications.category_new_content_description',
    forceInAppEnabled: false,
    labelKey: 'settings.notifications.category_new_content',
  },
  {
    category: NotificationCategoryEnum.Livestream,
    descriptionKey: 'settings.notifications.category_livestream_description',
    forceInAppEnabled: false,
    labelKey: 'settings.notifications.category_livestream',
  },
  {
    category: NotificationCategoryEnum.ProductUpdate,
    descriptionKey: 'settings.notifications.category_product_update_description',
    forceInAppEnabled: false,
    labelKey: 'settings.notifications.category_product_update',
  },
  {
    category: NotificationCategoryEnum.Maintenance,
    descriptionKey: 'settings.notifications.category_maintenance_description',
    forceInAppEnabled: true,
    labelKey: 'settings.notifications.category_maintenance',
  },
  {
    category: NotificationCategoryEnum.TermsOfService,
    descriptionKey: 'settings.notifications.category_terms_of_service_description',
    forceInAppEnabled: true,
    labelKey: 'settings.notifications.category_terms_of_service',
  },
  {
    category: NotificationCategoryEnum.General,
    descriptionKey: 'settings.notifications.category_general_description',
    forceInAppEnabled: true,
    labelKey: 'settings.notifications.category_general',
  },
];

export function MoreSettingsNotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { accessToken, account, clearSession, refreshToken, setAccount, setTokens, status } =
    useAuth();
  const isAuthenticated = status === 'authenticated';
  const { handleGateError } = useMembershipGate();
  const { styles: themeStyles, tokens } = useTheme();
  const [notificationPreferences, setNotificationPreferences] = useState<
    DTOAccountNotificationPreference[]
  >([]);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
  const [notificationPermissionBlocked, setNotificationPermissionBlocked] =
    useState<boolean>(false);
  const [showNotificationPermissionHint, setShowNotificationPermissionHint] =
    useState<boolean>(false);
  const [applyDialog, setApplyDialog] = useState<null | 'auto_enable' | 'type_default'>(null);
  const [pendingDefault, setPendingDefault] = useState<boolean>(false);
  const [pendingType, setPendingType] = useState<SyncedNotificationType | null>(null);
  const [affectedCount, setAffectedCount] = useState(0);

  const selectedLocale = resolveSupportedLocale(i18n.language);

  const requestContext = useMemo(
    () => ({
      accessToken,
      clearSession,
      refreshToken,
      setTokens,
    }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!isAuthenticated) {
        setNotificationPreferences([]);
        return;
      }

      try {
        const rows = await notificationsRepository.listPreferences(requestContext);
        if (!isMounted) {
          return;
        }
        setNotificationPreferences(rows);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.warn('Could not load notification preferences', error);
        setNotificationPreferences([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, requestContext]);

  const showNotificationLoginAlert = useCallback(() => {
    Alert.alert(
      t('settings.notifications.login_required_title'),
      t('settings.notifications.login_required_message'),
      [{ text: t('misc.ok') }]
    );
  }, [t]);

  const settingsNotification = account?.account_settings?.account_settings_notification;
  const autoEnableOnSubscribe = settingsNotification?.auto_enable_on_subscribe ?? false;
  const enabledDefaultTypes = new Set<string>(
    (settingsNotification?.account_settings_notification_types ?? []).map((row) => row.type)
  );

  const handleAutoEnableOnSubscribeToggle = useCallback(
    async (nextValue: boolean) => {
      setErrorMessageKey(null);

      if (!isAuthenticated) {
        showNotificationLoginAlert();
        return;
      }

      try {
        await syncAutoEnableOnSubscribeToAccountSettings({
          auth: requestContext,
          enabled: nextValue,
          setAccount,
        });

        const count = nextValue
          ? (await subscriptionsRepository.list()).length
          : (
              await requestWithMobileAuthRefresh(requestContext, (api) =>
                api.reqAccountNotificationChannelsGetAll()
              )
            ).length;

        if (count === 0) {
          return;
        }

        setPendingDefault(nextValue);
        setAffectedCount(count);
        setApplyDialog('auto_enable');
      } catch (error) {
        if (handleGateError(error)) {
          return;
        }
        setErrorMessageKey('errors.generic');
      }
    },
    [handleGateError, isAuthenticated, requestContext, setAccount, showNotificationLoginAlert]
  );

  const handleNotificationTypeDefaultToggle = useCallback(
    async (type: SyncedNotificationType, nextValue: boolean) => {
      setErrorMessageKey(null);

      if (!isAuthenticated) {
        showNotificationLoginAlert();
        return;
      }

      try {
        await syncNotificationTypeToAccountSettings({
          auth: requestContext,
          enabled: nextValue,
          setAccount,
          type,
        });

        const channels = await requestWithMobileAuthRefresh(requestContext, (api) =>
          api.reqAccountNotificationChannelsGetAll()
        );
        if (channels.length === 0) {
          return;
        }

        setPendingType(type);
        setPendingDefault(nextValue);
        setAffectedCount(channels.length);
        setApplyDialog('type_default');
      } catch (error) {
        if (handleGateError(error)) {
          return;
        }
        setErrorMessageKey('errors.generic');
      }
    },
    [handleGateError, isAuthenticated, requestContext, setAccount, showNotificationLoginAlert]
  );

  const confirmApplyDialog = useCallback(async () => {
    const dialog = applyDialog;
    setApplyDialog(null);
    if (dialog === null) {
      return;
    }

    try {
      if (dialog === 'auto_enable') {
        if (pendingDefault) {
          await requestWithMobileAuthRefresh(requestContext, (api) =>
            api.reqAccountNotificationChannelsBulkEnable()
          );
        } else {
          await requestWithMobileAuthRefresh(requestContext, (api) =>
            api.reqAccountNotificationChannelsBulkDisable()
          );
        }
        return;
      }

      if (dialog === 'type_default' && pendingType !== null) {
        await requestWithMobileAuthRefresh(requestContext, (api) =>
          api.reqAccountNotificationChannelsBulkType({
            enabled: pendingDefault,
            type: pendingType,
          })
        );
      }
    } catch (error) {
      if (handleGateError(error)) {
        return;
      }
      setErrorMessageKey('errors.generic');
    }
  }, [applyDialog, handleGateError, pendingDefault, pendingType, requestContext]);

  const handleNotificationPreferenceToggle = useCallback(
    async (params: {
      category: NotificationCategoryEnum;
      channel: 'in_app' | 'push';
      enabled: boolean;
      forceInAppEnabled: boolean;
    }) => {
      setErrorMessageKey(null);

      if (!isAuthenticated) {
        showNotificationLoginAlert();
        return;
      }

      const existing = notificationPreferences.find((row) => row.category === params.category);
      if (existing === undefined) {
        return;
      }

      const nextInAppEnabled =
        params.forceInAppEnabled || params.channel === 'in_app'
          ? params.forceInAppEnabled
            ? true
            : params.enabled
          : existing.in_app_enabled;
      const nextPushEnabled = params.channel === 'push' ? params.enabled : existing.push_enabled;

      if (params.channel === 'push' && params.enabled) {
        const pushProvider = getMobileConfig().pushProvider;
        if (pushProvider === 'fcm') {
          const permissionResult = await requestFcmPermissionAfterUserAction();
          if (!permissionResult.granted) {
            setShowNotificationPermissionHint(true);
            setNotificationPermissionBlocked(!permissionResult.canAskAgain);
            setErrorMessageKey('settings.notifications.permission_required');
            return;
          }

          setShowNotificationPermissionHint(false);
          try {
            await registerFcmDeviceForAccount({ auth: requestContext, locale: selectedLocale });
          } catch (error) {
            console.warn('Failed to register FCM device after permission grant', error);
          }
        } else if (pushProvider === 'unifiedpush') {
          setShowNotificationPermissionHint(false);
          try {
            await registerUnifiedPushDeviceForAccount({
              auth: requestContext,
              locale: selectedLocale,
            });
          } catch (error) {
            console.warn('Failed to register UnifiedPush device after notification enable', error);
          }
        }
      }

      const optimisticPreferences = notificationPreferences.map((row) => {
        if (row.category !== params.category) {
          return row;
        }
        return {
          ...row,
          in_app_enabled: nextInAppEnabled,
          push_enabled: nextPushEnabled,
        };
      });
      setNotificationPreferences(optimisticPreferences);

      try {
        const updated = await notificationsRepository.updatePreferences(requestContext, {
          preferences: [
            {
              category: params.category,
              in_app_enabled: nextInAppEnabled,
              push_enabled: nextPushEnabled,
            },
          ],
        });
        setNotificationPreferences(updated);
      } catch (error) {
        setNotificationPreferences(notificationPreferences);
        if (handleGateError(error)) {
          return;
        }
        setErrorMessageKey('errors.generic');
      }
    },
    [
      handleGateError,
      isAuthenticated,
      notificationPreferences,
      requestContext,
      selectedLocale,
      showNotificationLoginAlert,
    ]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardIntro: {
          gap: settingsCardInnerGap(tokens.spacing),
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.lg,
        },
        cardStack: {
          gap: settingsCardGap(tokens.spacing),
        },
        insetCopy: {
          paddingHorizontal: tokens.spacing.lg,
        },
        permissionHint: {
          gap: tokens.spacing.sm,
          paddingBottom: tokens.spacing.lg,
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.lg,
        },
        preferenceDescription: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
          paddingHorizontal: tokens.spacing.lg,
        },
        preferenceGroupFirst: {
          paddingTop: tokens.spacing.lg,
        },
        preferenceGroupLast: {
          paddingBottom: tokens.spacing.lg,
        },
        preferenceGroupRest: {
          borderTopColor: themeStyles.border.borderColor,
          borderTopWidth: StyleSheet.hairlineWidth,
          marginTop: tokens.spacing.lg,
          paddingTop: tokens.spacing.lg,
        },
        sectionDescription: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
        sectionHeading: {
          color: themeStyles.textPrimary.color,
          fontSize: 16,
          fontWeight: '700',
        },
        typeDefaults: {
          gap: settingsCardInnerGap(tokens.spacing),
          paddingHorizontal: tokens.spacing.lg,
        },
        warningLinkButton: {
          alignSelf: 'flex-start',
          borderColor: themeStyles.border.borderColor,
          borderRadius: tokens.radii.sm,
          borderWidth: 1,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.sm,
        },
        warningLinkButtonText: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
          fontWeight: '600',
        },
        screenError: {
          marginTop: tokens.spacing.sm,
        },
        warningText: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <MobileScreenContainer testID="more-settings-notifications-screen">
      <ConfirmDialog
        body={
          applyDialog === 'type_default'
            ? t('settings.notifications.type_default_apply_body', { count: affectedCount })
            : t('settings.notifications.auto_enable_apply_body', { count: affectedCount })
        }
        cancelLabel={
          applyDialog === 'type_default'
            ? t('settings.notifications.type_default_apply_new_only')
            : t('settings.notifications.auto_enable_apply_new_only')
        }
        cancelTestID="more-settings-notifications-apply-new-only"
        confirmLabel={
          applyDialog === 'type_default'
            ? t('settings.notifications.type_default_apply_all')
            : t('settings.notifications.auto_enable_apply_all')
        }
        confirmTestID="more-settings-notifications-apply-all"
        onCancel={() => {
          setApplyDialog(null);
        }}
        onConfirm={() => {
          void confirmApplyDialog();
        }}
        testID="more-settings-notifications-apply-dialog"
        title={
          applyDialog === 'type_default'
            ? t('settings.notifications.type_default_apply_title')
            : t('settings.notifications.auto_enable_apply_title')
        }
        visible={applyDialog !== null}
      />
      <View style={styles.cardStack}>
        <Card padded={false} testID="more-settings-notification-defaults-card">
          <SettingsSwitchRow
            onValueChange={(nextValue) => {
              void handleAutoEnableOnSubscribeToggle(nextValue);
            }}
            switchTestID="more-settings-notification-auto-enable-on-subscribe-switch"
            testID="more-settings-notification-auto-enable-on-subscribe"
            title={t('settings.notifications.auto_enable_on_subscribe')}
            value={autoEnableOnSubscribe}
          >
            <SettingsRowDescription>
              {t('settings.notifications.auto_enable_on_subscribe_help')}
            </SettingsRowDescription>
          </SettingsSwitchRow>
          <View style={styles.typeDefaults}>
            <Text style={styles.sectionHeading}>
              {t('settings.notifications.type_defaults_section')}
            </Text>
            <Text style={styles.sectionDescription}>
              {t('settings.notifications.type_defaults_section_help')}
            </Text>
          </View>
          {NOTIFICATION_TYPE_ROWS.map((row) => (
            <SettingsSwitchRow
              key={row.type}
              onValueChange={(nextValue) => {
                void handleNotificationTypeDefaultToggle(row.type, nextValue);
              }}
              testID={`more-settings-notification-type-default-${row.type}`}
              title={t(row.labelKey)}
              value={enabledDefaultTypes.has(row.type)}
            />
          ))}
        </Card>
        <Card padded={false} testID="more-settings-notifications-card">
          <View style={styles.cardIntro}>
            <Text style={styles.sectionHeading}>{t('settings.notifications.notifications')}</Text>
            <Text style={styles.sectionDescription}>
              {t('settings.notifications.preference_section_help')}
            </Text>
          </View>
          {NOTIFICATION_PREFERENCE_ROWS.map((row, index) => {
            const preference =
              notificationPreferences.find((candidate) => candidate.category === row.category) ??
              null;
            const inAppEnabled = row.forceInAppEnabled
              ? true
              : (preference?.in_app_enabled ?? true);
            const pushEnabled = preference?.push_enabled ?? false;
            const canTogglePush = isAuthenticated;
            const isFirst = index === 0;
            const isLast = index === NOTIFICATION_PREFERENCE_ROWS.length - 1;

            return (
              <View
                key={row.category}
                style={[
                  isFirst ? styles.preferenceGroupFirst : styles.preferenceGroupRest,
                  isLast && !showNotificationPermissionHint ? styles.preferenceGroupLast : null,
                ]}
              >
                <Text style={styles.preferenceDescription}>{t(row.descriptionKey)}</Text>
                <SettingsSwitchRow
                  disabled={row.forceInAppEnabled}
                  onValueChange={(nextValue) => {
                    void handleNotificationPreferenceToggle({
                      category: row.category,
                      channel: 'in_app',
                      enabled: nextValue,
                      forceInAppEnabled: row.forceInAppEnabled,
                    });
                  }}
                  testID={`more-settings-notification-${row.category}-in-app`}
                  title={t(row.labelKey)}
                  value={inAppEnabled}
                />
                <SettingsSwitchRow
                  disabled={!canTogglePush}
                  onValueChange={(nextValue) => {
                    void handleNotificationPreferenceToggle({
                      category: row.category,
                      channel: 'push',
                      enabled: nextValue,
                      forceInAppEnabled: row.forceInAppEnabled,
                    });
                  }}
                  testID={`more-settings-notification-${row.category}-push`}
                  title={
                    canTogglePush
                      ? t('settings.notifications.preference_push')
                      : t('settings.notifications.preference_push_disabled')
                  }
                  value={pushEnabled}
                />
                {row.category === NotificationCategoryEnum.ProductUpdate ? (
                  <Text style={[styles.warningText, styles.insetCopy]}>
                    {t('settings.notifications.product_update_disable_hint')}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {showNotificationPermissionHint ? (
            <View style={styles.permissionHint}>
              <Text style={styles.warningText} testID="more-settings-notification-permission-hint">
                {t('settings.notifications.permission_required')}
              </Text>
              {notificationPermissionBlocked ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void openSystemNotificationSettings().catch(() => {
                      setErrorMessageKey('errors.generic');
                    });
                  }}
                  style={styles.warningLinkButton}
                  testID="more-settings-open-notification-settings"
                >
                  <Text style={styles.warningLinkButtonText}>
                    {t('settings.notifications.open_system_settings')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      </View>
      {errorMessageKey !== null ? (
        <Text style={[styles.warningText, styles.screenError]} testID="more-settings-error">
          {t(errorMessageKey)}
        </Text>
      ) : null}
    </MobileScreenContainer>
  );
}
