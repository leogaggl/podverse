import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOTasteProfileAgreement } from '@podverse/helpers';
import {
  isTasteProfileConsentOptOutDestructive,
  isTasteProfileTrackingAllowed,
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
import { mobileBrandName } from '../../lib/mobileBrandName';
import { TasteProfileAgreementBody } from '../../tasteProfileConsent/TasteProfileAgreementBody';
import { getTasteProfileAgreementCurrentVersion } from '../../tasteProfileConsent/tasteProfileConsentGate';
import { settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { TasteProfileSections } from './TasteProfileSections';

export function MoreSettingsTasteProfileScreen() {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, account, clearSession, refreshToken, setAccount, setTokens } = useAuth();
  const [agreement, setAgreement] = useState<DTOTasteProfileAgreement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optOutConfirmVisible, setOptOutConfirmVisible] = useState(false);
  const currentVersion = agreement?.version ?? getTasteProfileAgreementCurrentVersion();
  const allowed = isTasteProfileTrackingAllowed(account?.account_settings, currentVersion);
  const optOutDestructive = isTasteProfileConsentOptOutDestructive(account?.account_settings);

  const loadAgreement = useCallback(() => {
    setIsLoading(true);
    setErrorKey(null);
    let cancelled = false;
    void requestWithMobileAuthRefresh(
      { accessToken, clearSession, refreshToken, setTokens },
      (api) => api.reqLegalTasteProfileAgreement()
    )
      .then((data) => {
        if (!cancelled) {
          setAgreement(data);
          setErrorKey(null);
        }
      })
      .catch((error: unknown) => {
        console.warn('[MoreSettingsTasteProfileScreen] load failed', error);
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
    <MobileScreenContainer testID="more-settings-taste-profile-screen">
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
        switchTestID="more-settings-taste-profile-consent-switch"
        testID="more-settings-taste-profile-consent-row"
        title={t('taste_profile.title')}
        value={allowed || reviewing}
      />
      <Text style={styles.summary}>
        {t('taste_profile_consent.summary', { brand_name: mobileBrandName() })}
      </Text>
      <Pressable
        accessibilityLabel={infoLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: infoOpen }}
        onPress={() => {
          setInfoOpen((open) => !open);
        }}
        style={styles.moreInfo}
        testID="more-settings-taste-profile-consent-more-info"
      >
        <Text style={styles.moreInfoLabel}>{infoLabel}</Text>
      </Pressable>
      {reviewing ? (
        <View style={styles.disclosure}>
          <TasteProfileAgreementBody
            accordionTestID="taste-profile-consent-settings-full-agreement"
            agreement={agreement}
            errorKey={errorKey}
            isLoading={isLoading}
            noTestID="taste-profile-consent-settings-no"
            onDecision={(accepted) => {
              setReviewing(false);
              if (!accepted && optOutDestructive) {
                setOptOutConfirmVisible(true);
                return;
              }
              void handleDecision(accepted);
            }}
            onRetry={loadAgreement}
            yesTestID="taste-profile-consent-settings-yes"
          />
        </View>
      ) : null}
      {!reviewing && infoOpen ? (
        <View style={styles.disclosure}>
          {isLoading ? (
            <LoadingSection testID="taste-profile-consent-settings-info-loading" />
          ) : null}
          {!isLoading && errorKey !== null ? (
            <RetryableError
              errorKey={errorKey}
              onRetry={loadAgreement}
              testID="taste-profile-consent-settings-info-error"
            />
          ) : null}
          {!isLoading && errorKey === null && agreement !== null ? (
            <CopyMarkdown markdown={agreement.markdown} />
          ) : null}
        </View>
      ) : null}
      {account !== null ? <TasteProfileSections /> : null}
      <ConfirmDialog
        body={t('taste_profile_consent.opt_out_confirm_body')}
        cancelLabel={t('misc.cancel')}
        cancelTestID="more-settings-taste-profile-consent-opt-out-cancel"
        confirmLabel={t('taste_profile_consent.opt_out_confirm_action')}
        confirmTestID="more-settings-taste-profile-consent-opt-out-confirm"
        confirmVariant="danger"
        onCancel={() => {
          setOptOutConfirmVisible(false);
        }}
        onConfirm={() => {
          setOptOutConfirmVisible(false);
          void handleDecision(false);
        }}
        testID="more-settings-taste-profile-consent-opt-out-dialog"
        title={t('taste_profile_consent.opt_out_confirm_title')}
        visible={optOutConfirmVisible}
      />
    </MobileScreenContainer>
  );
}
