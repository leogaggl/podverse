import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DTOAccountNotification } from '@podverse/helpers';
import { getRelativeTimeParts, NotificationCategoryEnum } from '@podverse/helpers';

import { useAuthPrompt } from '../../auth/AuthPromptContext';
import { useAuth } from '../../auth/AuthProvider';
import { Card } from '../../components/primitives/Card';
import { FillList } from '../../components/primitives/FillList';
import { VerticalCenter } from '../../components/primitives/VerticalCenter';
import { HeaderBarChrome } from '../../components/screen/HeaderBarChrome';
import { CallToActionSection } from '../../components/state/CallToActionSection';
import { ListEmpty } from '../../components/state/ListEmpty';
import { ListError } from '../../components/state/ListError';
import { ListLoading } from '../../components/state/ListLoading';
import { LoadingSection } from '../../components/state/LoadingSection';
import { RetryableError } from '../../components/state/RetryableError';
import { notificationsRepository } from '../../data/repositories';
import { useLoadMoreOnEndReached } from '../../hooks/useLoadMoreOnEndReached';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import {
  appendUniqueBy,
  canLoadNextPage,
  LIST_END_REACHED_THRESHOLD,
} from '../../lib/pagination/pagedList';
import type { RootStackParamList } from '../../navigation';
import { ROOT_STACK_ROUTES } from '../../navigation';
import { markNotificationReadById } from '../../notifications/notificationReadActions';
import {
  getNotificationsInboxCache,
  prependLiveNotification,
  setNotificationsInboxCache,
} from '../../notifications/notificationsInboxCache';
import {
  markNotificationsInboxFocused,
  setNotificationUnreadCount,
  subscribeNotificationStreamEvents,
} from '../../notifications/notificationStreamStore';
import { useOfflineMode } from '../../prefs/offlineMode';
import { openAccountNotificationLink } from '../../push/openAccountNotificationLink';
import { screenBodyInsets } from '../../theme/screenLayout';
import { useTheme } from '../../theme/useTheme';

const FIRST_PAGE = 1;

const CATEGORY_LABEL_KEYS: Record<NotificationCategoryEnum, string> = {
  [NotificationCategoryEnum.General]: 'settings.notifications.category_general',
  [NotificationCategoryEnum.Livestream]: 'settings.notifications.category_livestream',
  [NotificationCategoryEnum.Maintenance]: 'settings.notifications.category_maintenance',
  [NotificationCategoryEnum.NewContent]: 'settings.notifications.category_new_content',
  [NotificationCategoryEnum.ProductUpdate]: 'settings.notifications.category_product_update',
  [NotificationCategoryEnum.TermsOfService]: 'settings.notifications.category_terms_of_service',
};

type NotificationsInboxScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'NotificationsInbox'
>;

type InboxRowStyles = {
  body: TextStyle;
  category: TextStyle;
  rowCard: ViewStyle;
  sectionHeading: TextStyle;
  time: TextStyle;
  title: TextStyle;
};

const inboxRowKeyExtractor = (item: DTOAccountNotification): string => String(item.id);

function InboxNotificationRow({
  formatRelativeTime,
  item,
  onPress,
  showEarlierHeading,
  styles,
}: {
  formatRelativeTime: (isoDate: string) => string;
  item: DTOAccountNotification;
  onPress: (notification: DTOAccountNotification) => void;
  showEarlierHeading: boolean;
  styles: InboxRowStyles;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    void onPress(item);
  }, [item, onPress]);
  const categoryLabelKey =
    CATEGORY_LABEL_KEYS[item.category] ?? 'settings.notifications.category_general';

  return (
    <>
      {showEarlierHeading ? (
        <Text style={styles.sectionHeading}>{t('notifications.section.earlier')}</Text>
      ) : null}
      <View style={styles.rowCard}>
        <Card>
          <Pressable
            accessibilityLabel={item.title}
            accessibilityRole="button"
            onPress={handlePress}
            testID={`notifications-inbox-row-${item.id}`}
          >
            <Text style={styles.title}>{item.title}</Text>
            {item.body !== null && item.body !== '' ? (
              <Text style={styles.body}>{item.body}</Text>
            ) : null}
            <Text style={styles.category}>{t(categoryLabelKey)}</Text>
            <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
          </Pressable>
        </Card>
      </View>
    </>
  );
}

export function NotificationsInboxScreen({ navigation }: NotificationsInboxScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { onRequestLogin } = useAuthPrompt();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const { styles: themeStyles, tokens } = useTheme();
  const [notifications, setNotifications] = useState<DTOAccountNotification[]>(
    () => getNotificationsInboxCache()?.items ?? []
  );
  const [isLoading, setIsLoading] = useState(() => getNotificationsInboxCache() === null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loadMoreErrorKey, setLoadMoreErrorKey] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(
    () => getNotificationsInboxCache()?.unreadCount ?? 0
  );
  const [page, setPage] = useState(() => getNotificationsInboxCache()?.page ?? FIRST_PAGE);
  const [totalPages, setTotalPages] = useState(
    () => getNotificationsInboxCache()?.totalPages ?? FIRST_PAGE
  );

  const requestContext = useMemo(() => {
    return {
      accessToken,
      clearSession,
      refreshToken,
      setTokens,
    };
  }, [accessToken, clearSession, refreshToken, setTokens]);

  const statusRef = useRef(status);
  const offlineModeEnabledRef = useRef(offlineModeEnabled);
  const requestContextRef = useRef(requestContext);
  const isFirstPageLoadingRef = useRef(false);
  const liveRowsDuringLoadRef = useRef<DTOAccountNotification[]>([]);
  const inboxGenerationRef = useRef(0);
  statusRef.current = status;
  offlineModeEnabledRef.current = offlineModeEnabled;
  requestContextRef.current = requestContext;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: themeStyles.textSecondary.color,
          fontSize: 13,
          marginTop: tokens.spacing.xs,
        },
        category: {
          color: tokens.text.accent,
          fontSize: 12,
          fontWeight: '600',
          marginTop: tokens.spacing.xs,
        },
        container: {
          backgroundColor: themeStyles.screen.backgroundColor,
          flex: 1,
        },
        content: {
          ...screenBodyInsets(tokens.spacing),
          paddingBottom: tokens.spacing.lg + insets.bottom,
        },
        listFooter: {
          marginTop: tokens.spacing.lg,
        },
        recentActivityNote: {
          color: themeStyles.textSecondary.color,
          fontSize: 13,
          marginBottom: tokens.spacing.md,
        },
        rowCard: {
          marginBottom: tokens.spacing.sm,
        },
        sectionHeading: {
          color: themeStyles.textPrimary.color,
          fontSize: 15,
          fontWeight: '700',
          marginBottom: tokens.spacing.sm,
          marginTop: tokens.spacing.md,
        },
        time: {
          color: themeStyles.textSecondary.color,
          fontSize: 12,
          marginTop: tokens.spacing.xs,
        },
        title: {
          color: themeStyles.textPrimary.color,
          fontSize: 15,
          fontWeight: '600',
        },
      }),
    [insets.bottom, themeStyles, tokens]
  );

  const handleDismiss = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(ROOT_STACK_ROUTES.MainTabs);
  }, [navigation]);

  const loadPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      if (status !== 'authenticated') {
        setNotifications([]);
        setUnreadCount(0);
        setPage(FIRST_PAGE);
        setTotalPages(FIRST_PAGE);
        setErrorKey(null);
        setLoadMoreErrorKey(null);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (offlineModeEnabled) {
        const cached = getNotificationsInboxCache();
        if (cached !== null) {
          setNotifications(cached.items);
          setUnreadCount(cached.unreadCount);
          setPage(cached.page);
          setTotalPages(cached.totalPages);
        }
        setErrorKey(null);
        setLoadMoreErrorKey(null);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (mode === 'replace') {
        inboxGenerationRef.current += 1;
        setLoadMoreErrorKey(null);
        setIsLoading(true);
        setErrorKey(null);
      } else {
        setIsLoadingMore(true);
        setLoadMoreErrorKey(null);
      }

      const generation = inboxGenerationRef.current;

      try {
        const nextData = await notificationsRepository.list(requestContext, { page: nextPage });
        if (mode === 'append' && generation !== inboxGenerationRef.current) {
          return;
        }
        setNotifications((previous) =>
          mode === 'replace'
            ? nextData.items
            : appendUniqueBy(previous, nextData.items, inboxRowKeyExtractor)
        );
        setUnreadCount(nextData.unreadCount);
        setPage(nextData.page);
        setTotalPages(nextData.totalPages);
        const cached = getNotificationsInboxCache();
        if (mode === 'replace') {
          setNotificationsInboxCache({
            items: nextData.items,
            page: nextData.page,
            totalPages: nextData.totalPages,
            unreadCount: nextData.unreadCount,
          });
        } else {
          setNotificationsInboxCache({
            items: appendUniqueBy(cached?.items ?? [], nextData.items, inboxRowKeyExtractor),
            page: nextData.page,
            totalPages: nextData.totalPages,
            unreadCount: nextData.unreadCount,
          });
        }
      } catch (error) {
        console.warn('Could not load notifications page', error);
        if (mode === 'append') {
          if (generation !== inboxGenerationRef.current) {
            return;
          }
          setLoadMoreErrorKey('errors.generic');
        } else {
          setNotifications([]);
          setErrorKey('errors.generic');
        }
      } finally {
        if (mode === 'replace') {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [offlineModeEnabled, requestContext, status]
  );

  const loadFirstPageAndMarkRead = useCallback(async () => {
    inboxGenerationRef.current += 1;
    setLoadMoreErrorKey(null);

    if (status !== 'authenticated') {
      setNotifications([]);
      setUnreadCount(0);
      setPage(FIRST_PAGE);
      setTotalPages(FIRST_PAGE);
      setErrorKey(null);
      setLoadMoreErrorKey(null);
      setIsLoading(false);
      return;
    }

    if (offlineModeEnabled) {
      const cached = getNotificationsInboxCache();
      if (cached !== null) {
        setNotifications(cached.items);
        setUnreadCount(cached.unreadCount);
        setPage(cached.page);
        setTotalPages(cached.totalPages);
      }
      setErrorKey(null);
      setLoadMoreErrorKey(null);
      setIsLoading(false);
      return;
    }

    isFirstPageLoadingRef.current = true;
    liveRowsDuringLoadRef.current = [];
    setIsLoading(true);
    setErrorKey(null);
    try {
      await notificationsRepository.markRead(requestContext);
      setNotificationUnreadCount(0);
      const nextData = await notificationsRepository.list(requestContext, { page: FIRST_PAGE });
      let items = nextData.items;
      for (const held of liveRowsDuringLoadRef.current) {
        items = prependLiveNotification(items, held);
      }
      setNotifications(items);
      setUnreadCount(nextData.unreadCount);
      setPage(nextData.page);
      setTotalPages(nextData.totalPages);
      setNotificationsInboxCache({
        items,
        page: nextData.page,
        totalPages: nextData.totalPages,
        unreadCount: nextData.unreadCount,
      });
    } catch (error) {
      console.warn('Could not refresh notifications inbox', error);
      setNotifications([]);
      setErrorKey('errors.generic');
    } finally {
      isFirstPageLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [offlineModeEnabled, requestContext, status]);

  const loadFirstPageAndMarkReadRef = useRef(loadFirstPageAndMarkRead);
  loadFirstPageAndMarkReadRef.current = loadFirstPageAndMarkRead;

  useFocusEffect(
    useCallback(() => {
      void loadFirstPageAndMarkRead();
    }, [loadFirstPageAndMarkRead])
  );

  useFocusEffect(
    useCallback(() => {
      const releaseInboxFocus = markNotificationsInboxFocused();
      const unsubscribe = subscribeNotificationStreamEvents((event) => {
        if (event.type === 'created') {
          if (statusRef.current !== 'authenticated' || offlineModeEnabledRef.current) {
            return;
          }
          const notification = event.notification;
          setNotifications((items) => prependLiveNotification(items, notification));
          const cached = getNotificationsInboxCache();
          if (cached !== null) {
            setNotificationsInboxCache({
              ...cached,
              items: prependLiveNotification(cached.items, notification),
            });
          }
          if (isFirstPageLoadingRef.current) {
            liveRowsDuringLoadRef.current.push(notification);
          }
          void markNotificationReadById(requestContextRef.current, notification.id);
          return;
        }
        if (event.type === 'resync') {
          if (!isFirstPageLoadingRef.current) {
            void loadFirstPageAndMarkReadRef.current();
          }
          return;
        }
      });
      return () => {
        unsubscribe();
        releaseInboxFocus();
      };
    }, [])
  );

  const handleNotificationPress = useCallback((notification: DTOAccountNotification) => {
    void openAccountNotificationLink(notification);
  }, []);

  const formatRelativeTime = useCallback(
    (isoDate: string): string => {
      const parts = getRelativeTimeParts(isoDate);
      if (parts === null) {
        return '';
      }
      if (parts.value === 0) {
        return t('notifications_page.relative_time_just_now');
      }

      const direction = parts.value < 0 ? 'ago' : 'from_now';
      const count = Math.abs(parts.value);
      return t(`notifications_page.relative_time_${parts.unit}s_${direction}`, { count });
    },
    [t]
  );

  const canLoadMore = page < totalPages;
  const earlierSectionStartIndex = Math.min(unreadCount, notifications.length);
  const hasUnreadSection = earlierSectionStartIndex > 0;
  const hasEarlierSection = notifications.length > earlierSectionStartIndex;
  const hasRows = notifications.length > 0;

  const handleEndReached = useLoadMoreOnEndReached({
    canLoadMore:
      status === 'authenticated' &&
      !offlineModeEnabled &&
      canLoadNextPage({
        hasError: errorKey !== null || loadMoreErrorKey !== null,
        hasMore: canLoadMore,
        isLoading,
        isLoadingMore,
      }),
    loadMore: () => loadPage(page + 1, 'append'),
  });

  const handleRetryNextPage = useCallback(() => {
    void loadPage(page + 1, 'append');
  }, [loadPage, page]);

  const handleRetryInbox = useCallback(() => {
    void loadFirstPageAndMarkRead();
  }, [loadFirstPageAndMarkRead]);

  const sectionHeader = useMemo(
    () =>
      hasRows ? (
        <>
          <Text style={styles.recentActivityNote}>
            {t('notifications_page.recent_activity_note')}
          </Text>
          {hasUnreadSection ? (
            <Text style={styles.sectionHeading}>{t('notifications.section.unread')}</Text>
          ) : null}
        </>
      ) : null,
    [hasRows, hasUnreadSection, styles.recentActivityNote, styles.sectionHeading, t]
  );

  const listEmpty = useMemo(
    () =>
      isLoading ? (
        <LoadingSection testID="notifications-inbox-loading" />
      ) : status !== 'authenticated' ? (
        <CallToActionSection
          actionLabelKey="authentication.login"
          messageKey="authentication.login_required"
          onAction={onRequestLogin}
          testID="notifications-inbox-auth-required"
        />
      ) : offlineModeEnabled && getNotificationsInboxCache() === null ? (
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="notifications-inbox-offline-unavailable"
        />
      ) : errorKey !== null ? (
        <VerticalCenter>
          <RetryableError
            errorKey={errorKey}
            onRetry={handleRetryInbox}
            testID="notifications-inbox-error"
          />
        </VerticalCenter>
      ) : (
        <VerticalCenter>
          <ListEmpty messageKey="notifications_page.empty" testID="notifications-inbox-empty" />
        </VerticalCenter>
      ),
    [errorKey, handleRetryInbox, isLoading, offlineModeEnabled, onRequestLogin, status]
  );

  const listFooter = useMemo(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.listFooter}>
          <ListLoading testID="notifications-inbox-loading-more" />
        </View>
      );
    }

    if (loadMoreErrorKey !== null && hasRows && !offlineModeEnabled) {
      return (
        <View style={styles.listFooter}>
          <ListError
            messageKey={loadMoreErrorKey}
            onRetry={handleRetryNextPage}
            testID="notifications-inbox-load-more-error"
          />
        </View>
      );
    }

    return null;
  }, [
    handleRetryNextPage,
    hasRows,
    isLoadingMore,
    loadMoreErrorKey,
    offlineModeEnabled,
    styles.listFooter,
  ]);

  const inboxRowStyles = useMemo<InboxRowStyles>(
    () => ({
      body: styles.body,
      category: styles.category,
      rowCard: styles.rowCard,
      sectionHeading: styles.sectionHeading,
      time: styles.time,
      title: styles.title,
    }),
    [styles.body, styles.category, styles.rowCard, styles.sectionHeading, styles.time, styles.title]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DTOAccountNotification; index: number }) => (
      <InboxNotificationRow
        formatRelativeTime={formatRelativeTime}
        item={item}
        onPress={handleNotificationPress}
        showEarlierHeading={index === earlierSectionStartIndex && hasEarlierSection}
        styles={inboxRowStyles}
      />
    ),
    [
      earlierSectionStartIndex,
      formatRelativeTime,
      handleNotificationPress,
      hasEarlierSection,
      inboxRowStyles,
    ]
  );

  return (
    <View style={styles.container} testID="notifications-inbox-screen">
      <HeaderBarChrome
        backAccessibilityLabel={t('misc.dismiss')}
        backIcon="chevron-down"
        backTestID="notifications-inbox-dismiss"
        onBack={handleDismiss}
        title={t('nav.tab.notifications')}
      />
      <FillList
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        ListHeaderComponent={sectionHeader}
        contentContainerStyle={styles.content}
        data={notifications}
        extraData={`${earlierSectionStartIndex}:${hasEarlierSection}`}
        keyExtractor={inboxRowKeyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}
        renderItem={renderItem}
      />
    </View>
  );
}
