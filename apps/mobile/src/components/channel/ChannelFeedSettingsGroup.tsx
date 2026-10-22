import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { settingsCardInnerGap } from '../../theme/screenLayout';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { SettingsGroup, SettingsRowDescription } from '../form';
import { Button } from '../primitives/Button';

export type ChannelFeedSettingsGroupProps = {
  isChecking: boolean;
  /** Already translated. Null hides the line. */
  notice: string | null;
  onCheck: () => void;
  statusLines: string[];
  /** Prefix for testIDs (`podcast-detail`, `add-by-rss-home`). */
  testIDPrefix: string;
};

const createStyles = ({ tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    feedInner: {
      gap: settingsCardInnerGap(tokens.spacing),
      padding: tokens.spacing.lg,
    },
    feedStatus: {
      gap: tokens.spacing.xs,
    },
  });

/**
 * RSS Feed card: parse status, Check Feed for Updates, and the notice from the last check.
 *
 * Podcast, album, and artist settings use it, and so does Add by RSS channel settings.
 */
export function ChannelFeedSettingsGroup({
  isChecking,
  notice,
  onCheck,
  statusLines,
  testIDPrefix,
}: ChannelFeedSettingsGroupProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <SettingsGroup testID={`${testIDPrefix}-settings-feed-card`} title={t('info.rss_feed')}>
      <View style={styles.feedInner}>
        {statusLines.length > 0 ? (
          <View style={styles.feedStatus}>
            {statusLines.map((line) => (
              <SettingsRowDescription key={line}>{line}</SettingsRowDescription>
            ))}
          </View>
        ) : null}
        <Button
          fullWidth
          label={t('settings.feed.check_feed_for_updates')}
          loading={isChecking}
          onPress={() => {
            onCheck();
          }}
          size="form"
          testID={`${testIDPrefix}-settings-check-feed`}
          variant="secondary"
        />
        {notice !== null ? (
          <SettingsRowDescription testID={`${testIDPrefix}-settings-feed-notice`}>
            {notice}
          </SettingsRowDescription>
        ) : null}
      </View>
    </SettingsGroup>
  );
}
