import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { ApiKeyPresetId, ApiKeyResource, CrudAction } from '@podverse/helpers';
import {
  API_KEY_MAX_PER_ACCOUNT,
  formatDateTimeAbbrev,
  membershipPurchaseAction,
  membershipPurchaseMessageKey,
} from '@podverse/helpers';
import { getErrorResponseStatus } from '@podverse/helpers/error';

import { fetchAccountApiKeys, revokeAccountApiKey } from '../../auth/accountApiKeys';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { FormActions } from '../../components/form';
import { Button, Card, ListRow } from '../../components/primitives';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { AuthAwareLoadState } from '../../components/state/AuthAwareLoadState';
import { ListEmpty } from '../../components/state/ListEmpty';
import { getMobileConfig } from '../../config';
import { apiDocsUrl, apiDocsYamlUrl } from '../../config/apiDocsUrl';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import { useAccessTier } from '../../membership/useAccessTier';
import { useMembership } from '../../membership/useMembership';
import type { MoreStackParamList } from '../../navigation';
import { MORE_STACK_ROUTES } from '../../navigation';
import { useOfflineMode } from '../../prefs/offlineMode';
import { settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { ApiKeyListRow, ApiKeyPermissionSummary } from './accountApiKeyRows';
import { apiKeyCreateAccess, toApiKeyListRows, withoutApiKey } from './accountApiKeyRows';

const DETAIL_SEPARATOR = ' · ';

/** Axios errors carry the bearer token on the request config. Log the message only. */
const warnRequestFailure = (label: string, error: unknown): void => {
  console.warn(label, error instanceof Error ? error.message : 'unknown error');
};

export function MoreSettingsDeveloperScreen() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const membership = useMembership();
  const { isTierKnown } = useAccessTier();
  const { goToMembership, openGate } = useMembershipGate();
  const [rows, setRows] = useState<ApiKeyListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyListRow | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [yamlCopied, setYamlCopied] = useState(false);
  const revokingRef = useRef(false);

  const authDeps = useMemo(
    () => ({ accessToken, clearSession, refreshToken, setTokens }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || offlineModeEnabled) {
        return;
      }

      setIsLoading(true);
      setLoadErrorKey(null);
      setActionErrorKey(null);
      setYamlCopied(false);
      let cancelled = false;
      void fetchAccountApiKeys(authDeps)
        .then((keys) => {
          if (!cancelled) {
            setRows(toApiKeyListRows(keys, new Date()));
            setLoadErrorKey(null);
          }
        })
        .catch((error: unknown) => {
          if (getErrorResponseStatus(error) === 401) {
            return;
          }
          warnRequestFailure('[MoreSettingsDeveloperScreen] load failed', error);
          if (!cancelled) {
            setLoadErrorKey('settings.developer.load_error');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [authDeps, offlineModeEnabled, reloadToken, status])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionError: {
          ...typography.body,
          color: tokens.text.danger,
        },
        docsCard: {
          paddingHorizontal: tokens.spacing.lg,
        },
        prose: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        stack: {
          gap: settingsCardInnerGap(tokens.spacing),
        },
      }),
    [themeStyles, tokens]
  );

  const retryLoad = () => {
    setLoadErrorKey(null);
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  };

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

  const presetLabel = (presetId: ApiKeyPresetId): string => {
    switch (presetId) {
      case 'read_only':
        return t('settings.developer.preset_read_only');
      case 'full_access':
        return t('settings.developer.preset_full_access');
    }
  };

  const permissionSummaryLabel = (summary: ApiKeyPermissionSummary): string => {
    switch (summary.kind) {
      case 'preset':
        return presetLabel(summary.presetId);
      case 'custom':
        if (summary.lines.length === 0) {
          return t('settings.developer.preset_custom');
        }
        return summary.lines
          .map((line) => {
            const actions = line.actions.map((action) => actionLabel(action)).join(', ');
            return `${resourceLabel(line.resource)} ${actions}`;
          })
          .join(DETAIL_SEPARATOR);
    }
  };

  const expiryLabel = (row: ApiKeyListRow): string => {
    if (row.isExpired) {
      return t('settings.developer.expired');
    }
    if (row.expiresAt === null) {
      return t('settings.developer.no_expiration');
    }
    return t('settings.developer.expires', {
      date: formatDateTimeAbbrev(row.expiresAt, i18n.language),
    });
  };

  const rowSubtitle = (row: ApiKeyListRow): string =>
    [row.hintLabel, permissionSummaryLabel(row.summary), expiryLabel(row)].join(DETAIL_SEPARATOR);

  const rowMeta = (row: ApiKeyListRow): string => {
    const created = t('settings.developer.created', {
      date: formatDateTimeAbbrev(row.createdAt, i18n.language),
    });
    const used =
      row.lastUsedAt === null
        ? t('settings.developer.never_used')
        : t('settings.developer.last_used', {
            date: formatDateTimeAbbrev(row.lastUsedAt, i18n.language),
          });
    return [created, used].join(DETAIL_SEPARATOR);
  };

  const openApiReference = (href: string) => {
    void Linking.openURL(href).catch((error: unknown) => {
      console.warn(
        '[MoreSettingsDeveloperScreen] could not open the API reference',
        error instanceof Error ? error.message : 'unknown error'
      );
    });
  };

  const copyYamlUrl = (url: string) => {
    void Clipboard.setStringAsync(url)
      .then((didCopy) => {
        if (!didCopy) {
          setYamlCopied(false);
          setActionErrorKey('settings.developer.copy_failed');
          console.warn('[MoreSettingsDeveloperScreen] could not copy the OpenAPI document URL');
          return;
        }
        setActionErrorKey(null);
        setYamlCopied(true);
      })
      .catch((error: unknown) => {
        setYamlCopied(false);
        setActionErrorKey('settings.developer.copy_failed');
        console.warn(
          '[MoreSettingsDeveloperScreen] could not copy the OpenAPI document URL',
          error
        );
      });
  };

  const cancelRevoke = () => {
    if (revokingRef.current) {
      return;
    }
    setRevokeTarget(null);
  };

  const confirmRevoke = async () => {
    if (revokingRef.current || revokeTarget === null) {
      return;
    }

    const row = revokeTarget;
    revokingRef.current = true;
    setRevokingId(row.idText);
    setActionErrorKey(null);
    try {
      await revokeAccountApiKey(authDeps, row.idText);
      setRows((current) => withoutApiKey(current, row.idText));
    } catch (error: unknown) {
      const responseStatus = getErrorResponseStatus(error);
      if (responseStatus === 404) {
        setRows((current) => withoutApiKey(current, row.idText));
        return;
      }
      if (responseStatus === 401) {
        return;
      }
      warnRequestFailure('[MoreSettingsDeveloperScreen] revoke failed', error);
      setActionErrorKey('settings.developer.revoke_error');
    } finally {
      revokingRef.current = false;
      setRevokingId(null);
      setRevokeTarget(null);
    }
  };

  const openCreate = () => {
    const access = apiKeyCreateAccess({
      isExpired: membership.isExpired,
      isMember: membership.isMember,
      isTierKnown,
    });
    switch (access) {
      case 'allowed':
      case 'unknown':
        navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloperCreate);
        return;
      case 'membership_expired':
        openGate('membership_expired');
        return;
      case 'needs_membership':
        setMembershipDialogOpen(true);
        return;
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

  if (status !== 'authenticated') {
    return (
      <MobileScreenContainer testID="more-settings-developer-screen">
        <AuthAwareLoadState
          authMessageKey="authentication.login_required"
          emptyTestID="more-settings-developer-login-required"
          errorKey={null}
          isLoading={false}
          onRetry={retryLoad}
          showAuthRequired
        />
      </MobileScreenContainer>
    );
  }

  if (offlineModeEnabled) {
    return (
      <MobileScreenContainer testID="more-settings-developer-screen">
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="more-settings-developer-offline-unavailable"
        />
      </MobileScreenContainer>
    );
  }

  if (isLoading || loadErrorKey !== null) {
    return (
      <MobileScreenContainer testID="more-settings-developer-screen">
        <AuthAwareLoadState
          errorKey={loadErrorKey}
          errorTestID="more-settings-developer-error"
          isLoading={isLoading}
          loadingTestID="more-settings-developer-loading"
          onRetry={retryLoad}
        />
      </MobileScreenContainer>
    );
  }

  const apiBaseUrl = getMobileConfig().api?.baseUrl ?? null;
  const docsUrl = apiDocsUrl(apiBaseUrl);
  const yamlUrl = apiDocsYamlUrl(apiBaseUrl);
  const atKeyLimit = rows.length >= API_KEY_MAX_PER_ACCOUNT;

  return (
    <MobileScreenContainer testID="more-settings-developer-screen">
      <View style={styles.stack}>
        <Text style={styles.prose}>{t('settings.developer.description')}</Text>
        <Text style={styles.prose}>{t('settings.developer.key_cannot')}</Text>
        {docsUrl !== null && yamlUrl !== null ? (
          <>
            <Card padded={false} style={styles.docsCard}>
              <ListRow
                onPress={() => {
                  openApiReference(docsUrl);
                }}
                subtitle={t('settings.developer.api_reference_hint')}
                testID="more-settings-developer-docs"
                title={t('settings.developer.api_reference')}
              />
            </Card>
            <Card padded={false} style={styles.docsCard}>
              <ListRow
                onPress={() => {
                  copyYamlUrl(yamlUrl);
                }}
                subtitle={t('settings.developer.spec_copy_hint')}
                testID="more-settings-developer-docs-yaml"
                title={t('settings.developer.api_spec')}
              />
            </Card>
          </>
        ) : (
          <Text style={styles.prose} testID="more-settings-developer-docs-unavailable">
            {t('settings.developer.docs_unavailable')}
          </Text>
        )}
        {docsUrl !== null && yamlUrl !== null && yamlCopied ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.prose}
            testID="more-settings-developer-docs-yaml-copied"
          >
            {t('features.copied')}
          </Text>
        ) : null}
        {actionErrorKey !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.actionError}
            testID="more-settings-developer-action-error"
          >
            {t(actionErrorKey)}
          </Text>
        ) : null}
        {rows.length === 0 ? (
          <Text style={styles.prose} testID="more-settings-developer-empty">
            {t('settings.developer.empty')}
          </Text>
        ) : (
          <View>
            {rows.map((row) => (
              <ListRow
                key={row.idText}
                meta={rowMeta(row)}
                subtitle={rowSubtitle(row)}
                testID={`more-settings-developer-key-${row.idText}`}
                title={row.name}
                trailing={
                  <Button
                    accessibilityLabel={t('settings.developer.revoke_aria', { name: row.name })}
                    label={t('settings.developer.revoke')}
                    loading={revokingId === row.idText}
                    onPress={() => {
                      if (revokingRef.current) {
                        return;
                      }
                      setRevokeTarget(row);
                    }}
                    size="sm"
                    testID={`more-settings-developer-revoke-${row.idText}`}
                    variant="outline"
                  />
                }
              />
            ))}
          </View>
        )}
        {atKeyLimit ? (
          <Text style={styles.prose} testID="more-settings-developer-limit">
            {t('settings.developer.limit_reached')}
          </Text>
        ) : (
          <FormActions
            actions={[
              {
                label: t('settings.developer.create'),
                onPress: openCreate,
                testID: 'more-settings-developer-create',
                variant: 'primary',
              },
            ]}
          />
        )}
      </View>
      <ConfirmDialog
        body={t('settings.developer.revoke_body', { name: revokeTarget?.name ?? '' })}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-developer-revoke-cancel"
        confirmLabel={t('settings.developer.revoke')}
        confirmLoading={revokingId !== null}
        confirmTestID="more-settings-developer-revoke-confirm"
        confirmVariant="danger"
        onCancel={cancelRevoke}
        onConfirm={() => {
          void confirmRevoke();
        }}
        testID="more-settings-developer-revoke-dialog"
        title={t('settings.developer.revoke_title')}
        visible={revokeTarget !== null}
      />
      <ConfirmDialog
        body={t('settings.developer.membership_required_body')}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-developer-membership-cancel"
        confirmLabel={membershipConfirmLabel()}
        confirmTestID="more-settings-developer-membership-confirm"
        onCancel={() => {
          setMembershipDialogOpen(false);
        }}
        onConfirm={() => {
          setMembershipDialogOpen(false);
          goToMembership();
        }}
        testID="more-settings-developer-membership-dialog"
        title={t('settings.developer.membership_required')}
        visible={membershipDialogOpen}
      />
    </MobileScreenContainer>
  );
}
