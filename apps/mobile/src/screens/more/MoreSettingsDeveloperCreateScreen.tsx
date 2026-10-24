import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { ApiKeyPresetId, ApiKeyResource, CrudAction } from '@podverse/helpers';
import {
  API_KEY_ERROR_CODES,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_RESOURCES,
  apiKeyPermissionsForPreset,
  apiKeyPermissionsGrantSupported,
  CRUD_ACTIONS,
  membershipPurchaseAction,
  membershipPurchaseMessageKey,
} from '@podverse/helpers';
import { getErrorResponseBodyCode, getErrorResponseStatus } from '@podverse/helpers/error';

import { createAccountApiKey } from '../../auth/accountApiKeys';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { HelperNote } from '../../components/feedback/HelperNote';
import type { OptionChipOption } from '../../components/form';
import {
  FormActions,
  FormField,
  OptionChipGroup,
  SettingsGroup,
  SettingsOptionNavRow,
  TextField,
} from '../../components/form';
import { CheckboxRow } from '../../components/primitives/CheckboxMark';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { AuthAwareLoadState } from '../../components/state/AuthAwareLoadState';
import { ListEmpty } from '../../components/state/ListEmpty';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import { handleRateLimitMessage } from '../../lib/rateLimit/handleRateLimitMessage';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import { useAccessTier } from '../../membership/useAccessTier';
import { useMembership } from '../../membership/useMembership';
import type { MoreStackParamList } from '../../navigation';
import { MORE_STACK_ROUTES } from '../../navigation';
import { useOfflineMode } from '../../prefs/offlineMode';
import { settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ApiKeyExpirationChoice } from './accountApiKeyRows';
import {
  apiKeyCreateAccess,
  apiKeyPermissionCellKind,
  apiKeyPermissionChecked,
  toApiKeyCreateBody,
  toggleApiKeyPermission,
} from './accountApiKeyRows';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSettingsDeveloperCreate'>;

type PresetChoice = ApiKeyPresetId | 'custom';

/** Same edge as the checkbox box, so a dash lines up with the checks in this column. */
const PERMISSION_SLOT_SIZE = 22;

/** Axios errors carry the bearer token on the request config. Log the message only. */
const warnCreateFailure = (error: unknown): void => {
  console.warn(
    '[MoreSettingsDeveloperCreateScreen] create failed',
    error instanceof Error ? error.message : 'unknown error'
  );
};

const createStyles = ({ styles: themeStyles, tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    action: {
      ...typography.body,
      color: themeStyles.textPrimary.color,
      flex: 1,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    dash: {
      ...typography.body,
      color: themeStyles.textSecondary.color,
      includeFontPadding: false,
    },
    error: {
      ...typography.body,
      color: tokens.text.danger,
    },
    help: {
      ...typography.body,
      color: themeStyles.textSecondary.color,
    },
    prose: {
      ...typography.prose,
      color: themeStyles.textPrimary.color,
    },
    resourceBody: {
      gap: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: tokens.spacing.lg,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: tokens.spacing.md,
    },
    slot: {
      alignItems: 'center',
      height: PERMISSION_SLOT_SIZE,
      justifyContent: 'center',
      width: PERMISSION_SLOT_SIZE,
    },
    stack: {
      gap: settingsCardInnerGap(tokens.spacing),
    },
    token: {
      ...typography.body,
      color: themeStyles.textPrimary.color,
    },
  });

type PermissionCellProps = {
  action: CrudAction;
  actionLabel: string;
  checked: boolean;
  onToggle: () => void;
  resource: ApiKeyResource;
  resourceLabel: string;
  unavailableLabel: string;
};

function ApiKeyPermissionCell({
  action,
  actionLabel,
  checked,
  onToggle,
  resource,
  resourceLabel,
  unavailableLabel,
}: PermissionCellProps) {
  const styles = useThemedStyles(createStyles);
  const testID = `more-settings-developer-permission-${resource}-${action}`;
  const kind = apiKeyPermissionCellKind(resource, action);

  switch (kind) {
    case 'checkbox':
      return (
        <CheckboxRow
          accessibilityLabel={`${resourceLabel}, ${actionLabel}`}
          checked={checked}
          label={actionLabel}
          onPress={onToggle}
          testID={testID}
        />
      );
    case 'unsupported':
      return (
        <View
          accessibilityLabel={unavailableLabel}
          accessibilityRole="image"
          accessible
          style={styles.row}
          testID={testID}
        >
          <View style={styles.slot}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.dash}
            >
              —
            </Text>
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.action}
          >
            {actionLabel}
          </Text>
        </View>
      );
  }
}

const expirationChoiceLabel = (
  choice: ApiKeyExpirationChoice,
  translate: (key: string) => string
): string => {
  switch (choice) {
    case '30':
      return translate('settings.developer.expiration_30');
    case '90':
      return translate('settings.developer.expiration_90');
    case '365':
      return translate('settings.developer.expiration_365');
    case 'none':
      return translate('settings.developer.no_expiration');
  }
};

export function MoreSettingsDeveloperCreateScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const membership = useMembership();
  const { isTierKnown } = useAccessTier();
  const { goToMembership, handleGateError, openGate } = useMembershipGate();
  const styles = useThemedStyles(createStyles);
  const expiresIn = route.params?.expiresIn ?? '90';
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(() => apiKeyPermissionsForPreset('read_only'));
  const [presetChoice, setPresetChoice] = useState<PresetChoice>('read_only');
  /** The secret for this visit. Leaving the screen unmounts it. It is not stored on the device. */
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membershipDialogVisible, setMembershipDialogVisible] = useState(false);
  const submittingRef = useRef(false);

  const authDeps = useMemo(
    () => ({ accessToken, clearSession, refreshToken, setTokens }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  const resourceLabel = (resource: ApiKeyResource): string => {
    switch (resource) {
      case 'account':
        return t('settings.developer.resources.account');
      case 'settings':
        return t('settings.developer.resources.settings');
      case 'subscriptions':
        return t('settings.developer.resources.subscriptions');
      case 'add_by_rss':
        return t('settings.developer.resources.add_by_rss');
      case 'playlists':
        return t('settings.developer.resources.playlists');
      case 'queue':
        return t('settings.developer.resources.queue');
      case 'history':
        return t('settings.developer.resources.history');
      case 'clips':
        return t('settings.developer.resources.clips');
      case 'notifications':
        return t('settings.developer.resources.notifications');
    }
  };

  const resourceHelp = (resource: ApiKeyResource): string => {
    switch (resource) {
      case 'account':
        return t('settings.developer.resources_help.account');
      case 'settings':
        return t('settings.developer.resources_help.settings');
      case 'subscriptions':
        return t('settings.developer.resources_help.subscriptions');
      case 'add_by_rss':
        return t('settings.developer.resources_help.add_by_rss');
      case 'playlists':
        return t('settings.developer.resources_help.playlists');
      case 'queue':
        return t('settings.developer.resources_help.queue');
      case 'history':
        return t('settings.developer.resources_help.history');
      case 'clips':
        return t('settings.developer.resources_help.clips');
      case 'notifications':
        return t('settings.developer.resources_help.notifications');
    }
  };

  const actionLabel = (action: CrudAction): string => {
    switch (action) {
      case 'create':
        return t('settings.developer.actions.create');
      case 'read':
        return t('settings.developer.actions.read');
      case 'update':
        return t('settings.developer.actions.update');
      case 'delete':
        return t('settings.developer.actions.delete');
    }
  };

  const membershipConfirmLabel = (): string => {
    const messageKey = membershipPurchaseMessageKey(membershipPurchaseAction(membership));
    switch (messageKey) {
      case 'buy_membership':
        return t('membership.buy_membership');
      case 'extend_my_membership':
        return t('membership.extend_my_membership');
      case 'gate.sign_up':
        return t('membership.gate.sign_up');
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const access = apiKeyCreateAccess({
      isExpired: membership.isExpired,
      isMember: membership.isMember,
      isTierKnown,
    });
    switch (access) {
      case 'membership_expired':
        openGate('membership_expired');
        return;
      case 'needs_membership':
        setMembershipDialogVisible(true);
        return;
      case 'unknown':
      case 'allowed':
        break;
    }

    if (name.trim() === '' || !apiKeyPermissionsGrantSupported(permissions)) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createAccountApiKey(
        authDeps,
        toApiKeyCreateBody({ expiresIn, name, permissions })
      );
      setToken(created.token);
      navigation.setOptions({ title: t('settings.developer.created_title') });
    } catch (error: unknown) {
      const rateLimitText = handleRateLimitMessage(error, t);
      if (rateLimitText !== null) {
        setFormError(rateLimitText);
        return;
      }
      if (handleGateError(error)) {
        return;
      }
      if (getErrorResponseStatus(error) === 401) {
        return;
      }
      const code = getErrorResponseBodyCode(error);
      if (code === API_KEY_ERROR_CODES.permissionsEmpty) {
        setFormError(t('settings.developer.permissions_empty'));
        return;
      }
      if (code === API_KEY_ERROR_CODES.limitReached) {
        setFormError(t('settings.developer.limit_reached'));
        return;
      }
      warnCreateFailure(error);
      setFormError(t('settings.developer.create_error'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const copyToken = () => {
    if (token === null) {
      return;
    }
    void Clipboard.setStringAsync(token)
      .then((didCopy) => {
        if (!didCopy) {
          setCopied(false);
          setFormError(t('settings.developer.copy_failed'));
          return;
        }
        setFormError(null);
        setCopied(true);
      })
      .catch(() => {
        setCopied(false);
        setFormError(t('settings.developer.copy_failed'));
      });
  };

  if (status !== 'authenticated') {
    return (
      <MobileScreenContainer testID="more-settings-developer-create-screen">
        <AuthAwareLoadState
          authMessageKey="authentication.login_required"
          emptyTestID="more-settings-developer-create-login-required"
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
      <MobileScreenContainer testID="more-settings-developer-create-screen">
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="more-settings-developer-create-offline-unavailable"
        />
      </MobileScreenContainer>
    );
  }

  const presetOptions: readonly OptionChipOption<PresetChoice>[] = [
    {
      label: t('settings.developer.preset_read_only'),
      testID: 'more-settings-developer-preset-read-only',
      value: 'read_only',
    },
    {
      label: t('settings.developer.preset_full_access'),
      testID: 'more-settings-developer-preset-full-access',
      value: 'full_access',
    },
    {
      label: t('settings.developer.preset_custom'),
      testID: 'more-settings-developer-preset-custom',
      value: 'custom',
    },
  ];
  const grantSupported = apiKeyPermissionsGrantSupported(permissions);
  const copyLabel = copied ? t('features.copied') : t('features.copy');

  const onPresetChange = (value: PresetChoice) => {
    setPresetChoice(value);
    switch (value) {
      case 'read_only':
      case 'full_access':
        setPermissions(apiKeyPermissionsForPreset(value));
        return;
      case 'custom':
        return;
    }
  };

  const formErrorText =
    formError !== null ? (
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={styles.error}
        testID="more-settings-developer-error"
      >
        {formError}
      </Text>
    ) : null;

  return (
    <MobileScreenContainer
      automaticallyAdjustKeyboardInsets
      testID="more-settings-developer-create-screen"
    >
      {token === null ? (
        <View style={styles.stack}>
          <TextField
            accessibilityLabel={t('settings.developer.name')}
            autoCorrect={false}
            eyebrow={t('settings.developer.name')}
            maxLength={API_KEY_NAME_MAX_LENGTH}
            onChangeText={setName}
            placeholder={t('settings.developer.name_placeholder')}
            testID="more-settings-developer-name"
            value={name}
          />
          <FormField label={t('settings.developer.presets')}>
            <OptionChipGroup
              onChange={onPresetChange}
              options={presetOptions}
              testID="more-settings-developer-presets"
              value={presetChoice}
            />
          </FormField>
          <HelperNote
            message={t('settings.developer.key_cannot')}
            testID="more-settings-developer-preset-help"
          />
          {presetChoice === 'custom' ? (
            <View>
              {API_KEY_RESOURCES.map((resource, index) => {
                const label = resourceLabel(resource);
                return (
                  <SettingsGroup
                    key={resource}
                    spaced={index > 0}
                    testID={`more-settings-developer-resource-${resource}`}
                    title={label}
                  >
                    <View style={styles.resourceBody}>
                      <Text
                        style={styles.help}
                        testID={`more-settings-developer-resource-help-${resource}`}
                      >
                        {resourceHelp(resource)}
                      </Text>
                      {CRUD_ACTIONS.map((action) => {
                        const labelForAction = actionLabel(action);
                        return (
                          <ApiKeyPermissionCell
                            key={action}
                            action={action}
                            actionLabel={labelForAction}
                            checked={apiKeyPermissionChecked(permissions, resource, action)}
                            onToggle={() => {
                              setPermissions((current) =>
                                toggleApiKeyPermission(current, resource, action)
                              );
                            }}
                            resource={resource}
                            resourceLabel={label}
                            unavailableLabel={t('settings.developer.action_unavailable', {
                              action: labelForAction,
                              resource: label,
                            })}
                          />
                        );
                      })}
                    </View>
                  </SettingsGroup>
                );
              })}
            </View>
          ) : null}
          <SettingsOptionNavRow
            description={t('settings.developer.expiration_help')}
            onPress={() => {
              navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloperExpiration, {
                expiresIn,
              });
            }}
            testID="more-settings-developer-expiration"
            title={t('settings.developer.expiration')}
            valueLabel={expirationChoiceLabel(expiresIn, t)}
          />
          {presetChoice === 'custom' && !grantSupported ? (
            <Text style={styles.error} testID="more-settings-developer-permissions-empty">
              {t('settings.developer.permissions_empty')}
            </Text>
          ) : null}
          {formErrorText}
          <FormActions
            actions={[
              {
                disabled: name.trim() === '' || !grantSupported,
                label: t('settings.developer.create'),
                loading: isSubmitting,
                onPress: () => {
                  void handleSubmit();
                },
                testID: 'more-settings-developer-submit',
                variant: 'primary',
              },
            ]}
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={styles.prose}>{t('settings.developer.shown_once')}</Text>
          <Text
            accessibilityLabel={t('settings.developer.token_label')}
            accessibilityValue={{ text: token }}
            selectable
            style={styles.token}
            testID="more-settings-developer-token"
          >
            {token}
          </Text>
          {formErrorText}
          <FormActions
            actions={[
              {
                label: t('misc.done'),
                onPress: () => {
                  navigation.goBack();
                },
                testID: 'more-settings-developer-done',
                variant: 'outline',
              },
              {
                accessibilityLabel: copyLabel,
                label: copyLabel,
                onPress: copyToken,
                testID: 'more-settings-developer-copy',
                variant: 'primary',
              },
            ]}
          />
        </View>
      )}
      <ConfirmDialog
        body={t('settings.developer.membership_required_body')}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-developer-create-membership-cancel"
        confirmLabel={membershipConfirmLabel()}
        confirmTestID="more-settings-developer-create-membership-confirm"
        onCancel={() => {
          setMembershipDialogVisible(false);
        }}
        onConfirm={() => {
          setMembershipDialogVisible(false);
          goToMembership();
        }}
        testID="more-settings-developer-create-membership-dialog"
        title={t('settings.developer.membership_required')}
        visible={membershipDialogVisible}
      />
    </MobileScreenContainer>
  );
}
