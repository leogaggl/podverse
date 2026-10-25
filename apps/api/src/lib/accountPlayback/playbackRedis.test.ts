import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type PlaybackRedisOptions = {
  host: string;
  port: number;
  password: string;
  connectionName: string;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number | null;
  lazyConnect: boolean;
  retryStrategy: (times: number) => number | null | void;
};

type PlaybackRedisDouble = {
  options: PlaybackRedisOptions;
  status: string;
  connect: Mock;
  quit: Mock;
  disconnect: Mock;
};

const { redisInstances, loggerService } = vi.hoisted(() => {
  const redisInstances: PlaybackRedisDouble[] = [];
  return {
    redisInstances,
    loggerService: {
      info: vi.fn(),
      logError: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('ioredis', () => {
  class Redis {
    readonly options: PlaybackRedisOptions;
    status = 'wait';
    connect = vi.fn(async () => Promise.resolve());
    quit = vi.fn(async () => Promise.resolve('OK'));
    disconnect = vi.fn();

    constructor(options: PlaybackRedisOptions) {
      this.options = options;
      redisInstances.push(this);
    }

    on(): this {
      return this;
    }
  }

  return { Redis };
});

vi.mock('@api/config/index.js', () => ({
  config: {
    keyvaldb: {
      host: 'keyval.example',
      password: 'secret',
      port: 6379,
    },
  },
}));

vi.mock('@api/factories/loggerService.js', () => ({
  loggerService,
}));

const loadPlaybackRedisModule = async () => import('./playbackRedis.js');

const onlyConnection = (): PlaybackRedisDouble => {
  expect(redisInstances).toHaveLength(1);
  const connection = redisInstances[0];
  if (connection === undefined) {
    throw new Error('missing playback connection');
  }
  return connection;
};

describe('playback Redis connection', () => {
  beforeEach(() => {
    redisInstances.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('startPlaybackRedis opens one connection named podverse-api-playback and ignores a second start', async () => {
    const { closePlaybackRedis, startPlaybackRedis } = await loadPlaybackRedisModule();

    startPlaybackRedis();
    startPlaybackRedis();

    const connection = onlyConnection();
    expect(connection.options).toMatchObject({
      connectionName: 'podverse-api-playback',
      enableOfflineQueue: false,
      host: 'keyval.example',
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      password: 'secret',
      port: 6379,
    });
    expect(connection.options.retryStrategy(1)).toBe(5_000);
    expect(connection.connect).toHaveBeenCalledTimes(1);

    await closePlaybackRedis();
  });

  it('getPlaybackRedis throws PlaybackStoreUnavailableError until the connection is ready', async () => {
    const {
      closePlaybackRedis,
      getPlaybackRedis,
      PlaybackStoreUnavailableError,
      startPlaybackRedis,
    } = await loadPlaybackRedisModule();

    expect(() => getPlaybackRedis()).toThrow(PlaybackStoreUnavailableError);

    startPlaybackRedis();
    const connection = onlyConnection();
    expect(() => getPlaybackRedis()).toThrow(PlaybackStoreUnavailableError);

    connection.status = 'ready';
    expect(getPlaybackRedis()).toBe(connection);

    connection.status = 'reconnecting';
    expect(() => getPlaybackRedis()).toThrow(PlaybackStoreUnavailableError);

    await closePlaybackRedis();
  });

  it('closePlaybackRedis quits once across two close calls, after which getPlaybackRedis throws', async () => {
    const {
      closePlaybackRedis,
      getPlaybackRedis,
      PlaybackStoreUnavailableError,
      startPlaybackRedis,
    } = await loadPlaybackRedisModule();
    startPlaybackRedis();
    const connection = onlyConnection();
    connection.status = 'ready';

    await closePlaybackRedis();
    await closePlaybackRedis();

    expect(connection.quit).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).not.toHaveBeenCalled();
    expect(() => getPlaybackRedis()).toThrow(PlaybackStoreUnavailableError);
  });
});
