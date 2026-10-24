import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stopPropagation } from '../../lib/gesture/stopPropagation';
import { useTheme } from '../../theme/useTheme';
import { AppOverlay, OverlayPanel, OverlayScrim } from '../overlay';
import { HeaderBarAction } from '../screen/HeaderBarAction';
import { TrialLimitationsContent } from './TrialLimitationsContent';
import { useMembershipComparisonDocument } from './useMembershipComparisonDocument';

type TrialLimitationsSheetProps = {
  onClose: () => void;
  visible: boolean;
};

/**
 * Trial limitations in a bottom sheet opened from the Membership status block.
 */
export function TrialLimitationsSheet({ onClose, visible }: TrialLimitationsSheetProps) {
  const { t } = useTranslation();
  const document = useMembershipComparisonDocument();
  const { styles: themeStyles, tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'flex-end',
        },
        header: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.sm,
          justifyContent: 'space-between',
        },
        scrim: {
          ...StyleSheet.absoluteFill,
        },
        scroll: {
          marginTop: tokens.spacing.md,
          maxHeight: 480,
        },
        sheet: {
          backgroundColor: tokens.background.primary,
          borderTopLeftRadius: tokens.radii.md,
          borderTopRightRadius: tokens.radii.md,
          padding: tokens.spacing.lg,
          paddingBottom: tokens.spacing.lg + insets.bottom,
        },
        title: {
          color: themeStyles.textPrimary.color,
          flexShrink: 1,
          fontSize: 18,
          fontWeight: '700',
        },
      }),
    [insets.bottom, themeStyles, tokens]
  );

  return (
    <AppOverlay animation="slide" onRequestClose={onClose} visible={visible}>
      <Pressable
        accessible={false}
        onPress={onClose}
        style={styles.backdrop}
        testID="more-membership-trial-limitations-backdrop"
      >
        <OverlayScrim pointerEvents="none" style={styles.scrim} />
        <OverlayPanel>
          <Pressable
            accessibilityViewIsModal
            accessible={false}
            onPress={stopPropagation}
            style={styles.sheet}
            testID="more-membership-trial-limitations-sheet"
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {document.trialLimitations.title}
              </Text>
              <HeaderBarAction
                accessibilityLabel={t('misc.close')}
                icon="close"
                onPress={onClose}
                testID="more-membership-trial-limitations-close"
              />
            </View>
            <ScrollView style={styles.scroll}>
              <TrialLimitationsContent />
            </ScrollView>
          </Pressable>
        </OverlayPanel>
      </Pressable>
    </AppOverlay>
  );
}
