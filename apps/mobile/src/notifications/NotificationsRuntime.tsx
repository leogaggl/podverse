import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import type { AuthRequestDeps } from '../auth/authRequestWithRefresh';
import {
  AccessTokenRefreshUnavailableError,
  runWithMobileAuthRefresh,
} from '../auth/authRequestWithRefresh';
import { notificationsRepository } from '../data/repositories';
import { usePlaybackIsPlaying } from '../playback/PlaybackProvider';
import { useOfflineMode } from '../prefs/offlineMode';
import { subscribeTermsBlocksAccountSync, termsBlocksAccountSync } from '../terms/termsSyncGate';
import { openNotificationStream } from './notificationStreamClient';
import type { NotificationStreamController } from './notificationStreamController';
import { createNotificationStreamController } from './notificationStreamController';
import {
  NotificationStreamHttpError,
  shouldRunNotificationStream,
} from './notificationStreamPolicy';
import { usePushTapMarksRead } from './usePushTapMarksRead';

/**
 * Holds the account event stream while the app is signed in and either in the foreground or
 * playing audio, and feeds the notification stream store. Renders nothing. The stream starts from
 * an effect, so no request runs before the shell paints.
 */
export function NotificationsRuntime(): null {
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const authDepsRef = useRef<AuthRequestDeps>({
    accessToken,
    clearSession,
    refreshToken,
    setTokens,
  });

  // Declared before the run effect, so a start in the same commit reads these deps.
  useEffect(() => {
    authDepsRef.current = { accessToken, clearSession, refreshToken, setTokens };
  });

  usePushTapMarksRead(status, authDepsRef);

  const controllerRef = useRef<NotificationStreamController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createNotificationStreamController({
      connect: async ({ lastEventId, signal, onEvent, onActivity }) => {
        const handle = await runWithMobileAuthRefresh(authDepsRef.current, (token) =>
          openNotificationStream({ accessToken: token, lastEventId, signal, onEvent, onActivity })
        ).catch((error: unknown) => {
          throw error instanceof AccessTokenRefreshUnavailableError
            ? new NotificationStreamHttpError(401)
            : error;
        });
        await handle.readUntilEnd();
      },
      fetchUnreadCount: () => notificationsRepository.getUnreadCount(authDepsRef.current),
      now: () => Date.now(),
      random: () => Math.random(),
    });
  }
  const controller = controllerRef.current;

  const [isAppActive, setIsAppActive] = useState(() => AppState.currentState !== 'background');
  const isAppActiveRef = useRef(isAppActive);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        const returnedFromBackground = !isAppActiveRef.current;
        isAppActiveRef.current = true;
        if (returnedFromBackground) {
          controller.resumeForeground();
        }
        setIsAppActive(true);
        return;
      }
      // `inactive` (Control Center, an incoming-call sheet) keeps the previous value.
      if (next === 'background') {
        isAppActiveRef.current = false;
        setIsAppActive(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [controller]);

  const backgroundAudioActive = usePlaybackIsPlaying();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const termsBlocked = useSyncExternalStore(
    subscribeTermsBlocksAccountSync,
    termsBlocksAccountSync
  );

  const shouldRun = shouldRunNotificationStream({
    signedIn: status === 'authenticated' && accessToken !== null,
    appActive: isAppActive,
    backgroundAudioActive,
    offlineModeEnabled,
    termsBlocksAccountSync: termsBlocked,
  });

  useEffect(() => {
    if (shouldRun) {
      controller.start();
    } else {
      controller.stop();
    }
    return () => {
      controller.stop();
    };
  }, [controller, shouldRun]);

  return null;
}
