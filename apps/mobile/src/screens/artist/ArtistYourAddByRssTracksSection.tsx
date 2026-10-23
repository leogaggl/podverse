import type { ReactElement } from 'react';
import { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AddByRssRowMarker } from '../../components/content';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { useAddByRssEpisodeRowRenderer } from '../home/addByRss/AddByRssEpisodesSection';
import { useArtistYourAddByRssTrackDetails } from './useArtistYourAddByRssTrackDetails';

/**
 * Tracks from the Add by RSS albums on this device that name this directory artist.
 * Albums stay in the albums section's order, and each album's tracks stay in feed order.
 * Renders nothing when there are none.
 */
export function useArtistYourAddByRssTracks(artistId: string): { isEmpty: boolean } {
  const { details } = useArtistYourAddByRssTrackDetails(artistId);
  return { isEmpty: details.every((detail) => detail.episodeRows.length === 0) };
}

const createStyles = ({ styles: themeStyles, tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    notice: {
      color: themeStyles.textSecondary.color,
      fontSize: 13,
      marginTop: tokens.spacing.sm,
    },
  });

export function ArtistYourAddByRssTracksSection({
  artistId,
}: {
  artistId: string;
}): ReactElement | null {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { isEmpty } = useArtistYourAddByRssTracks(artistId);
  const { details } = useArtistYourAddByRssTrackDetails(artistId);
  const rows = useMemo(() => details.flatMap((detail) => detail.episodeRows), [details]);
  const trailing = useCallback(
    (index: number) => <AddByRssRowMarker testID={`artist-track-add-by-rss-marker-${index}`} />,
    []
  );
  const rowTestID = useCallback((index: number) => `artist-track-add-by-rss-row-${index}`, []);
  const { addToPlaylistSheet, noticeKey, renderRow } = useAddByRssEpisodeRowRenderer({
    details,
    isMusicFeed: true,
    rowTestID,
    trailing,
    visitLastSeenAtMs: undefined,
  });

  if (isEmpty) {
    return null;
  }

  return (
    <View>
      {rows.map((row, index) => (
        <Fragment key={row.id}>{renderRow({ index, row })}</Fragment>
      ))}
      {noticeKey !== null ? (
        <Text style={styles.notice}>{noticeKey.includes(' ') ? noticeKey : t(noticeKey)}</Text>
      ) : null}
      {addToPlaylistSheet}
    </View>
  );
}
