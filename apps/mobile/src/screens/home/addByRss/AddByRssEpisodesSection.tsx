import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { matchesTitleFilter } from '@podverse/helpers';

import { useAddByRssPlayback } from '../../../hooks/useAddByRssPlayback';
import { addByRssLiveItemKey } from '../../../lib/addByRss/liveItemDetail';
import type { AddByRssLiveRow } from '../../../lib/addByRss/liveRows';
import { toAddByRssFeedLiveRows } from '../../../lib/addByRss/liveRows';
import { PodcastSectionList } from '../../podcast/sections/PodcastSectionList';
import type { AddByRssHomeDetailData, AddByRssHomeEpisode } from '../addByRssHomeDetailData';
import { sortAddByRssHomeEpisodes } from '../addByRssHomeDetailData';
import type { HomeFeedRowData } from '../homeFeedData';
import { HomeFeedRow } from '../HomeFeedRow';
import type { QueueActionPosition } from '../useHomeRowPlayback';
import type { AddByRssSectionPaneProps } from './addByRssSectionPane';
import type { AddByRssDetailStackParamList } from './addByRssStackParams';
import { useAddByRssItemActions } from './useAddByRssItemActions';
import type { AddByRssItemActionTarget } from './useAddByRssItemActions';

type AddByRssEpisodeListRow = AddByRssLiveRow | AddByRssHomeEpisode;

const addByRssEpisodeKeyExtractor = (row: AddByRssEpisodeListRow): string => row.id;

type AddByRssEpisodeRowProps = {
  index: number;
  isMusicFeed: boolean;
  itemLastSeenAtMs: number | null | undefined;
  onAddToPlaylist: (row: HomeFeedRowData) => void;
  onGoToTrack: (row: HomeFeedRowData) => void;
  onMarkAsPlayed: (row: HomeFeedRowData) => void;
  onOpen: (row: HomeFeedRowData) => void;
  onPlay: (row: HomeFeedRowData) => void;
  onQueue: (row: HomeFeedRowData, position: QueueActionPosition) => void;
  row: AddByRssHomeEpisode;
};

function AddByRssEpisodeRow({
  index,
  isMusicFeed,
  itemLastSeenAtMs,
  onAddToPlaylist,
  onGoToTrack,
  onMarkAsPlayed,
  onOpen,
  onPlay,
  onQueue,
  row,
}: AddByRssEpisodeRowProps) {
  return (
    <HomeFeedRow
      downloadItem={row.downloadItem ?? undefined}
      downloadTestID={`add-by-rss-home-download-${index}`}
      itemLastSeenAtMs={itemLastSeenAtMs}
      mediaType={isMusicFeed ? 'tracks' : 'episodes'}
      onAddToPlaylistPress={onAddToPlaylist}
      onGoToTrackPress={isMusicFeed ? onGoToTrack : undefined}
      onMarkAsPlayedPress={onMarkAsPlayed}
      onPlayPress={onPlay}
      onPress={isMusicFeed ? onPlay : onOpen}
      onQueuePress={onQueue}
      playTestID={
        isMusicFeed
          ? undefined
          : index === 0
            ? 'add-by-rss-home-play-first'
            : `add-by-rss-home-play-${row.id}`
      }
      row={row}
      showChannelContext={false}
      testID={`add-by-rss-home-episode-${row.id}`}
    />
  );
}

type AddByRssLiveFeedRowProps = {
  onOpen: (row: AddByRssLiveRow) => void;
  onPlay: (row: AddByRssLiveRow) => void;
  row: AddByRssLiveRow;
};

function AddByRssLiveFeedRow({ onOpen, onPlay, row }: AddByRssLiveFeedRowProps) {
  return (
    <HomeFeedRow
      mediaType="episodes"
      onPlayPress={() => {
        onPlay(row);
      }}
      onPress={() => {
        onOpen(row);
      }}
      playTestID={`add-by-rss-home-play-live-${row.id}`}
      row={row}
      showChannelContext={false}
      testID={`add-by-rss-home-live-${row.id}`}
    />
  );
}

type AddByRssEpisodeRowRendererInput = {
  detail: AddByRssHomeDetailData;
  isMusicFeed: boolean;
  visitLastSeenAtMs: number | null | undefined;
};

/**
 * Row wiring shared by the episode, track, and downloaded lists.
 *
 * A row is on one of those lists at a time, so they share row testIDs. A podcast row opens the
 * episode page. A track row plays, and Go to Track opens the track page. Livestream rows open
 * the livestream page; the downloaded list does not render them.
 */
export function useAddByRssEpisodeRowRenderer({
  detail,
  isMusicFeed,
  visitLastSeenAtMs,
}: AddByRssEpisodeRowRendererInput): {
  addToPlaylistSheet: ReactNode;
  noticeKey: string | null;
  renderLiveRow: (row: AddByRssLiveRow) => ReactElement;
  renderRow: (params: { index: number; row: AddByRssHomeEpisode }) => ReactElement;
} {
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const { playItem, playLiveItem } = useAddByRssPlayback({ onNotice: setNoticeKey });
  const navigation = useNavigation<NativeStackNavigationProp<AddByRssDetailStackParamList>>();
  const rowsById = useMemo(
    () => new Map(detail.episodeRows.map((row) => [row.id, row])),
    [detail.episodeRows]
  );
  const { actionNoticeKey, addToPlaylist, addToPlaylistSheet, markAsPlayed, queue } =
    useAddByRssItemActions();

  const toTarget = useCallback(
    (row: HomeFeedRowData): AddByRssItemActionTarget | null => {
      if (detail.mappedFeed === null) {
        return null;
      }
      const episode = rowsById.get(row.id);
      if (episode === undefined) {
        return null;
      }
      return {
        feed: detail.feed,
        itemBundle: episode.itemBundle,
        itemIndex: episode.itemIndex,
        mappedFeed: detail.mappedFeed,
      };
    },
    [detail.feed, detail.mappedFeed, rowsById]
  );

  const handleQueue = useCallback(
    (row: HomeFeedRowData, position: QueueActionPosition) => {
      const target = toTarget(row);
      if (target === null) {
        return;
      }
      queue(target, position);
    },
    [queue, toTarget]
  );

  const handleAddToPlaylist = useCallback(
    (row: HomeFeedRowData) => {
      const target = toTarget(row);
      if (target === null) {
        return;
      }
      addToPlaylist(target);
    },
    [addToPlaylist, toTarget]
  );

  const handleMarkAsPlayed = useCallback(
    (row: HomeFeedRowData) => {
      const target = toTarget(row);
      if (target === null) {
        return;
      }
      markAsPlayed(target);
    },
    [markAsPlayed, toTarget]
  );

  const handleOpen = useCallback(
    (row: HomeFeedRowData) => {
      const episode = rowsById.get(row.id);
      if (episode === undefined) {
        return;
      }
      navigation.navigate('AddByRssEpisodeDetail', {
        feedIdText: detail.feed.idText,
        itemKey: episode.itemKey,
      });
    },
    [detail.feed.idText, navigation, rowsById]
  );

  const handleGoToTrack = useCallback(
    (row: HomeFeedRowData) => {
      const episode = rowsById.get(row.id);
      if (episode === undefined) {
        return;
      }
      navigation.navigate('AddByRssTrackDetail', {
        feedIdText: detail.feed.idText,
        itemKey: episode.itemKey,
      });
    },
    [detail.feed.idText, navigation, rowsById]
  );

  const handlePlay = useCallback(
    (row: HomeFeedRowData) => {
      if (detail.mappedFeed === null) {
        setNoticeKey('features.add_by_rss.status_processing');
        return;
      }

      const episode = detail.episodeRows.find((candidate) => candidate.id === row.id);
      if (episode === undefined) {
        setNoticeKey('features.add_by_rss.status_processing');
        return;
      }

      void playItem(detail.feed, detail.mappedFeed, episode.itemBundle, episode.itemIndex);
    },
    [detail, playItem]
  );

  const handleOpenLive = useCallback(
    (row: AddByRssLiveRow) => {
      navigation.navigate('AddByRssLivestreamDetail', {
        feedIdText: row.target.feed.idText,
        liveItemKey: addByRssLiveItemKey(row.target.liveBundle, row.target.liveIndex),
      });
    },
    [navigation]
  );

  const handlePlayLive = useCallback(
    (row: AddByRssLiveRow) => {
      void playLiveItem(
        row.target.feed,
        row.target.mappedFeed,
        row.target.liveBundle,
        row.target.liveIndex
      );
    },
    [playLiveItem]
  );

  const renderLiveRow = useCallback(
    (row: AddByRssLiveRow) => (
      <AddByRssLiveFeedRow onOpen={handleOpenLive} onPlay={handlePlayLive} row={row} />
    ),
    [handleOpenLive, handlePlayLive]
  );

  const renderRow = useCallback(
    ({ index, row }: { index: number; row: AddByRssHomeEpisode }) => (
      <AddByRssEpisodeRow
        index={index}
        isMusicFeed={isMusicFeed}
        itemLastSeenAtMs={visitLastSeenAtMs}
        onAddToPlaylist={handleAddToPlaylist}
        onGoToTrack={handleGoToTrack}
        onMarkAsPlayed={handleMarkAsPlayed}
        onOpen={handleOpen}
        onPlay={handlePlay}
        onQueue={handleQueue}
        row={row}
      />
    ),
    [
      handleAddToPlaylist,
      handleGoToTrack,
      handleMarkAsPlayed,
      handleOpen,
      handlePlay,
      handleQueue,
      isMusicFeed,
      visitLastSeenAtMs,
    ]
  );

  return {
    addToPlaylistSheet,
    noticeKey: actionNoticeKey ?? noticeKey,
    renderLiveRow,
    renderRow,
  };
}

/**
 * Episodes or tracks for one add-by-RSS feed.
 *
 * Livestream rows sit above the episode rows in the channel order: live, then scheduled, then
 * ended within a day. The sort chip orders episode rows only. A livestream row opens the
 * add-by-RSS livestream page. The title filter counts livestream and episode rows together.
 */
export function AddByRssEpisodesSection({
  detail,
  filterTerm,
  isMusicFeed,
  listHeader,
  onRefresh,
  refreshNoticeKey,
  sort,
  visitLastSeenAtMs,
}: AddByRssSectionPaneProps) {
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const {
    addToPlaylistSheet,
    noticeKey: playbackNoticeKey,
    renderLiveRow,
    renderRow,
  } = useAddByRssEpisodeRowRenderer({
    detail,
    isMusicFeed,
    visitLastSeenAtMs,
  });

  const episodeRows = useMemo(
    () => sortAddByRssHomeEpisodes(detail.episodeRows, sort),
    [detail.episodeRows, sort]
  );

  const liveRows = useMemo(() => {
    if (detail.mappedFeed === null) {
      return [];
    }
    const episodeIds = new Set(detail.episodeRows.map((row) => row.id));
    return toAddByRssFeedLiveRows(detail.feed, detail.mappedFeed).filter(
      (row) => !episodeIds.has(row.id)
    );
  }, [detail.episodeRows, detail.feed, detail.mappedFeed]);

  const visibleLiveRows = useMemo(
    () => liveRows.filter((row) => matchesTitleFilter(row.title, filterTerm)),
    [filterTerm, liveRows]
  );

  const visibleEpisodeRows = useMemo(
    () => episodeRows.filter((row) => matchesTitleFilter(row.title, filterTerm)),
    [episodeRows, filterTerm]
  );

  const rows = useMemo(
    () => [...visibleLiveRows, ...visibleEpisodeRows],
    [visibleEpisodeRows, visibleLiveRows]
  );

  const liveRowsById = useMemo(
    () => new Map(visibleLiveRows.map((row) => [row.id, row])),
    [visibleLiveRows]
  );

  const renderListRow = useCallback(
    ({ index, row }: { index: number; row: AddByRssEpisodeListRow }) => {
      const liveRow = liveRowsById.get(row.id);
      if (liveRow !== undefined) {
        return renderLiveRow(liveRow);
      }

      const episodeIndex = index - visibleLiveRows.length;
      const episodeRow = visibleEpisodeRows[episodeIndex];
      if (episodeRow === undefined) {
        return <></>;
      }
      return renderRow({ index: episodeIndex, row: episodeRow });
    },
    [liveRowsById, renderLiveRow, renderRow, visibleEpisodeRows, visibleLiveRows]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void onRefresh().finally(() => {
      setIsRefreshing(false);
    });
  }, [onRefresh]);

  const emptyMessageKey =
    detail.mappedFeed === null
      ? 'features.add_by_rss.status_processing'
      : isMusicFeed
        ? 'media.music.no_tracks_found'
        : 'media.podcast.no_episodes_found';

  return (
    <>
      <PodcastSectionList
        emptyMessageKey={emptyMessageKey}
        errorKey={null}
        hasFilterHiddenEverything={liveRows.length + episodeRows.length > 0 && rows.length === 0}
        isInitialLoading={false}
        isRefreshing={isRefreshing}
        keyExtractor={addByRssEpisodeKeyExtractor}
        listHeader={listHeader}
        noticeKey={playbackNoticeKey ?? refreshNoticeKey}
        onRefresh={handleRefresh}
        onRetry={handleRefresh}
        renderRow={renderListRow}
        rows={rows}
        statusTestIDPrefix="add-by-rss-home"
        testID="add-by-rss-home-episode-list"
      />
      {addToPlaylistSheet}
    </>
  );
}
