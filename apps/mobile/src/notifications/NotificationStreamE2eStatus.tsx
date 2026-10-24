import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isMobileE2eFromEnv } from '../config/env';
import {
  getNotificationStreamConnection,
  subscribeNotificationStreamConnection,
} from './notificationStreamStore';

/**
 * E2E-only marker in tab chrome: `notification-stream-e2e` reads the account event stream's
 * connection (`idle`, `connecting`, `open`, `retrying`, or `stopped`), so flows can wait for a
 * real stream to reach its first event.
 *
 * The node is a 1×1 absolute marker, same as the playback and perf markers. It is not part of the
 * bottom-chrome overlay height, and it does not receive touches.
 */
export function NotificationStreamE2eStatus() {
  const connection = useSyncExternalStore(
    subscribeNotificationStreamConnection,
    getNotificationStreamConnection
  );

  if (!isMobileE2eFromEnv()) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <Text numberOfLines={1} style={styles.marker} testID="notification-stream-e2e">
        {connection}
      </Text>
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
