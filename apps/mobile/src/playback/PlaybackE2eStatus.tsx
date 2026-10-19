import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isMobileE2eFromEnv } from '../config/env';
import { usePlaybackSession } from './PlaybackProvider';
import { getPlaybackSourceMarker, subscribePlaybackSourceMarker } from './playbackSourceMarker';

/**
 * E2E-only playback status markers in tab chrome. The mini player has no distinct playing/paused
 * testID, so auto-queue and load-state flows read these while staying on product screens. Skip-next
 * and complete live on the More E2E Playback screen with the other harness controls.
 * `playback-source-e2e` is `remote` while streaming and `local` after a completed download of that
 * file is what the engine is playing.
 *
 * The node is a 1×1 absolute marker, same as the perf report. It is not part of the bottom-chrome
 * overlay height, and it does not receive touches.
 */
export function PlaybackE2eStatus() {
  const { activeTarget, isPlaying, nowPlaying } = usePlaybackSession();
  const source = useSyncExternalStore(subscribePlaybackSourceMarker, getPlaybackSourceMarker);

  if (!isMobileE2eFromEnv() || activeTarget === null) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <Text numberOfLines={1} style={styles.marker} testID="playback-active-e2e">
        {isPlaying ? 'playing' : 'paused'}
      </Text>
      <Text numberOfLines={1} style={styles.marker} testID="playback-now-playing-title-e2e">
        {nowPlaying?.title ?? ''}
      </Text>
      {source !== null ? (
        <Text numberOfLines={1} style={styles.marker} testID="playback-source-e2e">
          {source}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    height: 1,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  marker: {
    height: 1,
    width: 1,
  },
});
