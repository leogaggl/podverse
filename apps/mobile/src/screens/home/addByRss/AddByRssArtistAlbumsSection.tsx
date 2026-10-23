import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { memo, useCallback, useMemo, useState } from 'react';

import { matchesTitleFilter } from '@podverse/helpers';

import { AlbumListRow } from '../../../components/content';
import { AddByRssNeedsCredentialsSection } from '../../../components/content/AddByRssNeedsCredentialsSection';
import type { ChannelBrowseStackParamList } from '../../../navigation';
import { buildAlbumDetailParams, CHANNEL_BROWSE_STACK_ROUTES } from '../../../navigation';
import type { MobileAddByRSSFeedRecord } from '../../../prefs/addByRSSFeeds';
import { PodcastSectionList } from '../../podcast/sections/PodcastSectionList';
import type { AddByRssArtistAlbumEntry } from './addByRssArtistAlbums';
import type { AddByRssSectionPaneProps } from './addByRssSectionPane';
import type { AddByRssDetailStackParamList } from './addByRssStackParams';
import { useAddByRssArtistAlbums } from './useAddByRssArtistAlbums';

type ArtistAlbumsNavigation = NativeStackNavigationProp<
  AddByRssDetailStackParamList & ChannelBrowseStackParamList
>;

const albumTitle = (album: AddByRssArtistAlbumEntry): string =>
  album.kind === 'add-by-rss' ? (album.feed.title ?? album.feed.feedUrl) : album.title;

const albumKeyExtractor = (album: AddByRssArtistAlbumEntry): string =>
  album.kind === 'add-by-rss' ? `rss-${album.feed.idText}` : `directory-${album.channelIdText}`;

type ArtistAlbumRowProps = {
  album: AddByRssArtistAlbumEntry;
  index: number;
  onPress: (album: AddByRssArtistAlbumEntry) => void;
};

const ArtistAlbumRow = memo(function ArtistAlbumRow({
  album,
  index,
  onPress,
}: ArtistAlbumRowProps) {
  const handlePress = useCallback(() => {
    onPress(album);
  }, [album, onPress]);

  return (
    <AlbumListRow
      addByRssFeedUrl={album.kind === 'add-by-rss' ? album.feed.feedUrl : null}
      imageUrl={album.kind === 'add-by-rss' ? album.feed.imageUrl : album.imageUrl}
      onPress={handlePress}
      testID={`add-by-rss-artist-album-row-${index}`}
      title={albumTitle(album)}
    />
  );
});

/**
 * An Add by RSS artist's albums. Albums waiting on a username and password sit above the album
 * rows. An Add by RSS album opens its own page; a directory album opens the directory album.
 */
export function AddByRssArtistAlbumsSection({
  detail,
  filterTerm,
  listHeader,
  onRefresh,
  refreshNoticeKey,
}: AddByRssSectionPaneProps) {
  const navigation = useNavigation<ArtistAlbumsNavigation>();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { albums, hasPending, isLoading, needsCredentials, reload } = useAddByRssArtistAlbums(
    detail.feed.feedUrl,
    { includeTracks: false }
  );

  const visibleAlbums = useMemo(
    () => albums.filter((album) => matchesTitleFilter(albumTitle(album), filterTerm)),
    [albums, filterTerm]
  );

  const handleOpenAlbum = useCallback(
    (album: AddByRssArtistAlbumEntry) => {
      if (album.kind === 'add-by-rss') {
        navigation.navigate('AddByRssPodcastDetail', { feedIdText: album.feed.idText });
        return;
      }
      navigation.navigate(
        CHANNEL_BROWSE_STACK_ROUTES.AlbumDetail,
        buildAlbumDetailParams({
          albumId: album.channelIdText,
          previewImageUrl: album.imageUrl,
          previewTitle: album.title,
        })
      );
    },
    [navigation]
  );

  const handleOpenCredentials = useCallback(
    (feed: MobileAddByRSSFeedRecord) => {
      navigation.navigate('AddByRssCredentials', { feedIdText: feed.idText });
    },
    [navigation]
  );

  const renderRow = useCallback(
    ({ index, row }: { index: number; row: AddByRssArtistAlbumEntry }) => (
      <ArtistAlbumRow album={row} index={index} onPress={handleOpenAlbum} />
    ),
    [handleOpenAlbum]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void (async () => {
      try {
        await onRefresh();
        await reload();
      } finally {
        setIsRefreshing(false);
      }
    })();
  }, [onRefresh, reload]);

  const handleRetry = useCallback(() => {
    void reload();
  }, [reload]);

  const header = (
    <>
      {listHeader}
      <AddByRssNeedsCredentialsSection
        items={needsCredentials}
        onPressFeed={handleOpenCredentials}
        showDivider={false}
        testIDPrefix="add-by-rss-artist"
      />
    </>
  );

  return (
    <PodcastSectionList
      emptyMessageKey="media.music.no_albums_found"
      errorKey={null}
      hasFilterHiddenEverything={albums.length > 0 && visibleAlbums.length === 0}
      isInitialLoading={isLoading}
      isRefreshing={isRefreshing}
      keyExtractor={albumKeyExtractor}
      listHeader={header}
      noticeKey={hasPending ? 'features.add_by_rss.status_processing' : refreshNoticeKey}
      onRefresh={handleRefresh}
      onRetry={handleRetry}
      renderRow={renderRow}
      rows={visibleAlbums}
      statusTestIDPrefix="add-by-rss-artist-albums"
      testID="add-by-rss-artist-album-list"
    />
  );
}
