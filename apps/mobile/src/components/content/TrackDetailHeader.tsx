import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOItem } from '@podverse/helpers';

import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { DownloadRowControl } from '../download/DownloadRowControl';
import type { MediaRowMoreAction } from '../player/MediaRowActions';
import { MediaRowActions } from '../player/MediaRowActions';
import { CoverImage } from '../primitives';

const TRACK_ARTWORK_SIZE = 96;

export type TrackDetailHeaderProps = {
  /** Album or feed name; a link when `onAlbumPress` is set. */
  albumTitle: string;
  /** Feed URL of a private Add by RSS feed's artwork; set wherever `artworkHeaders` is set. */
  artworkAddByRssFeedUrl?: string | null;
  artworkHeaders?: Record<string, string>;
  artworkUri: string | null;
  dateLabel: string | null;
  /** Drives the one-tap download control beside the artwork; null hides it. */
  downloadItem: DTOItem | null;
  durationLabel: string | null;
  /** Suffix for the play bar ids and the playback match. */
  mediaIdText: string;
  moreActions: MediaRowMoreAction[];
  onAlbumPress?: () => void;
  onPlayPress: () => void;
  testIDPrefix: string;
  title: string;
};

/**
 * The track page header: artwork with a download control, an album link, the title, the date,
 * and the play bar. Shared by the track page and the Add by RSS track page.
 */
export function TrackDetailHeader({
  albumTitle,
  artworkAddByRssFeedUrl,
  artworkHeaders,
  artworkUri,
  dateLabel,
  downloadItem,
  durationLabel,
  mediaIdText,
  moreActions,
  onAlbumPress,
  onPlayPress,
  testIDPrefix,
  title,
}: TrackDetailHeaderProps) {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        artwork: {
          height: TRACK_ARTWORK_SIZE,
          width: TRACK_ARTWORK_SIZE,
        },
        artworkRow: {
          alignItems: 'flex-start',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
        },
        date: {
          ...typography.caption,
          color: tokens.text.accent,
        },
        playChrome: {
          marginTop: tokens.spacing.sm,
        },
        root: {
          gap: tokens.spacing.md,
          marginTop: tokens.spacing.md,
        },
        subtitleLink: {
          ...typography.label,
          color: tokens.text.accent,
        },
        subtitleMuted: {
          ...typography.label,
          color: themeStyles.textSecondary.color,
        },
        title: {
          ...typography.title,
          color: themeStyles.textPrimary.color,
        },
        titles: {
          gap: tokens.spacing.xs,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <View accessible={false} style={styles.root} testID={`${testIDPrefix}-playback-chrome`}>
      <View style={styles.artworkRow}>
        <CoverImage
          accessibilityLabel={title}
          addByRssFeedUrl={artworkAddByRssFeedUrl}
          headers={artworkHeaders}
          style={styles.artwork}
          testID={`${testIDPrefix}-artwork`}
          uri={artworkUri}
        />
        {downloadItem !== null ? (
          <DownloadRowControl
            completeTestID={`${testIDPrefix}-download-complete`}
            item={downloadItem}
            testID={`${testIDPrefix}-download`}
          />
        ) : null}
      </View>
      <View style={styles.titles}>
        {onAlbumPress !== undefined ? (
          <Pressable
            accessibilityLabel={albumTitle}
            accessibilityRole="link"
            onPress={onAlbumPress}
            testID={`${testIDPrefix}-album-title`}
          >
            <Text style={styles.subtitleLink}>{albumTitle}</Text>
          </Pressable>
        ) : (
          <Text style={styles.subtitleMuted} testID={`${testIDPrefix}-album-title`}>
            {albumTitle}
          </Text>
        )}
        <Text accessibilityRole="header" style={styles.title} testID={`${testIDPrefix}-title`}>
          {title}
        </Text>
        {dateLabel !== null ? (
          <Text style={styles.date} testID={`${testIDPrefix}-date`}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.playChrome}>
        <MediaRowActions
          appearance="icons"
          durationLabel={durationLabel}
          durationTestID={`${testIDPrefix}-duration-${mediaIdText}`}
          idSuffix={`-${mediaIdText}`}
          moreActions={moreActions}
          moreTestID={`${testIDPrefix}-more-${mediaIdText}`}
          onPlayPress={onPlayPress}
          playbackMediaId={mediaIdText}
          playLabel={t('media_player.play')}
          playTestID={`${testIDPrefix}-play-${mediaIdText}`}
        />
      </View>
    </View>
  );
}
