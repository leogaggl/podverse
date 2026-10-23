import { config } from '@management-api/config/index.js';
import { loggerService } from '@management-api/factories/loggerService.js';
import { Redis } from 'ioredis';

import {
  ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
  registerAccountEventPublisher,
  unregisterAccountEventPublisher,
} from '@podverse/orm';

const PUBLISHER_CONNECTION_NAME = 'podverse-management-api-account-events-pub';

let publisher: Redis | null = null;
let outageLogged = false;

const attachOutageLogs = (connection: Redis): void => {
  connection.on('error', (error: Error) => {
    if (outageLogged) {
      return;
    }
    outageLogged = true;
    loggerService.warn('Account event Redis connection lost', {
      connection: PUBLISHER_CONNECTION_NAME,
      error: error.message,
    });
  });

  connection.on('ready', () => {
    if (!outageLogged) {
      return;
    }
    outageLogged = false;
    loggerService.info('Account event Redis connection restored', {
      connection: PUBLISHER_CONNECTION_NAME,
    });
  });
};

/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(): void {
  if (publisher !== null) {
    return;
  }

  // A publish during an outage rejects at once instead of waiting in a queue.
  // retryStrategy never returns null, so the connection keeps retrying for the life of the process.
  const connection = new Redis({
    host: config.keyvaldb.host,
    port: config.keyvaldb.port,
    password: config.keyvaldb.password,
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
