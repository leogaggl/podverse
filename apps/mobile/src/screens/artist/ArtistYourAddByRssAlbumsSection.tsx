import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AddByRssRowMarker, AlbumListRow } from '../../components/content';
import { SectionHeading } from '../../components/section/SectionHeading';
import { addByRssRepository } from '../../data/repositories/addByRssRepository';
import { useAddByRssArtistIndexVersion } from '../../hooks/useAddByRssArtistIndexVersion';
import type { AddByRssArtistIndexFeed } from '../../lib/addByRss/addByRssArtistIndex';
import { addByRssAlbumsNamingDirectoryArtist } from '../../lib/addByRss/addByRssArtistIndex';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AddByRssDetailStackParamList } from '../home/addByRss/addByRssStackParams';

/**
 * Add by RSS albums stored on this device whose publisher pointer names this directory artist.
 * Renders nothing when there are none.
 */
export const ARTIST_YOUR_ADD_BY_RSS_ALBUMS_LABEL_KEY = 'media.music.your_add_by_rss_albums';

const createStyles = ({ tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    heading: {
      marginTop: tokens.spacing.lg,
    },
  });

export function useArtistYourAddByRssAlbums(artistId: string): {
  albums: AddByRssArtistIndexFeed[];
  isEmpty: boolean;
} {
  const version = useAddByRssArtistIndexVersion();
  const albums = useMemo(() => addByRssAlbumsNamingDirectoryArtist(artistId), [artistId, version]);
  return { albums, isEmpty: albums.length === 0 };
}

export function ArtistYourAddByRssAlbumsSection({
  artistId,
}: {
  artistId: string;
}): ReactElement | null {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AddByRssDetailStackParamList>>();
  const { albums, isEmpty } = useArtistYourAddByRssAlbums(artistId);
  const albumUrlsKey = albums.map((album) => album.feedUrl).join('\u0000');
  const [images, setImages] = useState<{
    byUrl: ReadonlyMap<string, string | null>;
    key: string;
  }>({ byUrl: new Map(), key: '' });

  useEffect(() => {
    if (albumUrlsKey.length === 0) {
      return;
    }

    let cancelled = false;
    const urls = albumUrlsKey.split('\u0000');
    void (async () => {
      try {
        const records = await Promise.all(
          urls.map((feedUrl) => addByRssRepository.getFeedByUrl(feedUrl))
        );
        if (cancelled) {
          return;
        }
        const byUrl = new Map<string, string | null>();
        for (let index = 0; index < urls.length; index += 1) {
          const feedUrl = urls[index];
          if (feedUrl === undefined) {
            continue;
          }
          byUrl.set(feedUrl, records[index]?.imageUrl ?? null);
        }
        setImages({ byUrl, key: albumUrlsKey });
      } catch {
        if (!cancelled) {
          setImages({ byUrl: new Map(), key: albumUrlsKey });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [albumUrlsKey]);

  if (isEmpty) {
    return null;
  }

  const imageByUrl = images.key === albumUrlsKey ? images.byUrl : null;
  const markerLabel = t('features.add_by_rss.label');

  return (
    <View>
      <SectionHeading style={styles.heading} testID="artist-albums-your-add-by-rss-heading">
        {t(ARTIST_YOUR_ADD_BY_RSS_ALBUMS_LABEL_KEY)}
      </SectionHeading>
      {albums.map((album, index) => (
        <AlbumListRow
          accessibilityLabel={`${album.title}. ${markerLabel}`}
          addByRssFeedUrl={album.feedUrl}
          imageUrl={imageByUrl?.get(album.feedUrl) ?? null}
          key={album.feedIdText}
          onPress={() => {
            navigation.navigate('AddByRssPodcastDetail', { feedIdText: album.feedIdText });
          }}
          testID={`artist-album-add-by-rss-row-${index}`}
          title={album.title}
          trailing={<AddByRssRowMarker testID={`artist-album-add-by-rss-marker-${index}`} />}
        />
      ))}
    </View>
  );
}
