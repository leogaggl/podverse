import {
  ACCOUNT_EVENTS_STREAM_API_PATH,
  ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM,
} from '@podverse/helpers';

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * The account event stream URL. A positive `lastEventId` goes in the query so a connection the
 * client opens itself still gets replay; the browser's own reconnects send `Last-Event-ID` instead.
 */
export function buildNotificationStreamUrl(apiBaseUrl: string, lastEventId: number | null): string {
  const streamUrl = `${apiBaseUrl}${ACCOUNT_EVENTS_STREAM_API_PATH}`;
  if (lastEventId === null || !isPositiveSafeInteger(lastEventId)) {
    return streamUrl;
  }

  const url = new URL(streamUrl);
  url.searchParams.set(ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM, String(lastEventId));
  return url.toString();
}

/** A positive safe integer from a `MessageEvent.lastEventId` string (digits only), otherwise null. */
export function readSseLastEventId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return isPositiveSafeInteger(parsed) ? parsed : null;
}
