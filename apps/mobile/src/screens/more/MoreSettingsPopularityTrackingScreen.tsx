import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOPopularityTrackingAgreement } from '@podverse/helpers';
import {
  isPopularityTrackingAllowed,
  isPopularityTrackingOptOutDestructive,
} from '@podverse/helpers';

import { useAuth } from '../../auth/AuthProvider';
import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import { syncAllowListenStatsToAccountSettings } from '../../auth/syncAccountPrefs';
import { CopyMarkdown } from '../../components/content/CopyMarkdown';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { SettingsSwitchRow } from '../../components/form';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { LoadingSection } from '../../components/state/LoadingSection';
import { RetryableError } from '../../components/state/RetryableError';
import { PopularityTrackingAgreementBody } from '../../popularityTracking/PopularityTrackingAgreementBody';
import { getPopularityTrackingCurrentVersion } from '../../popularityTracking/popularityTrackingGate';
import { settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { TasteProfileSections } from './TasteProfileSections';

export function MoreSettingsPopularityTrackingScreen() {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, account, clearSession, refreshToken, setAccount, setTokens } = useAuth();
  const [agreement, setAgreement] = useState<DTOPopularityTrackingAgreement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optOutConfirmVisible, setOptOutConfirmVisible] = useState(false);
  const currentVersion = agreement?.version ?? getPopularityTrackingCurrentVersion();
  const allowed = isPopularityTrackingAllowed(account?.account_settings, currentVersion);
  const optOutDestructive = isPopularityTrackingOptOutDestructive(account?.account_settings);

  const loadAgreement = useCallback(() => {
    setIsLoading(true);
    setErrorKey(null);
    let cancelled = false;
    void requestWithMobileAuthRefresh(
      { accessToken, clearSession, refreshToken, setTokens },
      (api) => api.reqLegalPopularityTracking()
    )
      .then((data) => {
        if (!cancelled) {
          setAgreement(data);
          setErrorKey(null);
        }
      })
      .catch((error: unknown) => {
        console.warn('[MoreSettingsPopularityTrackingScreen] load failed', error);
        if (!cancelled) {
          setErrorKey('errors.generic');
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
  }, [accessToken, clearSession, refreshToken, setTokens]);

  useEffect(() => {
    const cleanup = loadAgreement();
    return cleanup;
  }, [loadAgreement]);

  const handleDecision = useCallback(
    async (accepted: boolean) => {
      await syncAllowListenStatsToAccountSettings({
        accepted,
        auth: { accessToken, clearSession, refreshToken, setTokens },
        setAccount,
      });
    },
    [accessToken, clearSession, refreshToken, setAccount, setTokens]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        disclosure: {
          marginTop: settingsCardInnerGap(tokens.spacing),
        },
        moreInfo: {
          justifyContent: 'center',
          minHeight: 44,
        },
        moreInfoLabel: {
          ...typography.body,
          color: tokens.text.link,
        },
        summary: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
        },
      }),
    [themeStyles, tokens]
  );

  const infoLabel = infoOpen ? t('misc.hide_info') : t('misc.more_info');

  return (
    <MobileScreenContainer testID="more-settings-popularity-tracking-screen">
      <Text style={styles.summary}>{t('popularity_tracking.summary')}</Text>
      <SettingsSwitchRow
        inset={false}
        onValueChange={(next) => {
          if (!next) {
            setReviewing(false);
            if (optOutDestructive) {
              setOptOutConfirmVisible(true);
              return;
            }
            void handleDecision(false);
            return;
          }
          setReviewing(true);
        }}
        switchTestID="more-settings-popularity-tracking-switch"
        testID="more-settings-popularity-tracking-row"
        title={t('popularity_tracking.title')}
        value={allowed || reviewing}
      />
      <Pressable
        accessibilityLabel={infoLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: infoOpen }}
        onPress={() => {
          setInfoOpen((open) => !open);
        }}
        style={styles.moreInfo}
        testID="more-settings-popularity-tracking-more-info"
      >
        <Text style={styles.moreInfoLabel}>{infoLabel}</Text>
      </Pressable>
      {reviewing ? (
        <View style={styles.disclosure}>
          <PopularityTrackingAgreementBody
            accordionTestID="popularity-tracking-settings-full-agreement"
            agreement={agreement}
            errorKey={errorKey}
            isLoading={isLoading}
            noTestID="popularity-tracking-settings-no"
            onDecision={(accepted) => {
              setReviewing(false);
              if (!accepted && optOutDestructive) {
                setOptOutConfirmVisible(true);
                return;
              }
              void handleDecision(accepted);
            }}
            onRetry={loadAgreement}
            yesTestID="popularity-tracking-settings-yes"
          />
        </View>
      ) : null}
      {!reviewing && infoOpen ? (
        <View style={styles.disclosure}>
          {isLoading ? <LoadingSection testID="popularity-tracking-settings-info-loading" /> : null}
          {!isLoading && errorKey !== null ? (
            <RetryableError
              errorKey={errorKey}
              onRetry={loadAgreement}
              testID="popularity-tracking-settings-info-error"
            />
          ) : null}
          {!isLoading && errorKey === null && agreement !== null ? (
            <CopyMarkdown markdown={agreement.markdown} />
          ) : null}
        </View>
      ) : null}
      {account !== null ? <TasteProfileSections /> : null}
      <ConfirmDialog
        body={t('popularity_tracking.opt_out_confirm_body')}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-popularity-tracking-opt-out-cancel"
        confirmLabel={t('popularity_tracking.opt_out_confirm_action')}
        confirmTestID="more-settings-popularity-tracking-opt-out-confirm"
        confirmVariant="danger"
        onCancel={() => {
          setOptOutConfirmVisible(false);
        }}
        onConfirm={() => {
          setOptOutConfirmVisible(false);
          void handleDecision(false);
        }}
        testID="more-settings-popularity-tracking-opt-out-dialog"
        title={t('popularity_tracking.opt_out_confirm_title')}
        visible={optOutConfirmVisible}
      />
    </MobileScreenContainer>
  );
}
