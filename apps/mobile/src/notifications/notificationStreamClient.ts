// axios in React Native cannot stream a response body, so this file calls fetch directly.
import { fetch } from 'expo/fetch';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AccountNotificationStreamEvent } from '@podverse/helpers';
import {
  ACCOUNT_EVENTS_STREAM_API_PATH,
  parseAccountNotificationStreamEvent,
} from '@podverse/helpers';

import { buildMobileClientHeaders } from '../auth/mobileClientHeaders';
import { getMobileConfig } from '../config';
import { NotificationStreamHttpError } from './notificationStreamPolicy';
import { createSseEventParser } from './sseEventParser';

export type OpenNotificationStreamParams = {
  accessToken: string | null;
  lastEventId: number | null;
  signal: AbortSignal;
  onEvent: (event: AccountNotificationStreamEvent) => void;
  onActivity: () => void;
};

export type NotificationStreamHandle = {
  /** Resolves when the server ends the stream; rejects when the read fails or is aborted. */
  readUntilEnd: () => Promise<void>;
};

/**
 * Opens the account event stream and resolves once 2xx response headers arrive, so an auth
 * wrapper can cover the open without covering the long read. A null API config fails as 404,
 * which the controller treats as poll-only.
 */
export async function openNotificationStream(
  params: OpenNotificationStreamParams
): Promise<NotificationStreamHandle> {
  const { api } = getMobileConfig();
  if (api === null) {
    throw new NotificationStreamHttpError(404);
  }

  const headers: Record<string, string> = {
    ...buildMobileClientHeaders(Constants.expoConfig?.version, Platform.OS),
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
  if (params.accessToken !== null) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  }
  if (params.lastEventId !== null) {
    headers['Last-Event-ID'] = String(params.lastEventId);
  }

  const response = await fetch(
    `${api.baseUrl.replace(/\/$/, '')}${ACCOUNT_EVENTS_STREAM_API_PATH}`,
    {
      method: 'GET',
      credentials: 'omit',
      headers,
      signal: params.signal,
    }
  );

  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new NotificationStreamHttpError(response.status);
  }

  const body = response.body;
  if (body === null) {
    throw new Error('Notification stream response has no body');
  }

  return {
    readUntilEnd: async () => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseEventParser();

      const handleText = (text: string): void => {
        for (const item of parser.push(text)) {
          params.onActivity();
          if (item.kind !== 'event') {
            continue;
          }
          const event = parseAccountNotificationStreamEvent(item.event, item.data);
          if (event !== null) {
            params.onEvent(event);
          }
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          handleText(decoder.decode(value, { stream: true }));
        }
        handleText(decoder.decode());
      } finally {
        reader.releaseLock();
      }
    },
  };
}
