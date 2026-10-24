import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateAbbrev } from '@podverse/helpers';
import { getErrorResponseStatus } from '@podverse/helpers/error';

import {
  endAccountSession,
  endOtherAccountSessions,
  fetchAccountSessions,
} from '../../auth/accountSessions';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { FormActions } from '../../components/form';
import { Button, ListRow } from '../../components/primitives';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { AuthAwareLoadState } from '../../components/state/AuthAwareLoadState';
import { ListEmpty } from '../../components/state/ListEmpty';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import { useOfflineMode } from '../../prefs/offlineMode';
import { formActionsTopGap, settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { AccountSessionRow } from './accountSessionRows';
import {
  onlyCurrentAccountSession,
  toAccountSessionRows,
  withoutAccountSession,
} from './accountSessionRows';

export function MoreSettingsSessionsScreen() {
  const { i18n, t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, clearSession, logout, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const [rows, setRows] = useState<AccountSessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [signOutOthersOpen, setSignOutOthersOpen] = useState(false);
  const [endingIds, setEndingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const endingIdsRef = useRef(new Set<string>());
  const revokingOthersRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || offlineModeEnabled) {
      return;
    }

    setIsLoading(true);
    setLoadErrorKey(null);
    setActionErrorKey(null);
    let cancelled = false;
    void fetchAccountSessions({ accessToken, clearSession, refreshToken, setTokens })
      .then((sessions) => {
        if (!cancelled) {
          setRows(toAccountSessionRows(sessions));
          setLoadErrorKey(null);
        }
      })
      .catch((error: unknown) => {
        if (getErrorResponseStatus(error) === 401) {
          return;
        }
        console.warn('[MoreSettingsSessionsScreen] load failed', error);
        if (!cancelled) {
          setLoadErrorKey('settings.account.sessions.load_error');
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
  }, [accessToken, clearSession, offlineModeEnabled, refreshToken, reloadToken, setTokens, status]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionError: {
          ...typography.body,
          color: tokens.text.danger,
        },
        description: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
        signOutOthers: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        stack: {
          gap: settingsCardInnerGap(tokens.spacing),
        },
      }),
    [themeStyles, tokens]
  );

  const setEnding = (idText: string, ending: boolean) => {
    if (ending) {
      endingIdsRef.current.add(idText);
    } else {
      endingIdsRef.current.delete(idText);
    }
    setEndingIds(new Set(endingIdsRef.current));
  };

  const retryLoad = () => {
    setLoadErrorKey(null);
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  };

  const handleSignOut = async (row: AccountSessionRow) => {
    if (endingIdsRef.current.has(row.idText) || revokingOthersRef.current) {
      return;
    }

    setActionErrorKey(null);
    setEnding(row.idText, true);
    try {
      if (row.isCurrent) {
        await logout();
        return;
      }

      await endAccountSession({ accessToken, clearSession, refreshToken, setTokens }, row.idText);
      setRows((current) => withoutAccountSession(current, row.idText));
    } catch (error: unknown) {
      if (getErrorResponseStatus(error) === 404) {
        setRows((current) => withoutAccountSession(current, row.idText));
        return;
      }
      if (getErrorResponseStatus(error) !== 401) {
        console.warn('[MoreSettingsSessionsScreen] sign out failed', error);
        setActionErrorKey('settings.account.sessions.sign_out_error');
      }
    } finally {
      setEnding(row.idText, false);
    }
  };

  const handleRevokeOthers = async () => {
    if (revokingOthersRef.current || endingIdsRef.current.size > 0) {
      return;
    }

    revokingOthersRef.current = true;
    setIsRevokingOthers(true);
    setActionErrorKey(null);
    try {
      await endOtherAccountSessions({ accessToken, clearSession, refreshToken, setTokens });
      setRows((current) => onlyCurrentAccountSession(current));
      setSignOutOthersOpen(false);
    } catch (error: unknown) {
      setSignOutOthersOpen(false);
      if (getErrorResponseStatus(error) !== 401) {
        console.warn('[MoreSettingsSessionsScreen] sign out others failed', error);
        setActionErrorKey('settings.account.sessions.sign_out_all_other_error');
      }
    } finally {
      revokingOthersRef.current = false;
      setIsRevokingOthers(false);
    }
  };

  const titleForRow = (row: AccountSessionRow): string => {
    if (row.deviceLabel !== null) {
      return row.deviceLabel;
    }
    switch (row.clientType) {
      case 'web':
        return t('settings.account.sessions.client_type_web');
      case 'mobile':
        return t('settings.account.sessions.client_type_mobile');
    }
  };

  if (status !== 'authenticated') {
    return (
      <MobileScreenContainer testID="more-settings-sessions-screen">
        <AuthAwareLoadState
          authMessageKey="settings.account.sessions.login_required"
          emptyTestID="more-settings-sessions-login-required"
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
      <MobileScreenContainer testID="more-settings-sessions-screen">
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="more-settings-sessions-offline-unavailable"
        />
      </MobileScreenContainer>
    );
  }

  if (isLoading || loadErrorKey !== null) {
    return (
      <MobileScreenContainer testID="more-settings-sessions-screen">
        <AuthAwareLoadState
          errorKey={loadErrorKey}
          errorTestID="more-settings-sessions-error"
          isLoading={isLoading}
          loadingTestID="more-settings-sessions-loading"
          onRetry={retryLoad}
        />
      </MobileScreenContainer>
    );
  }

  const hasOtherSession = rows.some((row) => !row.isCurrent);

  return (
    <MobileScreenContainer testID="more-settings-sessions-screen">
      <View style={styles.stack}>
        <Text style={styles.description}>{t('settings.account.sessions.description')}</Text>
        {actionErrorKey !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.actionError}
            testID="more-settings-sessions-action-error"
          >
            {t(actionErrorKey)}
          </Text>
        ) : null}
        <View>
          {rows.map((row) => {
            const title = titleForRow(row);
            return (
              <ListRow
                key={row.idText}
                subtitle={
                  row.isCurrent
                    ? t('settings.account.sessions.this_device')
                    : t('settings.account.sessions.last_used', {
                        date: formatDateAbbrev(row.lastSeenAt, i18n.language),
                      })
                }
                testID={
                  row.isCurrent
                    ? 'more-settings-session-current'
                    : `more-settings-session-${row.idText}`
                }
                title={title}
                trailing={
                  <Button
                    accessibilityLabel={t('settings.account.sessions.sign_out_device_aria', {
                      device: title,
                    })}
                    label={t('settings.account.sessions.sign_out')}
                    loading={endingIds.has(row.idText)}
                    onPress={() => {
                      void handleSignOut(row);
                    }}
                    size="sm"
                    testID={`more-settings-session-sign-out-${row.idText}`}
                    variant="outline"
                  />
                }
              />
            );
          })}
        </View>
      </View>
      {hasOtherSession ? (
        <FormActions
          actions={[
            {
              label: t('settings.account.sessions.sign_out_all_other'),
              loading: isRevokingOthers,
              onPress: () => {
                if (revokingOthersRef.current || endingIdsRef.current.size > 0) {
                  return;
                }
                setSignOutOthersOpen(true);
              },
              testID: 'more-settings-sessions-sign-out-others',
              variant: 'danger',
            },
          ]}
          style={styles.signOutOthers}
        />
      ) : null}
      <ConfirmDialog
        body={t('settings.account.sessions.sign_out_all_other_body')}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-sessions-sign-out-others-cancel"
        confirmLabel={t('settings.account.sessions.sign_out')}
        confirmTestID="more-settings-sessions-sign-out-others-confirm"
        onCancel={() => {
          setSignOutOthersOpen(false);
        }}
        onConfirm={() => {
          void handleRevokeOthers();
        }}
        testID="more-settings-sessions-sign-out-others-dialog"
        title={t('settings.account.sessions.sign_out_all_other')}
        visible={signOutOthersOpen}
      />
    </MobileScreenContainer>
  );
}
