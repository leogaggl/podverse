import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatDateAbbrev,
  membershipPurchaseAction,
  membershipPurchaseMessageKey,
} from '@podverse/helpers';

import { createMobileApiRequestService } from '../../auth/mobileApi';
import { CustomApiNotice } from '../../components/feedback/CustomApiNotice';
import { MembershipFeatureTable } from '../../components/membership/MembershipFeatureTable';
import { TrialLimitationsSheet } from '../../components/membership/TrialLimitationsSheet';
import { Button, Card } from '../../components/primitives';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { SectionHeading } from '../../components/section/SectionHeading';
import { openCheckout } from '../../membership/checkoutEntry';
import { useMembership } from '../../membership/useMembership';
import { useMembershipStandingRefresh } from '../../membership/useMembershipStandingRefresh';
import type { MoreStackParamList } from '../../navigation';
import { MORE_STACK_ROUTES } from '../../navigation';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

/**
 * Membership screen. An active Trial or Premium membership shows its tier and expiry
 * under the stack title. Trial opens its limitations in a sheet. Logged out, the action
 * opens web sign-up. Logged in, the purchase button opens store checkout.
 */

/** The pricing fields this screen renders (subset of the API's membership pricing payload). */
type MembershipPricing = {
  annuallySavingsPercent: number;
  costAnnually: number;
  costMonthly: number;
};

export function MoreMembershipScreen() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { styles: themeStyles, tokens } = useTheme();
  const { expiresAt, isExpired, isLoggedIn, isMember, tier } = useMembership();
  useMembershipStandingRefresh();
  const [pricing, setPricing] = useState<MembershipPricing | null>(null);
  const [trialSheetVisible, setTrialSheetVisible] = useState(false);
  const showsStatus =
    isLoggedIn && isMember && !isExpired && (tier === 'premium' || tier === 'trial');
  const showsExpiryDate = showsStatus && expiresAt !== null;
  const showsTrialLink = showsStatus && tier === 'trial' && expiresAt !== null;

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const api = createMobileApiRequestService();
      if (api === null) {
        return;
      }
      try {
        const response = await api.reqMembershipGetPricing();
        if (isActive && 'data' in response) {
          setPricing({
            annuallySavingsPercent: response.data.annuallySavingsPercent,
            costAnnually: response.data.costAnnually,
            costMonthly: response.data.costMonthly,
          });
        }
      } catch {
        // Pricing is optional; keep the CTA.
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const statusLines = useMemo<string[]>(() => {
    if (!isLoggedIn) {
      return [t('membership.cta_sign_up_text')];
    }
    if (isExpired) {
      return tier === 'trial'
        ? [t('membership.trial_expired_text_line1'), t('membership.trial_expired_text_line2')]
        : [
            t('membership.membership_expired_text_line1'),
            t('membership.membership_expired_text_line2'),
          ];
    }
    return [];
  }, [isExpired, isLoggedIn, t, tier]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardBody: {
          gap: tokens.spacing.base,
          padding: tokens.spacing.lg,
        },
        cta: {
          marginBottom: tokens.spacing['4xl'],
          marginTop: tokens.spacing.sm,
        },
        expiryDate: {
          ...typography.title,
          color: themeStyles.textPrimary.color,
          textAlign: 'center',
        },
        expiryLabel: {
          ...typography.label,
          color: themeStyles.textSecondary.color,
          textAlign: 'center',
        },
        featureSection: {
          marginBottom: tokens.spacing['4xl'],
        },
        priceRow: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        savings: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
        section: {
          gap: tokens.spacing.xs,
          marginBottom: tokens.spacing.lg,
        },
        status: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        statusBlock: {
          alignItems: 'center',
          gap: tokens.spacing.sm,
          marginBottom: tokens.spacing.lg,
        },
        statusTier: {
          ...typography.display,
          textAlign: 'center',
        },
        trialLink: {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
        },
        trialLinkLabel: {
          ...typography.body,
          color: tokens.text.link,
          textAlign: 'center',
          textDecorationLine: 'underline',
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <MobileScreenContainer testID="more-membership-screen">
      <CustomApiNotice />
      {showsStatus ? (
        <View style={styles.statusBlock}>
          <Text
            accessibilityRole="header"
            style={[
              styles.statusTier,
              { color: tier === 'trial' ? tokens.text.warning : tokens.text.accent },
            ]}
            testID="more-membership-status-tier"
          >
            {tier === 'trial' ? t('membership.status_free_trial') : t('membership.premium')}
          </Text>
          {showsExpiryDate && expiresAt !== null ? (
            <>
              <Text style={styles.expiryLabel}>{t('settings.membership.expires_on')}</Text>
              <Text style={styles.expiryDate} testID="more-membership-expires">
                {formatDateAbbrev(expiresAt, i18n.language)}
              </Text>
            </>
          ) : null}
          {showsTrialLink ? (
            <Pressable
              accessibilityLabel={t('membership.trial_limitations_only')}
              accessibilityRole="link"
              onPress={() => {
                setTrialSheetVisible(true);
              }}
              style={styles.trialLink}
              testID="more-membership-trial-limitations-link"
            >
              <Text style={styles.trialLinkLabel}>{t('membership.trial_limitations_only')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {statusLines.length > 0 ? (
        <View style={styles.section} testID="more-membership-status">
          {statusLines.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.status}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {isLoggedIn ? (
        <View style={styles.cta}>
          <Button
            fullWidth
            label={t(
              `membership.${membershipPurchaseMessageKey(
                membershipPurchaseAction({ isLoggedIn, tier })
              )}`
            )}
            onPress={() => {
              navigation.navigate(MORE_STACK_ROUTES.MoreMembershipExtend);
            }}
            size="form"
            testID="more-membership-cta"
            variant="success"
          />
        </View>
      ) : (
        <>
          {pricing !== null ? (
            <View style={styles.section}>
              <Card padded={false} testID="more-membership-pricing">
                <View style={styles.cardBody}>
                  <SectionHeading>{t('membership.premium_membership')}</SectionHeading>
                  <Text style={styles.priceRow}>
                    {`$${pricing.costMonthly}${t('membership.pricing_per_month')}`}
                  </Text>
                  <Text style={styles.priceRow}>
                    {`$${pricing.costAnnually}${t('membership.pricing_per_year')}`}
                  </Text>
                  <Text style={styles.savings}>
                    {t('membership.pricing_save_percent', {
                      percent: pricing.annuallySavingsPercent,
                    })}
                  </Text>
                </View>
              </Card>
            </View>
          ) : null}

          <View style={styles.cta}>
            <Button
              fullWidth
              label={t('authentication.sign_up')}
              onPress={() => {
                void openCheckout({ mode: 'sign_up' });
              }}
              size="form"
              testID="more-membership-cta"
              variant="primary"
            />
          </View>
        </>
      )}

      <View style={styles.featureSection}>
        <MembershipFeatureTable />
      </View>

      <TrialLimitationsSheet
        onClose={() => {
          setTrialSheetVisible(false);
        }}
        visible={trialSheetVisible}
      />
    </MobileScreenContainer>
  );
}
