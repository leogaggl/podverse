import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { breakpoints } from '@podverse/design-tokens';

import {
  nowPlayingSegmentLabelKey,
  resolveNowPlayingSegment,
} from '../../playback/nowPlayingSegment';
import { usePlaybackProgress, usePlaybackSession } from '../../playback/PlaybackProvider';
import { usePlaybackScrubPreview } from '../../playback/playbackScrubPreviewStore';
import { useNowPlayingChapters } from '../../playback/useNowPlayingChapters';
import {
  BOTTOM_CHROME_STRIP_ICON_SIZE,
  bottomChromeStripContainerLayout,
  bottomChromeStripTextStyle,
} from '../../theme/bottomChromeStrip';
import { useResponsive } from '../../theme/useResponsive';
import { useTheme } from '../../theme/useTheme';
import { MarqueeText } from '../primitives/MarqueeText';
import { nowPlayingSegmentLeadingIcon } from './nowPlayingSegmentIcon';
import { setNowPlayingSegmentStripVisible } from './nowPlayingSegmentStripPresence';

/**
 * Slim strip naming the clip, official clip, or chapter playing inside the current episode.
 * Chapters come from {@link useNowPlayingChapters}; the playhead drives which chapter is named.
 * Height and type match the other bottom-chrome strips ({@link bottomChromeStripContainerLayout}).
 */
export function NowPlayingSegmentBar() {
  const { t } = useTranslation();
  const { isTablet } = useResponsive();
  const { styles: themeStyles, tokens } = useTheme();
  const { activeTarget } = usePlaybackSession();
  const { positionSeconds } = usePlaybackProgress();
  const previewPositionSeconds = usePlaybackScrubPreview();
  const { chapters } = useNowPlayingChapters();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          backgroundColor: tokens.background.tertiary,
          borderTopColor: themeStyles.border.borderColor,
          borderTopWidth: StyleSheet.hairlineWidth,
          flexDirection: 'row',
          gap: tokens.spacing.md,
          ...bottomChromeStripContainerLayout(tokens.spacing),
        },
        containerTablet: {
          alignSelf: 'center',
          maxWidth: breakpoints.lg,
          width: '100%',
        },
        label: {
          ...bottomChromeStripTextStyle(),
          color: themeStyles.textSecondary.color,
        },
        titleSlot: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [themeStyles, tokens]
  );

  const segment = resolveNowPlayingSegment({
    chapters,
    positionSeconds,
    previewPositionSeconds,
    target: activeTarget,
  });

  const segmentVisible = segment !== null;
  useLayoutEffect(() => {
    setNowPlayingSegmentStripVisible(segmentVisible);
  }, [segmentVisible]);

  useLayoutEffect(() => {
    return () => {
      setNowPlayingSegmentStripVisible(false);
    };
  }, []);

  if (segment === null) {
    return null;
  }

  const iconName = nowPlayingSegmentLeadingIcon(segment.kind);

  return (
    <View
      accessibilityLabel={`${t(nowPlayingSegmentLabelKey(segment.kind))}: ${segment.title}`}
      accessibilityRole="text"
      accessible
      style={[styles.container, isTablet ? styles.containerTablet : undefined]}
      testID="now-playing-segment-bar"
    >
      {iconName !== null ? (
        <Ionicons
          color={themeStyles.textSecondary.color}
          name={iconName}
          size={BOTTOM_CHROME_STRIP_ICON_SIZE}
        />
      ) : null}
      <View style={styles.titleSlot}>
        <MarqueeText
          align={iconName === null ? 'center' : 'left'}
          style={styles.label}
          testID="now-playing-segment-title"
        >
          {segment.title}
        </MarqueeText>
      </View>
    </View>
  );
}
