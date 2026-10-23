import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { AuthStatus } from '../auth/AuthProvider';
import type { MobileAuthRequestContext } from '../data/repositories/types';
import {
  getInitialNotificationReadTarget,
  subscribeToNotificationOpenReadTarget,
} from '../push/notificationRouting';
import { markPushNotificationRead } from './notificationReadActions';

export const usePushTapMarksRead = (
  status: AuthStatus,
  authDepsRef: RefObject<MobileAuthRequestContext>
): void => {
  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const unsubscribe = subscribeToNotificationOpenReadTarget((target) => {
      void markPushNotificationRead(authDepsRef.current, target);
    });

    void getInitialNotificationReadTarget().then((target) => {
      if (target !== null) {
        void markPushNotificationRead(authDepsRef.current, target);
      }
    });

    return unsubscribe;
  }, [authDepsRef, status]);
};
