import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { breakpoints } from '@podverse/design-tokens';

import { useActionError } from '../../feedback/ActionErrorProvider';
import { useAddByRssArtistIndexVersion } from '../../hooks/useAddByRssArtistIndexVersion';
import { stopPropagation } from '../../lib/gesture/stopPropagation';
import { artistAlbumLine, playbackTargetArtists } from '../../lib/playback/verifiedArtists';
import {
  useCrossDevicePlayerDisplay,
  usePlayerStatusText,
} from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import { usePlaybackSession } from '../../playback/PlaybackProvider';
import { MINI_PLAYER_ARTWORK_SIZE } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useResponsive } from '../../theme/useResponsive';
import { useTheme } from '../../theme/useTheme';
import { MarqueeText } from '../primitives/MarqueeText';
import { MiniPlayerArtwork } from './MiniPlayerArtwork';
import { MiniPlayerProgress } from './MiniPlayerProgress';
import { MiniPlayerRemoteArtwork, MiniPlayerRemoteProgress } from './MiniPlayerRemote';
import { PlaybackDeviceButton } from './PlaybackDeviceButton';
import { PlayerTransportButton } from './PlayerTransportButton';

type MiniPlayerProps = {
  onExpand: () => void;
};

/** Second-line ink paints 1pt above its layout slot. Both lines keep their layout positions. */
const MINI_PLAYER_CHANNEL_TITLE_NUDGE = -2;

/**
 * Mini player fixed above the tab bar. Shows this phone's session, or another device's playback
 * when the cross-device display says so. Progress fill and chapter artwork live in leaf components
 * so the shell does not re-render on every playhead tick.
 */
export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const { t } = useTranslation();
  const { isTablet } = useResponsive();
  const { styles: themeStyles, tokens } = useTheme();
  const {
    activeTarget,
    lastPlaybackError,
    nowPlaying,
    pause,
    resume,
    retryPlayback,
    transportState,
  } = usePlaybackSession();
  const display = useCrossDevicePlayerDisplay();
  const statusText = usePlayerStatusText(display);
  const remote = display.kind === 'remote' ? display : null;
  const { openPlaybackError } = useActionError();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: tokens.background.secondary,
          overflow: 'hidden',
        },
        containerTablet: {
          alignSelf: 'center',
          maxWidth: breakpoints.lg,
          width: '100%',
        },
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          height: MINI_PLAYER_ARTWORK_SIZE,
        },
        remoteStatus: {
          color: themeStyles.textSecondary.color,
        },
        subtitle: {
          ...typography.body,
          color: tokens.text.link,
          fontWeight: '600',
          transform: [{ translateY: MINI_PLAYER_CHANNEL_TITLE_NUDGE }],
        },
        textColumn: {
          flex: 1,
          gap: tokens.spacing.sm,
          minWidth: 0,
          paddingHorizontal: tokens.spacing.base,
        },
        title: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
          fontSize: 19,
          lineHeight: 26,
        },
        transport: {
          paddingRight: tokens.spacing.base,
        },
      }),
    [themeStyles, tokens]
  );

  const artistIndexVersion = useAddByRssArtistIndexVersion();
  const artists = useMemo(
    () => playbackTargetArtists(activeTarget),
    [activeTarget, artistIndexVersion]
  );

  if (remote === null && (activeTarget === null || nowPlaying === null)) {
    return null;
  }

  let title: string;
  if (remote !== null) {
    title = remote.resource.title ?? (nowPlaying === null ? '' : nowPlaying.title);
  } else if (nowPlaying !== null) {
    title = nowPlaying.title;
  } else {
    return null;
  }
  const secondLine = nowPlaying === null ? null : artistAlbumLine(artists, nowPlaying.channelTitle);

  const handlePlay = (event: GestureResponderEvent) => {
    stopPropagation(event);
    void resume();
  };

  const handlePause = (event: GestureResponderEvent) => {
    stopPropagation(event);
    pause();
  };

  const handleErrorPress = (event: GestureResponderEvent) => {
    stopPropagation(event);
    openPlaybackError(lastPlaybackError, () => {
      void retryPlayback();
    });
  };

  return (
    <Pressable
      accessibilityLabel={t('media_player.show_fullscreen_media_player')}
      accessibilityRole="button"
      onPress={onExpand}
      style={[styles.container, isTablet ? styles.containerTablet : undefined]}
      testID="mini-player"
    >
      {remote !== null ? (
        <MiniPlayerRemoteProgress durationSeconds={remote.durationSeconds} isLive={remote.isLive} />
      ) : (
        <MiniPlayerProgress />
      )}
      <View style={styles.row}>
        {remote !== null ? (
          <MiniPlayerRemoteArtwork
            accessibilityLabel={t('media_player.media_player_image')}
            imageUrl={remote.resource.image_url}
          />
        ) : (
          <MiniPlayerArtwork accessibilityLabel={t('media_player.media_player_image')} />
        )}
        <View style={styles.textColumn}>
          <MarqueeText
            style={styles.title}
            testID="mini-player-title"
            turnGroup="mini-player"
            turnOrder={0}
          >
            {title}
          </MarqueeText>
          {statusText !== null ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, styles.remoteStatus]}
              testID="mini-player-remote-status"
            >
              {statusText}
            </Text>
          ) : secondLine !== null ? (
            <MarqueeText
              style={styles.subtitle}
              testID="mini-player-subtitle"
              turnGroup="mini-player"
              turnOrder={1}
            >
              {secondLine}
            </MarqueeText>
          ) : null}
        </View>
        <PlaybackDeviceButton appearance="mini" testID="mini-player-devices" />
        <View style={styles.transport}>
          <PlayerTransportButton
            appearance="bare"
            onPause={handlePause}
            onPlay={handlePlay}
            onErrorPress={handleErrorPress}
            state={remote !== null ? remote.transportState : transportState}
            testID="mini-player-play-pause"
          />
        </View>
      </View>
    </Pressable>
  );
}
