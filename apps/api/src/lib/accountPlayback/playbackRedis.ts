import { config } from '@api/config/index.js';
import { loggerService } from '@api/factories/loggerService.js';
import { Redis } from 'ioredis';

import { ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS } from '@podverse/orm';

const PLAYBACK_CONNECTION_NAME = 'podverse-api-playback';

let connection: Redis | null = null;

/** The playback connection is not open; playback routes answer 503 and the hub skips snapshots. */
export class PlaybackStoreUnavailableError extends Error {
  constructor(message: string = 'Playback store is unavailable') {
    super(message);
    this.name = 'PlaybackStoreUnavailableError';
  }
}

const createPlaybackConnection = (): Redis =>
  new Redis({
    host: config.keyvaldb.host,
    port: config.keyvaldb.port,
    password: config.keyvaldb.password,
    connectionName: PLAYBACK_CONNECTION_NAME,
    retryStrategy: () => ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

const attachOutageLogs = (redis: Redis): void => {
  let outageLogged = false;

  redis.on('error', (error: Error) => {
    if (outageLogged) {
      return;
    }
    outageLogged = true;
    loggerService.warn('Playback Redis connection lost', {
      connection: PLAYBACK_CONNECTION_NAME,
      error: error.message,
    });
  });

  redis.on('ready', () => {
    if (!outageLogged) {
      return;
    }
    outageLogged = false;
    loggerService.info('Playback Redis connection restored', {
      connection: PLAYBACK_CONNECTION_NAME,
    });
  });
};

/** Opens the playback connection. A second call does nothing. */
export function startPlaybackRedis(): void {
  if (connection !== null) {
    return;
  }

  const redis = createPlaybackConnection();
  connection = redis;
  attachOutageLogs(redis);

  // connect() also rejects when the socket fails. The error listener logs that outage.
  void redis.connect().catch(() => undefined);
}

/** Closes the playback connection. Safe to call twice. */
export async function closePlaybackRedis(): Promise<void> {
  const redis = connection;
  if (redis === null) {
    return;
  }

  connection = null;
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  } else {
    redis.disconnect();
  }
}

/**
 * The open connection; throws `PlaybackStoreUnavailableError` when not started or not ready, so
 * callers fail fast during an outage instead of waiting for a reconnect.
 */
export function getPlaybackRedis(): Redis {
  if (connection === null || connection.status !== 'ready') {
    throw new PlaybackStoreUnavailableError();
  }
  return connection;
}
