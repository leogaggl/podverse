import { config } from '@api/config/index.js';
import { loggerService } from '@api/factories/loggerService.js';
import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';

import type { AccountEvent } from '@podverse/orm';
import {
  ACCOUNT_EVENT_CHANNEL,
  ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
  parseAccountEventMessage,
  registerAccountEventPublisher,
  unregisterAccountEventPublisher,
} from '@podverse/orm';

const PUBLISHER_CONNECTION_NAME = 'podverse-api-account-events-pub';
const SUBSCRIBER_CONNECTION_NAME = 'podverse-api-account-events-sub';

let malformedEventMessageWarned = false;
let publisher: Redis | null = null;

const createAccountEventConnection = (
  connectionName: string,
  options: Partial<RedisOptions> = {}
): Redis =>
  new Redis({
    host: config.keyvaldb.host,
    port: config.keyvaldb.port,
    password: config.keyvaldb.password,
    connectionName,
    retryStrategy: () => ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
    lazyConnect: true,
    ...options,
  });

const attachOutageLogs = (connection: Redis, connectionName: string): (() => void) => {
  let outageLogged = false;

  const onError = (error: Error): void => {
    if (outageLogged) {
      return;
    }
    outageLogged = true;
    loggerService.warn('Account event Redis connection lost', {
      connection: connectionName,
      error: error.message,
    });
  };

  const onReady = (): void => {
    if (!outageLogged) {
      return;
    }
    outageLogged = false;
    loggerService.info('Account event Redis connection restored', {
      connection: connectionName,
    });
  };

  connection.on('error', onError);
  connection.on('ready', onReady);
  return () => {
    connection.off('error', onError);
    connection.off('ready', onReady);
  };
};

const closeConnection = async (connection: Redis): Promise<void> => {
  if (connection.status === 'ready' || connection.status === 'connecting') {
    await connection.quit();
  } else {
    connection.disconnect();
  }
};

const logHandlerError = (context: 'event' | 'recovered', error: unknown): void => {
  loggerService.logError(
    context === 'event'
      ? 'Account event handler failed while processing an event'
      : 'Account event handler failed while processing recovery',
    error
  );
};

/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(): void {
  if (publisher !== null) {
    return;
  }

  const connection = createAccountEventConnection(PUBLISHER_CONNECTION_NAME, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  publisher = connection;
  attachOutageLogs(connection, PUBLISHER_CONNECTION_NAME);

  // connect() also rejects when the socket fails. The error listener logs that outage.
  void connection.connect().catch(() => undefined);
  registerAccountEventPublisher(connection);
}

/** Unregisters the publisher and closes its connection. Safe to call twice. */
export async function closeAccountEventPublisher(): Promise<void> {
  const connection = publisher;
  if (connection === null) {
    return;
  }

  publisher = null;
  unregisterAccountEventPublisher();
  await closeConnection(connection);
}

export type AccountEventSubscription = { close(): Promise<void> };

export function subscribeAccountEvents(handlers: {
  onEvent: (event: AccountEvent) => void;
  onRecovered: () => void;
}): AccountEventSubscription {
  const connection = createAccountEventConnection(SUBSCRIBER_CONNECTION_NAME, {
    autoResubscribe: false,
  });
  const detachOutageLogs = attachOutageLogs(connection, SUBSCRIBER_CONNECTION_NAME);
  let closed = false;
  let subscribeErrorLogged = false;

  const onReady = async (): Promise<void> => {
    try {
      await connection.subscribe(ACCOUNT_EVENT_CHANNEL);
      subscribeErrorLogged = false;
      try {
        handlers.onRecovered();
      } catch (error) {
        logHandlerError('recovered', error);
      }
    } catch (error) {
      if (!subscribeErrorLogged) {
        subscribeErrorLogged = true;
        loggerService.warn('Failed to subscribe to account event channel', {
          connection: SUBSCRIBER_CONNECTION_NAME,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const onMessage = (channel: string, message: string): void => {
    if (channel !== ACCOUNT_EVENT_CHANNEL) {
      return;
    }

    const events = parseAccountEventMessage(message);
    if (events === null) {
      if (!malformedEventMessageWarned) {
        malformedEventMessageWarned = true;
        loggerService.warn('Ignoring malformed account event message');
      }
      return;
    }

    for (const event of events) {
      try {
        handlers.onEvent(event);
      } catch (error) {
        logHandlerError('event', error);
      }
    }
  };

  connection.on('ready', onReady);
  connection.on('message', onMessage);
  void connection.connect().catch(() => undefined);

  return {
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      connection.off('ready', onReady);
      connection.off('message', onMessage);
      detachOutageLogs();
      await closeConnection(connection);
    },
  };
}
