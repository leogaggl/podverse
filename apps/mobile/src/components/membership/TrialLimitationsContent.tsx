import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextStyle } from 'react-native';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { getMobileConfig } from '../../config';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { useMembershipComparisonDocument } from './useMembershipComparisonDocument';

type MissingContentBulletProps = {
  emailLinkStyle: TextStyle;
  textStyle: TextStyle;
};

function MissingContentBullet({ emailLinkStyle, textStyle }: MissingContentBulletProps) {
  const { t } = useTranslation();
  const email = getMobileConfig().contactEmail;
  const message = t('membership.trial_limitations_missing_content', { email });
  const emailIndex = email === '' ? -1 : message.indexOf(email);

  if (emailIndex < 0) {
    return (
      <Text style={textStyle} testID="trial-limitations-missing-content">
        {`• ${message}`}
      </Text>
    );
  }

  const before = message.slice(0, emailIndex);
  const after = message.slice(emailIndex + email.length);

  return (
    <Text style={textStyle} testID="trial-limitations-missing-content">
      {`• ${before}`}
      <Text
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(`mailto:${email}`);
        }}
        style={emailLinkStyle}
      >
        {email}
      </Text>
      {after}
    </Text>
  );
}

/**
 * Intro and bullets for Trial limitations. The Membership sheet and the About accordion
 * both render this list.
 */
export function TrialLimitationsContent() {
  const document = useMembershipComparisonDocument();
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bullet: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        emailLink: {
          color: tokens.text.accent,
          textDecorationLine: 'underline',
        },
        limitationIntro: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        limitationList: {
          gap: tokens.spacing.sm,
        },
        limitationPanel: {
          gap: tokens.spacing.base,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <View style={styles.limitationPanel}>
      <Text style={styles.limitationIntro}>{document.trialLimitations.summary}</Text>
      <View style={styles.limitationList}>
        {document.trialLimitations.items.map((item) => (
          <Text key={item} style={styles.bullet}>
            {`• ${item}`}
          </Text>
        ))}
        <MissingContentBullet emailLinkStyle={styles.emailLink} textStyle={styles.bullet} />
      </View>
    </View>
  );
}
