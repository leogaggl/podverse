'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { AccountNotificationStreamEvent } from '@podverse/helpers';

import { getApiRequestService, getClientApiBaseUrl } from '../factories/apiRequestService';
import { useNotificationsUnreadCount } from '../hooks/useNotificationsUnreadCount';
import { reportSessionEnded } from '../lib/auth/sessionEndedNotice';
import type { NotificationStreamStatus } from '../lib/notifications/stream/notificationStreamConnection';
import { startNotificationStreamCoordinator } from '../lib/notifications/stream/notificationStreamCoordinator';
import { getNotificationStreamEventUnreadCount } from '../lib/notifications/stream/notificationStreamEventUnreadCount';
import type { PushMarkReadParams } from '../lib/notifications/webpush/foregroundPush';
import {
  buildForegroundPushNotificationOptions,
  readForegroundPushMessage,
  shouldShowForegroundPushPopup,
} from '../lib/notifications/webpush/foregroundPush';
import {
  ensureWebPushServiceWorkerScriptUrl,
  WEB_PUSH_SERVICE_WORKER_PATH,
} from '../lib/notifications/webpush/webPushServiceWorkerUrl';
import { useAccount } from './Account';
import { useConfig } from './Config';

type NotificationsContextType = {
  permission: NotificationPermission;
  setPermission: (val: NotificationPermission) => void;
  registered: boolean;
  setRegistered: (val: boolean) => void;
  upRegistered: boolean;
  setUPRegistered: (val: boolean) => void;
  upEndpoint: string | null;
  setUPEndpoint: (val: string | null) => void;
  unreadCount: number;
  notificationStreamStatus: NotificationStreamStatus;
  /** Subscribe to parsed stream events in this tab. Returns the unsubscribe function. */
  subscribeToNotificationStream: (
    listener: (event: AccountNotificationStreamEvent) => void
  ) => () => void;
};

export const NotificationsContext = createContext<NotificationsContextType>({
  permission: 'default',
  setPermission: () => {},
  registered: false,
  setRegistered: () => {},
  upRegistered: false,
  setUPRegistered: () => {},
  upEndpoint: null,
  setUPEndpoint: () => {},
  unreadCount: 0,
  notificationStreamStatus: 'off',
  subscribeToNotificationStream: () => () => {},
});

type NotificationsProviderProps = {
  children: ReactNode;
};

const toSameOriginPath = (link: string): string | null => {
  try {
    const parsed = new URL(link, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const NotificationsProvider = ({ children }: NotificationsProviderProps) => {
  const config = useConfig();
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [registered, setRegistered] = useState<boolean>(false);
  const [upRegistered, setUPRegistered] = useState<boolean>(false);
  const [upEndpoint, setUPEndpoint] = useState<string | null>(null);
  const [notificationStreamStatus, setNotificationStreamStatus] =
    useState<NotificationStreamStatus>('off');
  const { loggedInAccount } = useAccount();
  const accountId = loggedInAccount?.id ?? null;
  const { unreadCount, setUnreadCount } = useNotificationsUnreadCount({
    enabled: accountId !== null,
    streamOpen: notificationStreamStatus === 'open',
  });
  const streamListenersRef = useRef(new Set<(event: AccountNotificationStreamEvent) => void>());
  const subscribeToNotificationStream = useCallback(
    (listener: (event: AccountNotificationStreamEvent) => void) => {
      const listeners = streamListenersRef.current;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    []
  );

  const markPushNotificationRead = useCallback(
    (params: PushMarkReadParams) => {
      try {
        void getApiRequestService()
          .reqNotificationsMarkReadByItem(params)
          .then((response) => {
            setUnreadCount(response.unread_count);
          })
          .catch(() => undefined);
      } catch {
        // A failed mark leaves navigation and the badge update to the stream or the next poll.
      }
    },
    [setUnreadCount]
  );

  const handleForegroundPush = useCallback(
    (event: MessageEvent<unknown>) => {
      const notification = readForegroundPushMessage(event.data);
      if (notification === null) {
        return;
      }
      if (!shouldShowForegroundPushPopup(window.location.pathname)) {
        return;
      }
      if (Notification.permission !== 'granted') {
        return;
      }

      const shownOptions = buildForegroundPushNotificationOptions(notification);
      try {
        const popup = new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          tag: shownOptions.tag,
          data: { url: notification.link },
        });

        popup.onclick = (clickEvent) => {
          clickEvent.preventDefault();
          popup.close();
          window.focus();
          if (notification.markRead !== null) {
            markPushNotificationRead(notification.markRead);
          }
          const sameOriginPath = toSameOriginPath(notification.link);
          if (sameOriginPath !== null && sameOriginPath !== '/') {
            router.push(sameOriginPath);
            return;
          }
          if (sameOriginPath === null && notification.link !== '/') {
            window.location.assign(notification.link);
          }
        };
      } catch {
        // Chrome on Android allows notifications only through the service worker registration.
        if (!('serviceWorker' in navigator)) {
          console.warn('Could not show the foreground push notification');
          return;
        }
        void navigator.serviceWorker
          .getRegistration(WEB_PUSH_SERVICE_WORKER_PATH)
          .then((registration) => registration?.showNotification(notification.title, shownOptions))
          .catch((error: unknown) => {
            console.warn('Could not show the foreground push notification', error);
          });
      }
    },
    [markPushNotificationRead, router]
  );

  useEffect(() => {
    if (!loggedInAccount) {
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const apiRequestService = getApiRequestService();
    const vapidPublicKey = config.public.notifications.webpush.vapidPublicKey;

    const init = async () => {
      const p = Notification.permission;
      setPermission(p);
      if (p === 'granted') {
        void ensureWebPushServiceWorkerScriptUrl(getClientApiBaseUrl());
      }

      try {
        const upDevice = await apiRequestService.reqAccountUPDeviceGetForAccount();
        if (upDevice) {
          setUPRegistered(true);
          setUPEndpoint(upDevice.up_endpoint);
        } else {
          setUPRegistered(false);
          setUPEndpoint(null);
        }
      } catch (e) {
        console.warn('Could not fetch UP device to determine registration', e);
        setUPRegistered(false);
        setUPEndpoint(null);
      }

      // Check Web Push devices
      if (p === 'granted' && vapidPublicKey) {
        try {
          const devices = await apiRequestService.reqAccountWebPushDeviceGetAllForAccount();

          if (devices.length === 0) {
            setRegistered(false);
          } else {
            // Check if we have a current push subscription
            const registration = await navigator.serviceWorker.getRegistration(
              WEB_PUSH_SERVICE_WORKER_PATH
            );
            if (registration) {
              const subscription = await registration.pushManager.getSubscription();
              if (subscription) {
                const endpoint = subscription.endpoint;
                // Check if our current subscription endpoint matches any device
                const match = devices.find((d) => d.endpoint === endpoint);
                if (match) {
                  setRegistered(true);
                } else {
                  setRegistered(false);
                }
              } else {
                setRegistered(false);
              }
            } else {
              setRegistered(false);
            }
          }
        } catch (e) {
          console.warn('Could not fetch Web Push devices to determine registration', e);
          setRegistered(false);
        }
      }
    };

    init();

    // Set up listener for foreground push messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleForegroundPush);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleForegroundPush);
      }
    };
  }, [loggedInAccount, handleForegroundPush]);

  useEffect(() => {
    if (accountId === null) {
      setNotificationStreamStatus('off');
      return;
    }

    const listeners = streamListenersRef.current;
    const coordinator = startNotificationStreamCoordinator({
      accountId,
      apiBaseUrl: getClientApiBaseUrl(),
      onStatus: setNotificationStreamStatus,
      onEvent: (event) => {
        const nextUnreadCount = getNotificationStreamEventUnreadCount(event);
        if (nextUnreadCount !== null) {
          setUnreadCount(nextUnreadCount);
        }
        for (const listener of listeners) {
          listener(event);
        }
      },
      onSessionEnded: reportSessionEnded,
    });

    return () => {
      coordinator.stop();
    };
  }, [accountId, setUnreadCount]);

  return (
    <NotificationsContext.Provider
      value={{
        permission,
        setPermission,
        registered,
        setRegistered,
        upRegistered,
        setUPRegistered,
        upEndpoint,
        setUPEndpoint,
        unreadCount,
        notificationStreamStatus,
        subscribeToNotificationStream,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
