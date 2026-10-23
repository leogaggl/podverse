// Web Push Service Worker for native push notifications.
// The page sets api_base on this script's URL when it registers the worker.

const WEB_PUSH_API_BASE_PARAM = 'api_base';

function readApiBaseUrl() {
  const raw = new URL(self.location.href).searchParams.get(WEB_PUSH_API_BASE_PARAM);
  if (raw === null || raw === '') {
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

const API_BASE_URL = readApiBaseUrl();

function readNonEmptyString(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
}

function readPushPayload(event) {
  try {
    const parsed = event.data ? event.data.json() : {};
    if (parsed === null || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

async function handlePush(event) {
  try {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasFocusedClient = clientList.some((client) => client.focused === true);
    const data = readPushPayload(event);

    if (hasFocusedClient) {
      clientList.forEach((client) => {
        if (client.focused) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION',
            payload: data,
          });
        }
      });
      return;
    }

    const nested =
      data.data !== null && data.data !== undefined && typeof data.data === 'object'
        ? data.data
        : null;
    const itemIdText = nested === null ? null : readNonEmptyString(nested.itemIdText);
    const type = nested === null ? null : readNonEmptyString(nested.type);
    const notificationTitle =
      data.title && String(data.title).trim() !== '' ? data.title : 'New notification';
    const notificationOptions = {
      body: data.body || '',
      icon: data.icon || '/favicon/web-app-manifest-192x192.png',
      badge: '/favicon/favicon-96x96.png',
      data: {
        url: data.link || '/',
        itemIdText,
        type,
      },
      requireInteraction: false,
      // Same tag replaces an earlier popup for the same item and type.
      tag:
        itemIdText && type
          ? 'podverse-notification-' + type + '-' + itemIdText
          : 'podverse-notification-' + Date.now(),
    };

    if (data.image) {
      notificationOptions.image = data.image;
    }

    await self.registration.showNotification(notificationTitle, notificationOptions);
  } catch (e) {
    console.error('Push event error:', e);
  }
}

function markNotificationRead(notificationData) {
  const record =
    notificationData !== null &&
    notificationData !== undefined &&
    typeof notificationData === 'object'
      ? notificationData
      : null;
  const itemIdText = record === null ? null : readNonEmptyString(record.itemIdText);
  const type = record === null ? null : readNonEmptyString(record.type);
  if (API_BASE_URL === null || itemIdText === null || type === null) {
    return Promise.resolve();
  }

  // A file in public/ cannot import the shared request helper, so this call uses fetch.
  return fetch(API_BASE_URL + '/account/notifications/mark-read-by-item', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id_text: itemIdText, type }),
  }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  const openTarget = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((clientList) => {
      const existing = clientList.find((client) => 'focus' in client);
      if (existing !== undefined && typeof existing.navigate === 'function') {
        return existing.navigate(absoluteUrl).then((navigated) => {
          const focused = navigated ?? existing;
          return 'focus' in focused ? focused.focus() : existing.focus();
        });
      }
      if (existing !== undefined) {
        return existing.focus();
      }
      return clients.openWindow(absoluteUrl);
    });

  event.waitUntil(Promise.all([openTarget, markNotificationRead(event.notification.data)]));
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
