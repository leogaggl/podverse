import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { DTOChannel } from '@podverse/helpers';

import { requestWithMobileAuthRefresh } from '../../auth';
import { useAuth } from '../../auth/AuthProvider';
import type { ChannelNotificationsState } from '../../hooks/useChannelNotifications';
import { NOTIFICATION_TYPE_ROWS } from '../../lib/notifications/notificationTypeRows';
import { handleRateLimitMessage } from '../../lib/rateLimit/handleRateLimitMessage';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import {
  BottomChromeScrollSpacer,
  useBottomChromeScrollIndicatorInsets,
} from '../../theme/bottomChromeOverlayInset';
import { screenBodyInsets, settingsCardInnerGap } from '../../theme/screenLayout';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { ConfirmDialog } from '../feedback/ConfirmDialog';
import {
  SettingsDependentGroup,
  SettingsGroup,
  SettingsRowDescription,
  SettingsSwitchRow,
} from '../form';
import { ChannelFeedSettingsGroup } from './ChannelFeedSettingsGroup';
import { useFeedParseStatusLines } from './useFeedParseStatusLines';

export type ChannelSettingsPaneProps = {
  channel: DTOChannel | null;
  notifications: ChannelNotificationsState;
  /**
   * Prefix for testIDs (`podcast-detail`, `album-detail`, `artist-detail`) so each screen keeps
   * its own Maestro locators.
   */
  testIDPrefix: string;
};

const createStyles = ({ tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    feedInner: {
      gap: settingsCardInnerGap(tokens.spacing),
      padding: tokens.spacing.lg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      ...screenBodyInsets(tokens.spacing),
      paddingBottom: tokens.spacing.xl,
    },
  });

/**
 * Grouped channel settings for podcast, album, and artist detail. Section titles sit above each
 * card; rows share one inset. Check feed, notifications, and auto-download need an account, so a
 * signed-out press opens the login gate. Once signed in, auto-download explains that it is not
 * available yet.
 */
export function ChannelSettingsPane({
  channel,
  notifications,
  testIDPrefix,
}: ChannelSettingsPaneProps) {
  const { t } = useTranslation();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { handleGateError, openGate } = useMembershipGate();
  const styles = useThemedStyles(createStyles);
  const scrollIndicatorInsets = useBottomChromeScrollIndicatorInsets();
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const [isCheckingFeed, setIsCheckingFeed] = useState(false);
  const [autoDownloadNoticeVisible, setAutoDownloadNoticeVisible] = useState(false);

  const isSignedIn = status === 'authenticated';
  const feed = channel?.feed ?? null;
  const feedLog = feed?.feed_log;
  const feedStatusLines = useFeedParseStatusLines(
    feedLog === undefined
      ? null
      : {
          lastFailedParseTime: feedLog.last_failed_parse_time,
          lastFinishedParseTime: feedLog.last_finished_parse_time,
        }
  );

  const authContext = useMemo(
    () => ({ accessToken, clearSession, refreshToken, setTokens }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  const handleCheckFeedForUpdates = useCallback(async () => {
    if (isCheckingFeed) {
      return;
    }

    if (!isSignedIn) {
      openGate('needs_account');
      return;
    }

    if (feed === null) {
      setFeedNotice(t('errors.generic'));
      return;
    }

    setIsCheckingFeed(true);
    setFeedNotice(null);
    try {
      await requestWithMobileAuthRefresh(authContext, async (api) =>
        api.reqMQRSSRefreshOnDemand({
          podcast_index_id: feed.podcast_index_id,
          url: feed.url,
        })
      );
      setFeedNotice(t('settings.feed.check_feed_added_to_queue'));
    } catch (error) {
      if (handleGateError(error)) {
        return;
      }
      const rateLimitMessage = handleRateLimitMessage(error, t);
      setFeedNotice(rateLimitMessage ?? t('errors.generic'));
    } finally {
      setIsCheckingFeed(false);
    }
  }, [authContext, feed, handleGateError, isCheckingFeed, isSignedIn, openGate, t]);

  const showFeed = feed !== null;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollIndicatorInsets={scrollIndicatorInsets}
        style={styles.scroll}
        testID={`${testIDPrefix}-settings`}
      >
        {showFeed ? (
          <ChannelFeedSettingsGroup
            isChecking={isCheckingFeed}
            notice={feedNotice}
            onCheck={() => {
              void handleCheckFeedForUpdates();
            }}
            statusLines={feedStatusLines}
            testIDPrefix={testIDPrefix}
          />
        ) : null}

        <SettingsGroup
          spaced={showFeed}
          testID={`${testIDPrefix}-settings-notifications-card`}
          title={t('settings.notifications.notifications')}
        >
          <SettingsDependentGroup
            parent={
              <SettingsSwitchRow
                accessibilityLabel={t('settings.notifications.allow')}
                disabled={notifications.isSaving}
                onValueChange={(nextValue) => {
                  void notifications.setEnabled(nextValue);
                }}
                testID={`${testIDPrefix}-settings-notifications`}
                title={t('settings.notifications.allow')}
                value={notifications.isEnabled}
              />
            }
            parentLabel={t('settings.notifications.allow')}
            testID={`${testIDPrefix}-settings-notification-types`}
          >
            {notifications.isEnabled
              ? NOTIFICATION_TYPE_ROWS.map((row) => (
                  <SettingsSwitchRow
                    key={row.type}
                    accessibilityLabel={t(row.labelKey)}
                    disabled={notifications.isSaving}
                    onValueChange={(nextValue) => {
                      void notifications.setTypeEnabled(row.type, nextValue);
                    }}
                    testID={`${testIDPrefix}-settings-notification-type-${row.type}`}
                    title={t(row.labelKey)}
                    value={notifications.isTypeEnabled(row.type)}
                  />
                ))
              : null}
          </SettingsDependentGroup>
          {notifications.errorKey !== null ? (
            <View style={styles.feedInner}>
              <SettingsRowDescription testID={`${testIDPrefix}-settings-notifications-error`}>
                {t(notifications.errorKey)}
              </SettingsRowDescription>
            </View>
          ) : null}
        </SettingsGroup>

        <SettingsGroup
          spaced
          testID={`${testIDPrefix}-settings-auto-download-card`}
          title={t('nav.tab.downloads')}
        >
          <SettingsSwitchRow
            accessibilityLabel={t('features.download.auto_download')}
            onPress={() => {
              if (!isSignedIn) {
                openGate('needs_account');
                return;
              }
              setAutoDownloadNoticeVisible(true);
            }}
            testID={`${testIDPrefix}-settings-auto-download`}
            title={t('features.download.auto_download')}
          />
        </SettingsGroup>
        <BottomChromeScrollSpacer />
      </ScrollView>

      <ConfirmDialog
        body={t('misc.not_available_yet')}
        cancelLabel={t('misc.close')}
        cancelTestID={`${testIDPrefix}-settings-auto-download-close`}
        onCancel={() => {
          setAutoDownloadNoticeVisible(false);
        }}
        testID={`${testIDPrefix}-settings-auto-download-unavailable`}
        title={t('features.download.auto_download')}
        visible={autoDownloadNoticeVisible}
      />
    </>
  );
}
