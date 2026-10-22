import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LiveItemStatusEnum } from '@podverse/helpers';

import { DescriptionText, PeoplePane } from '../../components/content';
import type { SectionChipItem } from '../../components/form';
import { SectionChipRow } from '../../components/form';
import { FillList } from '../../components/primitives';
import { ListError } from '../../components/state/ListError';
import { LoadingSection } from '../../components/state/LoadingSection';
import { useAddByRssPlayback } from '../../hooks/useAddByRssPlayback';
import { listHeaderStackGap, screenBodyInsets } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { EPISODE_TAB_LABEL_KEYS } from '../episode/episodeTabs';
import { AddByRssLivestreamHeader } from './addByRss/AddByRssLivestreamHeader';
import type { AddByRssDetailStackParamList } from './addByRss/addByRssStackParams';
import { useAddByRssLiveItemDetail } from './addByRss/useAddByRssItemDetail';
import { toAddByRssAboutPeople } from './addByRssHomeDetailData';

type AddByRssLivestreamDetailScreenProps = NativeStackScreenProps<
  AddByRssDetailStackParamList,
  'AddByRssLivestreamDetail'
>;

type AddByRssLivestreamTab = 'people' | 'summary';

const EMPTY_LIVESTREAM_ROWS: never[] = [];

const renderEmptyLivestreamRow = (): null => null;

/**
 * The Add by RSS livestream page, built from the parsed feed on the device.
 *
 * Play is offered only while the livestream is on the air. The page has no Queue, playlist,
 * played, download, or Share actions. Summary is always available. People appears when the
 * live item lists people.
 */
export function AddByRssLivestreamDetailScreen({
  navigation,
  route,
}: AddByRssLivestreamDetailScreenProps) {
  const { feedIdText, liveItemKey } = route.params;
  const { errorKey, feed, isLoading, liveItem, mappedFeed, reload } = useAddByRssLiveItemDetail(
    route.params
  );
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const [tab, setTab] = useState<AddByRssLivestreamTab>('summary');
  const [playbackNoticeKey, setPlaybackNoticeKey] = useState<string | null>(null);
  const routeKey = `${feedIdText}\n${liveItemKey}`;
  const [loadedKey, setLoadedKey] = useState(routeKey);
  if (loadedKey !== routeKey) {
    setLoadedKey(routeKey);
    setTab('summary');
    setPlaybackNoticeKey(null);
  }
  const { playLiveItem } = useAddByRssPlayback({ onNotice: setPlaybackNoticeKey });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chipRow: {
          marginTop: listHeaderStackGap(tokens.spacing),
        },
        container: {
          backgroundColor: themeStyles.screen.backgroundColor,
          flex: 1,
        },
        description: {
          ...typography.prose,
          color: themeStyles.textPrimary.color,
        },
        list: {
          backgroundColor: themeStyles.screen.backgroundColor,
          flex: 1,
        },
        listContent: {
          paddingBottom: tokens.spacing['2xl'],
          paddingHorizontal: screenBodyInsets(tokens.spacing).paddingHorizontal,
          paddingTop: screenBodyInsets(tokens.spacing).paddingTop,
        },
        notice: {
          ...typography.caption,
          color: themeStyles.textSecondary.color,
          marginTop: tokens.spacing.sm,
        },
        showMore: {
          ...typography.caption,
          color: tokens.text.link,
          marginTop: tokens.spacing.sm,
        },
      }),
    [themeStyles, tokens]
  );

  const aboutPeople = useMemo(
    () => (liveItem === null ? [] : toAddByRssAboutPeople(liveItem.people)),
    [liveItem]
  );
  const tabs = useMemo((): AddByRssLivestreamTab[] => {
    if (aboutPeople.length === 0) {
      return ['summary'];
    }
    return ['summary', 'people'];
  }, [aboutPeople.length]);
  const sectionChips = useMemo(
    (): SectionChipItem<AddByRssLivestreamTab>[] =>
      tabs.map((key) => ({
        key,
        label: t(EPISODE_TAB_LABEL_KEYS[key]),
        testID: `add-by-rss-livestream-detail-tab-${key}`,
      })),
    [t, tabs]
  );
  const activeTab: AddByRssLivestreamTab = tabs.includes(tab) ? tab : 'summary';
  const isLive = liveItem?.statusId === LiveItemStatusEnum.Live;

  const handlePlayPress = useCallback(() => {
    if (feed === null || mappedFeed === null || liveItem === null) {
      return;
    }
    void playLiveItem(feed, mappedFeed, liveItem.liveBundle, liveItem.liveIndex);
  }, [feed, liveItem, mappedFeed, playLiveItem]);

  const handleChannelPress = useCallback(() => {
    navigation.navigate('AddByRssPodcastDetail', { feedIdText });
  }, [feedIdText, navigation]);

  const handleTabPress = useCallback((nextTab: AddByRssLivestreamTab) => {
    setTab(nextTab);
  }, []);

  const isReady =
    !isLoading && errorKey === null && feed !== null && mappedFeed !== null && liveItem !== null;

  let listFooter: ReactNode = null;
  if (activeTab === 'people') {
    listFooter = (
      <PeoplePane
        isLoading={false}
        layout="inline"
        people={aboutPeople}
        testIDPrefix="add-by-rss-livestream-detail"
      />
    );
  } else if (liveItem !== null) {
    listFooter = (
      <View testID="add-by-rss-livestream-detail-summary">
        <DescriptionText
          emptyLabel={t('info.summary.no_summary')}
          html={liveItem.descriptionHtml}
          linkStyle={styles.showMore}
          resetKey={liveItemKey}
          showMoreStyle={styles.showMore}
          testID="add-by-rss-livestream-detail-description"
          textStyle={styles.description}
          toggleTestID="add-by-rss-livestream-detail-description-toggle"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="add-by-rss-livestream-detail-screen">
      {isLoading ? <LoadingSection testID="add-by-rss-livestream-detail-loading" /> : null}
      {!isLoading && errorKey !== null ? (
        <ListError
          messageKey={errorKey}
          onRetry={reload}
          testID="add-by-rss-livestream-detail-error"
        />
      ) : null}
      {isReady && feed !== null && mappedFeed !== null && liveItem !== null ? (
        <FillList
          ListEmptyComponent={null}
          ListFooterComponent={listFooter}
          ListHeaderComponent={
            <View>
              <AddByRssLivestreamHeader
                feed={feed}
                liveItem={liveItem}
                mappedFeed={mappedFeed}
                onChannelPress={handleChannelPress}
                onPlayPress={isLive ? handlePlayPress : undefined}
              />
              {playbackNoticeKey !== null ? (
                <Text accessibilityLiveRegion="polite" style={styles.notice}>
                  {t(playbackNoticeKey)}
                </Text>
              ) : null}
              <View style={styles.chipRow}>
                <SectionChipRow
                  items={sectionChips}
                  onSelect={handleTabPress}
                  selectedKey={activeTab}
                  testID="add-by-rss-livestream-detail-sections"
                />
              </View>
            </View>
          }
          contentContainerStyle={styles.listContent}
          data={EMPTY_LIVESTREAM_ROWS}
          extraData={activeTab}
          renderItem={renderEmptyLivestreamRow}
          style={styles.list}
          testID="add-by-rss-livestream-detail-list"
        />
      ) : null}
    </View>
  );
}
