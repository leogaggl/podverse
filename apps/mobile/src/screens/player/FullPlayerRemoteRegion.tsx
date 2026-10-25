import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DTOItemChapter } from '@podverse/helpers/dto';
import { isMusicMediumId } from '@podverse/helpers/medium';

import { FullPlayerRemoteScrubber } from '../../components/player/FullPlayerScrubber';
import { FullPlayerRemoteSegmentBand } from '../../components/player/FullPlayerSegmentBand';
import { FullPlayerTransportRow } from '../../components/player/FullPlayerTransportRow';
import { FullPlayerUtilityRow } from '../../components/player/FullPlayerUtilityRow';
import { CoverImage } from '../../components/primitives/CoverImage';
import { MarqueeText } from '../../components/primitives/MarqueeText';
import type { CrossDevicePlayerDisplay } from '../../playback/crossDevice/crossDevicePlayerDisplay';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { FullPlayerContentTarget } from './fullPlayerContentLink';
import {
  FULL_PLAYER_PROGRESS_BLOCK_HEIGHT,
  FULL_PLAYER_TITLE_BLOCK_HEIGHT,
} from './fullPlayerLayout';

/** A remote transport state is playing, paused, or loading, so the error press is unused. */
const noop = (): void => {};

export type FullPlayerRemoteRegionStyles = {
  region: StyleProp<ViewStyle>;
  content: StyleProp<ViewStyle>;
  upperBands: StyleProp<ViewStyle>;
  titleBlock: StyleProp<ViewStyle>;
  title: StyleProp<TextStyle>;
  titleLink: StyleProp<ViewStyle>;
  subtitle: StyleProp<TextStyle>;
  subtitleLink: StyleProp<TextStyle>;
  artworkBand: StyleProp<ViewStyle>;
  controlStack: StyleProp<ViewStyle>;
};

type FullPlayerRemoteRegionProps = {
  artworkSize: number;
  channelLink: FullPlayerContentTarget | null;
  chapters: DTOItemChapter[];
  contentLinkLabel: (request: FullPlayerContentTarget) => string;
  display: Extract<CrossDevicePlayerDisplay, { kind: 'remote' }>;
  onJumpBack: () => void;
  onJumpForward: () => void;
  onOpenChannel: () => void;
  onOpenSpeed: () => void;
  onOpenTitle: () => void;
  onPause: () => void;
  onPlay: () => void;
  onSkipToNext: () => void;
  onSkipToNextTrack: () => void;
  onSkipToPrevious: () => void;
  onSkipToPreviousTrack: () => void;
  regionStyles: FullPlayerRemoteRegionStyles;
  statusText: string | null;
  titleLink: FullPlayerContentTarget | null;
};

/**
 * Full player while another device is playing. Band order and heights match the local region:
 * title, artwork, segment, progress, transport, utility. This phone's video surface stays
 * unmounted. The title block is the base height: this region has no artist line.
 */
export function FullPlayerRemoteRegion({
  artworkSize,
  channelLink,
  chapters,
  contentLinkLabel,
  display,
  onJumpBack,
  onJumpForward,
  onOpenChannel,
  onOpenSpeed,
  onOpenTitle,
  onPause,
  onPlay,
  onSkipToNext,
  onSkipToNextTrack,
  onSkipToPrevious,
  onSkipToPreviousTrack,
  regionStyles,
  statusText,
  titleLink,
}: FullPlayerRemoteRegionProps): JSX.Element {
  const { t } = useTranslation();
  const { styles: themeStyles } = useTheme();
  const title = display.resource.title ?? '';
  const channelTitle = display.resource.channel_title;
  const showChannelTitle = channelTitle !== null && channelTitle.trim().length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        artwork: {
          height: '100%',
          width: '100%',
        },
        liveLabel: {
          color: themeStyles.textPrimary.color,
          fontSize: typography.body.fontSize,
          fontWeight: '700',
          lineHeight: typography.body.lineHeight,
        },
        progressBand: {
          alignItems: 'center',
          height: FULL_PLAYER_PROGRESS_BLOCK_HEIGHT,
          justifyContent: 'center',
          width: '100%',
        },
        titleBlock: {
          height: FULL_PLAYER_TITLE_BLOCK_HEIGHT,
        },
        viewerBand: {
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 1,
          justifyContent: 'center',
          minHeight: 0,
          width: '100%',
        },
        viewerSquare: {
          alignSelf: 'center',
          height: artworkSize,
          overflow: 'hidden',
          width: artworkSize,
        },
      }),
    [artworkSize, themeStyles.textPrimary.color]
  );

  return (
    <View style={regionStyles.region} testID="full-player-remote-region">
      <View style={regionStyles.content}>
        <View style={regionStyles.upperBands}>
          <View pointerEvents="box-none" style={[regionStyles.titleBlock, styles.titleBlock]}>
            {titleLink !== null ? (
              <Pressable
                accessibilityLabel={contentLinkLabel(titleLink)}
                accessibilityRole="link"
                onPress={onOpenTitle}
                style={({ pressed }) => [regionStyles.titleLink, pressed ? { opacity: 0.6 } : null]}
                testID="full-player-remote-title-link"
              >
                <MarqueeText
                  align="center"
                  style={regionStyles.title}
                  testID="full-player-remote-title"
                  turnGroup="full-player"
                  turnOrder={0}
                >
                  {title}
                </MarqueeText>
              </Pressable>
            ) : (
              <MarqueeText
                align="center"
                style={regionStyles.title}
                testID="full-player-remote-title"
                turnGroup="full-player"
                turnOrder={0}
              >
                {title}
              </MarqueeText>
            )}
            {showChannelTitle && channelTitle !== null ? (
              channelLink !== null ? (
                <Pressable
                  accessibilityLabel={contentLinkLabel(channelLink)}
                  accessibilityRole="link"
                  onPress={onOpenChannel}
                  style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}
                  testID="full-player-remote-channel-link"
                >
                  <Text numberOfLines={1} style={regionStyles.subtitleLink}>
                    {channelTitle}
                  </Text>
                </Pressable>
              ) : (
                <Text
                  numberOfLines={1}
                  style={regionStyles.subtitle}
                  testID="full-player-remote-channel"
                >
                  {channelTitle}
                </Text>
              )
            ) : null}
          </View>

          <View pointerEvents="box-none" style={regionStyles.artworkBand}>
            <View style={styles.viewerBand}>
              <View pointerEvents="box-none" style={styles.viewerSquare}>
                <CoverImage
                  accessibilityLabel={t('media_player.media_player_image')}
                  style={styles.artwork}
                  testID="full-player-remote-artwork"
                  uri={display.resource.image_url}
                  viewerUri={display.resource.image_url}
                />
              </View>
            </View>
          </View>

          <FullPlayerRemoteSegmentBand
            chapters={chapters}
            isLive={display.isLive}
            refKind={display.resource.ref.kind}
            statusText={statusText}
          />

          {display.controls.showsProgress ? (
            <View pointerEvents="auto">
              <FullPlayerRemoteScrubber durationSeconds={display.durationSeconds} />
            </View>
          ) : (
            <View pointerEvents="auto" style={styles.progressBand}>
              <Text style={styles.liveLabel} testID="full-player-remote-live">
                {t('media.livestream.live')}
              </Text>
            </View>
          )}
        </View>

        <View pointerEvents="auto" style={regionStyles.controlStack}>
          <FullPlayerTransportRow
            hasEpisodeChaptersForTrackButtons={false}
            hasNextQueueItem
            hideJumpButtons={!display.controls.canSkip}
            isMusicNowPlaying={isMusicMediumId(display.resource.medium)}
            onErrorPress={noop}
            onJumpBack={onJumpBack}
            onJumpForward={onJumpForward}
            onPause={onPause}
            onPlay={onPlay}
            onSkipToNext={onSkipToNext}
            onSkipToNextTrack={onSkipToNextTrack}
            onSkipToPrevious={onSkipToPrevious}
            onSkipToPreviousTrack={onSkipToPreviousTrack}
            state={display.transportState}
          />
          <FullPlayerUtilityRow
            isMusicNowPlaying={false}
            isRepeatEnabled={false}
            isShuffleEnabled={false}
            mode={display.controls.canSetRate ? 'remote' : 'remoteLive'}
            onOpenMore={noop}
            onOpenSleepTimer={noop}
            onOpenSpeed={onOpenSpeed}
            onToggleRepeat={noop}
            onToggleShuffle={noop}
            playbackRate={display.rate}
          />
        </View>
      </View>
    </View>
  );
}
