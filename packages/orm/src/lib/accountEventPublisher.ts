import { getLoggerService, getORMConfig } from '@orm/context.js';

import { isPlainObject } from '@podverse/helpers';

/**
 * Redis pub/sub channel for every account event. Pub/sub channels are shared across logical
 * databases, so the name carries the product prefix.
 */
export const ACCOUNT_EVENT_CHANNEL = 'podverse:account-events';

/** Most events in one published message; larger batches go out as several messages. */
export const ACCOUNT_EVENT_MAX_PER_MESSAGE = 500;

/** Fixed delay between reconnect attempts for every account event Redis connection. */
export const ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS = 5_000;

/**
 * Data for each event type the server publishes. Types are namespaced: `notification.*` is in
 * use; `playback.*` is reserved for cross-device playback state and control commands.
 */
export type AccountEventDataByType = {
  'notification.created': { notification_ids: number[] };
  'notification.read_all': { last_read_at: string };
  'notification.read_one': { notification_id: number };
};

export type AccountEventType = keyof AccountEventDataByType;

/** An event a process may publish. */
export type PublishableAccountEvent = {
  [K in AccountEventType]: { account_id: number; type: K; data: AccountEventDataByType[K] };
}[AccountEventType];

/**
 * An event as received. `type` is any namespaced string and `data` is unchecked until the
 * handler for that type validates it, so a subscriber on an older build ignores newer types.
 */
export type AccountEvent = { account_id: number; type: string; data: unknown };

/** The part of an ioredis client the publisher uses. */
export type AccountEventPublishClient = {
  publish(channel: string, message: string): Promise<unknown>;
};

let client: AccountEventPublishClient | null = null;
let publishFailing = false;

/** Sets this process's publish connection, replacing any earlier one. */
export function registerAccountEventPublisher(nextClient: AccountEventPublishClient): void {
  client = nextClient;
}

export function unregisterAccountEventPublisher(): void {
  client = null;
}

export function hasAccountEventPublisher(): boolean {
  return client !== null;
}

/** Startup check: logs a warning when this process has no publisher registered. */
export function warnIfNoAccountEventPublisher(processName: string): void {
  if (client !== null) {
    return;
  }
  getLoggerService().warn(
    'No account event publisher is registered; notification changes from this process will not reach open streams',
    { processName }
  );
}

const chunkEvents = (events: PublishableAccountEvent[]): PublishableAccountEvent[][] => {
  const chunks: PublishableAccountEvent[][] = [];
  for (let start = 0; start < events.length; start += ACCOUNT_EVENT_MAX_PER_MESSAGE) {
    chunks.push(events.slice(start, start + ACCOUNT_EVENT_MAX_PER_MESSAGE));
  }
  return chunks;
};

/**
 * Sends events to every API pod. Call it only after the write that produced the events has
 * committed, never inside a transaction callback, because a subscriber loads the rows the moment
 * it receives the event.
 *
 * A Redis failure never rejects: the row is already committed, and open streams catch up through
 * the state snapshot on their next connection. A test-env ORM with no publisher registered
 * rejects, so a write path that never registered fails its test.
 */
export async function publishAccountEvents(events: PublishableAccountEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const publishClient = client;
  if (publishClient === null) {
    if (getORMConfig().nodeEnv === 'test') {
      throw new Error('Account events were written with no account event publisher registered');
    }
    getLoggerService().warn('Account events dropped: no account event publisher is registered', {
      count: events.length,
    });
    return;
  }

  try {
    await Promise.all(
      chunkEvents(events).map((chunk) =>
        publishClient.publish(ACCOUNT_EVENT_CHANNEL, JSON.stringify({ events: chunk }))
      )
    );
    if (publishFailing) {
      publishFailing = false;
      getLoggerService().info('Account event publishing recovered');
    }
  } catch (error) {
    if (!publishFailing) {
      publishFailing = true;
      getLoggerService().warn(
        'Account event publish failed; open streams catch up on their next connection',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const toAccountEvent = (entry: unknown): AccountEvent | null => {
  if (!isPlainObject(entry) || !('data' in entry)) {
    return null;
  }
  const { account_id, type, data } = entry;
  if (!isPositiveSafeInteger(account_id) || typeof type !== 'string' || type.length === 0) {
    return null;
  }
  return { account_id, type, data };
};

/** Parses one received message, or returns null when it is not an account event batch. */
export function parseAccountEventMessage(message: string): AccountEvent[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.events)) {
    return null;
  }

  const entries: unknown[] = parsed.events;
  const events: AccountEvent[] = [];
  for (const entry of entries) {
    const event = toAccountEvent(entry);
    if (event !== null) {
      events.push(event);
    }
  }
  return events;
}
