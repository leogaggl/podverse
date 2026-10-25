import { Ionicons } from '@expo/vector-icons';
import type { JSX } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOPlaybackResourceRef } from '@podverse/helpers/accountPlaybackStream';
import type { DTOItemChapter } from '@podverse/helpers/dto';
import { formatHHMMSS } from '@podverse/helpers/time';

import { useRemotePlaybackPositionSeconds } from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import type { NowPlayingSegment } from '../../playback/nowPlayingSegment';
import {
  nowPlayingSegmentLabelKey,
  resolveNowPlayingSegment,
  resolveRemoteNowPlayingSegment,
} from '../../playback/nowPlayingSegment';
import { usePlaybackProgress, usePlaybackSession } from '../../playback/PlaybackProvider';
import { usePlaybackScrubPreview } from '../../playback/playbackScrubPreviewStore';
import { FULL_PLAYER_SEGMENT_BAND_HEIGHT } from '../../screens/player/fullPlayerLayout';
import { BOTTOM_CHROME_STRIP_ICON_SIZE } from '../../theme/bottomChromeStrip';
import { useTheme } from '../../theme/useTheme';
import { MarqueeText } from '../primitives/MarqueeText';
import { ChapterLinkButton } from './ChapterLinkButton';
import { nowPlayingSegmentLeadingIcon } from './nowPlayingSegmentIcon';

const CONDENSED_ICON_SIZE = 14;

type FullPlayerSegmentBandProps = {
  chapters: DTOItemChapter[];
};

type SegmentBandDetail = { kind: 'time' | 'status'; text: string } | null;

const formatSegmentTimeLabel = (
  segment: NowPlayingSegment,
  formatRange: (start: string, end: string) => string
): string | null => {
  if (segment.startTime === null) {
    return null;
  }
  const timeStart = formatHHMMSS(Number(segment.startTime));
  if (segment.endTime === null) {
    return timeStart;
  }
  return formatRange(timeStart, formatHHMMSS(Number(segment.endTime)));
};

/**
 * Names the clip, official clip, or chapter under the playhead, in the row below the artwork.
 * The local band shows the time range under the segment. The remote band shows the status line
 * there. The row keeps its height with nothing to name, so a chapter arriving fades in without
 * moving the artwork above it or the transport below it. The local band subscribes to progress so
 * the full-player shell can stay off the tick path. When the named segment is a chapter with a
 * link, the whole band opens that URL; the link glyph is only a marker.
 */
function FullPlayerSegmentBandView({
  detail,
  segment,
}: {
  detail: SegmentBandDetail;
  segment: NowPlayingSegment | null;
}): JSX.Element {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        segmentBand: {
          alignItems: 'center',
          height: FULL_PLAYER_SEGMENT_BAND_HEIGHT,
          justifyContent: 'center',
          minWidth: 0,
          width: '100%',
        },
        segmentTitleHost: {
          width: '100%',
        },
        segmentCluster: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.md,
          minWidth: 0,
          width: '100%',
        },
        segmentClusterPressed: {
          opacity: 0.7,
        },
        segmentCopy: {
          alignItems: 'center',
          flex: 1,
          gap: tokens.spacing.md,
          minWidth: 0,
        },
        segmentText: {
          color: themeStyles.textPrimary.color,
          fontSize: 20,
          fontWeight: '400',
          lineHeight: 26,
        },
        segmentTime: {
          color: tokens.text.link,
          fontSize: 16,
          fontWeight: '400',
          lineHeight: 21,
          textAlign: 'center',
        },
        segmentTitle: {
          flex: 1,
          minWidth: 0,
        },
        statusRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.sm,
          justifyContent: 'center',
          maxWidth: '100%',
        },
        statusText: {
          color: themeStyles.textSecondary.color,
          flexShrink: 1,
          fontSize: 16,
          fontWeight: '400',
          lineHeight: 21,
          textAlign: 'center',
        },
        titleRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.sm,
          minWidth: 0,
          width: '100%',
        },
      }),
    [themeStyles, tokens]
  );

  const chapterWebUrl = segment?.kind === 'chapter' ? segment.webUrl : null;

  const openChapterLink = useCallback(async () => {
    if (chapterWebUrl === null) {
      return;
    }
    try {
      await Linking.openURL(chapterWebUrl);
    } catch (error) {
      console.warn('Could not open a chapter link', chapterWebUrl, error);
    }
  }, [chapterWebUrl]);

  const iconName = segment === null ? null : nowPlayingSegmentLeadingIcon(segment.kind);
  const showChapterLink = chapterWebUrl !== null;
  const detailText = detail === null ? null : detail.text;
  const accessibilityLabel =
    segment === null
      ? undefined
      : detailText === null
        ? `${t(nowPlayingSegmentLabelKey(segment.kind))}: ${segment.title}`
        : `${t(nowPlayingSegmentLabelKey(segment.kind))}: ${segment.title}, ${detailText}`;
  const chapterLinkAccessibilityLabel =
    accessibilityLabel === undefined
      ? t('media_player.open_chapter_link')
      : `${accessibilityLabel}. ${t('media_player.open_chapter_link')}`;

  const renderDetail = (accessible: boolean): JSX.Element | null => {
    if (detail === null) {
      return null;
    }
    if (detail.kind === 'time') {
      return (
        <Text numberOfLines={1} style={styles.segmentTime} testID="full-player-segment-time">
          {detail.text}
        </Text>
      );
    }
    return (
      <View
        accessibilityLabel={accessible ? detail.text : undefined}
        accessibilityRole={accessible ? 'text' : undefined}
        accessible={accessible}
        style={styles.statusRow}
      >
        <Ionicons
          accessibilityElementsHidden
          accessible={false}
          color={themeStyles.textSecondary.color}
          importantForAccessibility="no"
          name="swap-horizontal-outline"
          size={BOTTOM_CHROME_STRIP_ICON_SIZE}
        />
        <Text numberOfLines={1} style={styles.statusText} testID="full-player-remote-status">
          {detail.text}
        </Text>
      </View>
    );
  };

  const detailLine = renderDetail(false);
  const copy =
    segment === null ? null : (
      <View pointerEvents="none" style={styles.segmentCopy}>
        <View style={styles.titleRow}>
          {iconName !== null ? (
            <Ionicons
              color={themeStyles.textSecondary.color}
              name={iconName}
              size={CONDENSED_ICON_SIZE}
            />
          ) : null}
          <View style={styles.segmentTitle}>
            <MarqueeText
              align={iconName === null ? 'center' : 'left'}
              style={styles.segmentText}
              turnGroup="full-player"
              turnOrder={1}
            >
              {segment.title}
            </MarqueeText>
          </View>
        </View>
        {detailLine}
      </View>
    );

  return (
    <View pointerEvents="box-none" style={styles.segmentBand} testID="full-player-segment-band">
      {segment !== null && copy !== null ? (
        <View
          collapsable={false}
          pointerEvents="box-none"
          style={styles.segmentTitleHost}
          testID="full-player-segment-title"
        >
          {showChapterLink ? (
            <Pressable
              accessibilityLabel={chapterLinkAccessibilityLabel}
              accessibilityRole="link"
              onPress={() => {
                void openChapterLink();
              }}
              pointerEvents="auto"
              style={({ pressed }) => [
                styles.segmentCluster,
                pressed ? styles.segmentClusterPressed : null,
              ]}
              testID="full-player-chapter-link"
            >
              {copy}
              <ChapterLinkButton />
            </Pressable>
          ) : (
            <View
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="text"
              accessible
              pointerEvents="none"
              style={styles.segmentCluster}
            >
              {copy}
            </View>
          )}
        </View>
      ) : segment === null && detail?.kind === 'status' ? (
        renderDetail(true)
      ) : null}
    </View>
  );
}

export function FullPlayerSegmentBand({ chapters }: FullPlayerSegmentBandProps): JSX.Element {
  const { t } = useTranslation();
  const { activeTarget } = usePlaybackSession();
  const { positionSeconds } = usePlaybackProgress();
  const previewPositionSeconds = usePlaybackScrubPreview();
  const segment = resolveNowPlayingSegment({
    chapters,
    positionSeconds,
    previewPositionSeconds,
    target: activeTarget,
  });
  const timeLabel =
    segment === null
      ? null
      : formatSegmentTimeLabel(segment, (timeStart, timeEnd) =>
          t('features.clip.clip_time_range', { hhmmssEnd: timeEnd, hhmmssStart: timeStart })
        );

  return (
    <FullPlayerSegmentBandView
      detail={timeLabel === null ? null : { kind: 'time', text: timeLabel }}
      segment={segment}
    />
  );
}

/** The chapter another device is in, with the status line under it, or the status line alone. */
export function FullPlayerRemoteSegmentBand({
  chapters,
  isLive,
  refKind,
  statusText,
}: {
  chapters: DTOItemChapter[];
  isLive: boolean;
  refKind: DTOPlaybackResourceRef['kind'];
  statusText: string | null;
}): JSX.Element {
  const positionSeconds = useRemotePlaybackPositionSeconds();
  const previewPositionSeconds = usePlaybackScrubPreview();
  const segment = resolveRemoteNowPlayingSegment({
    chapters,
    isLive,
    positionSeconds,
    previewPositionSeconds,
    refKind,
  });

  return (
    <FullPlayerSegmentBandView
      detail={statusText === null ? null : { kind: 'status', text: statusText }}
      segment={segment}
    />
  );
}
