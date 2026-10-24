import { getLoggerService } from '@workers/factories/loggerService.js';
import { Redis } from 'ioredis';

import {
  ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
  registerAccountEventPublisher,
  unregisterAccountEventPublisher,
} from '@podverse/orm';

const PUBLISHER_CONNECTION_NAME = 'podverse-workers-account-events-pub';

let publisher: Redis | null = null;
let outageLogged = false;

const attachOutageLogs = (connection: Redis): void => {
  connection.on('error', (error: Error) => {
    if (outageLogged) {
      return;
    }
    outageLogged = true;
    getLoggerService().warn('Account event Redis connection lost', {
      connection: PUBLISHER_CONNECTION_NAME,
      error: error.message,
    });
  });

  connection.on('ready', () => {
    if (!outageLogged) {
      return;
    }
    outageLogged = false;
    getLoggerService().info('Account event Redis connection restored', {
      connection: PUBLISHER_CONNECTION_NAME,
    });
  });
};

/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(config: {
  host: string;
  port: number;
  password: string;
}): void {
  if (publisher !== null) {
    return;
  }

  // A publish during an outage rejects at once instead of waiting in a queue.
  // retryStrategy never returns null, so the connection keeps retrying for the life of the
  // process.
  const connection = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    connectionName: PUBLISHER_CONNECTION_NAME,
    retryStrategy: () => ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  publisher = connection;
  outageLogged = false;
  attachOutageLogs(connection);

  // connect() also rejects when the socket fails. The error listener logs that outage.
  void connection.connect().catch(() => undefined);
  registerAccountEventPublisher(connection);
}

/**
 * Waits until the publisher connection is ready, up to `timeoutMs`. Resolves false on timeout
 * and never throws; the connection keeps retrying in the background.
 */
export async function waitForAccountEventPublisherReady(timeoutMs: number): Promise<boolean> {
  const connection = publisher;
  if (connection === null) {
    return false;
  }
  if (connection.status === 'ready') {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      connection.off('ready', onReady);
      resolve(ready);
    };
    const onReady = (): void => {
      finish(true);
    };
    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs);
    connection.on('ready', onReady);
    if (connection.status === 'ready') {
      finish(true);
    }
  });
}

/** Unregisters the publisher and closes its connection. Safe to call twice. */
export async function closeAccountEventPublisher(): Promise<void> {
  const connection = publisher;
  if (connection === null) {
    return;
  }
  publisher = null;
  unregisterAccountEventPublisher();
  if (connection.status === 'ready' || connection.status === 'connecting') {
    await connection.quit();
  } else {
    connection.disconnect();
  }
}
