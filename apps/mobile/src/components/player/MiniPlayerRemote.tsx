import { StyleSheet } from 'react-native';

import { clampRatio } from '@podverse/helpers/math';

import { useRemotePlaybackPositionSeconds } from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import {
  MINI_PLAYER_ARTWORK_SIZE,
  MINI_PLAYER_PROGRESS_EDGE_HEIGHT,
} from '../../theme/screenLayout';
import { CoverImage } from '../primitives/CoverImage';
import { ProgressTrack } from '../primitives/ProgressTrack';

type MiniPlayerRemoteProgressProps = {
  durationSeconds: number | null;
  isLive: boolean;
};

/**
 * Remote mini-player top edge. The fill follows the other device's position, once a second, so the
 * mini player shell stays off that clock. A livestream keeps the edge and leaves the fill empty.
 */
export function MiniPlayerRemoteProgress({
  durationSeconds,
  isLive,
}: MiniPlayerRemoteProgressProps) {
  const positionSeconds = useRemotePlaybackPositionSeconds();
  const progressRatio =
    isLive || durationSeconds === null || durationSeconds <= 0 || positionSeconds === null
      ? 0
      : clampRatio(positionSeconds / durationSeconds);

  return (
    <ProgressTrack
      fillTestID="mini-player-progress"
      flush
      height={MINI_PLAYER_PROGRESS_EDGE_HEIGHT}
      ratio={progressRatio}
      style={styles.track}
    />
  );
}

type MiniPlayerRemoteArtworkProps = {
  accessibilityLabel: string;
  imageUrl: string | null;
};

/** Shared item image for remote playback. This phone's video surface stays unmounted. */
export function MiniPlayerRemoteArtwork({
  accessibilityLabel,
  imageUrl,
}: MiniPlayerRemoteArtworkProps) {
  return (
    <CoverImage
      accessibilityLabel={accessibilityLabel}
      opensViewer={false}
      style={styles.artwork}
      uri={imageUrl}
    />
  );
}

const styles = StyleSheet.create({
  artwork: {
    height: MINI_PLAYER_ARTWORK_SIZE,
    width: MINI_PLAYER_ARTWORK_SIZE,
  },
  track: {
    height: MINI_PLAYER_PROGRESS_EDGE_HEIGHT,
  },
});
