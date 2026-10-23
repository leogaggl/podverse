import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AccountEventRedisOptions = {
  host: string;
  port: number;
  password: string;
  connectionName: string;
  enableOfflineQueue: boolean;
  maxRetriesPerRequest: number | null;
  lazyConnect: boolean;
  retryStrategy: (times: number) => number | null | void;
};

type AccountEventRedisDouble = {
  options: AccountEventRedisOptions;
  status: string;
  connect: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  emit: (event: string | symbol, ...args: unknown[]) => boolean;
};

const publisherConfig = {
  host: 'keyval.example',
  port: 6379,
  password: 'secret',
};

const {
  redisInstances,
  loggerService,
  registerAccountEventPublisher,
  unregisterAccountEventPublisher,
} = vi.hoisted(() => {
  const redisInstances: AccountEventRedisDouble[] = [];
  return {
    redisInstances,
    loggerService: {
      warn: vi.fn(),
      info: vi.fn(),
    },
    registerAccountEventPublisher: vi.fn(),
    unregisterAccountEventPublisher: vi.fn(),
  };
});

vi.mock('ioredis', async () => {
  const { EventEmitter: RedisEventEmitter } = await import('node:events');

  class Redis extends RedisEventEmitter {
    readonly options: AccountEventRedisOptions;
    status = 'wait';
    connect = vi.fn(() => {
      this.status = 'connecting';
      return Promise.resolve();
    });
    quit = vi.fn(() => Promise.resolve('OK'));
    disconnect = vi.fn();
    publish = vi.fn(() => Promise.resolve(0));

    constructor(options: AccountEventRedisOptions) {
      super();
      this.options = options;
      redisInstances.push(this);
    }
  }

  return { Redis };
});

vi.mock('@workers/factories/loggerService.js', () => ({
  getLoggerService: () => loggerService,
}));

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();
  return {
    ...actual,
    registerAccountEventPublisher,
    unregisterAccountEventPublisher,
  };
});

const loadPublisher = async () => import('./accountEventPublisher.js');

const requireConnection = (): AccountEventRedisDouble => {
  const connection = redisInstances[0];
  expect(connection).toBeDefined();
  if (connection === undefined) {
    throw new Error('publisher connection was not created');
  }
  return connection;
};

describe('account event publisher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    redisInstances.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers one connection named podverse-workers-account-events-pub and ignores a second start', async () => {
    const { startAccountEventPublisher } = await loadPublisher();

    startAccountEventPublisher(publisherConfig);
    startAccountEventPublisher(publisherConfig);

    expect(redisInstances).toHaveLength(1);
    const connection = requireConnection();
    expect(connection.options.connectionName).toBe('podverse-workers-account-events-pub');
    expect(connection.options).toMatchObject({
      host: 'keyval.example',
      port: 6379,
      password: 'secret',
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    expect(connection.options.retryStrategy(1)).toBe(5_000);
    expect(connection.connect).toHaveBeenCalledTimes(1);
    expect(registerAccountEventPublisher).toHaveBeenCalledTimes(1);
    expect(registerAccountEventPublisher).toHaveBeenCalledWith(connection);
  });

  it('resolves true when ready fires before the timeout', async () => {
    const { startAccountEventPublisher, waitForAccountEventPublisherReady } = await loadPublisher();
    startAccountEventPublisher(publisherConfig);
    const connection = requireConnection();

    const pending = waitForAccountEventPublisherReady(5_000);
    connection.emit('ready');

    await expect(pending).resolves.toBe(true);
  });

  it('resolves false when ready does not fire before the timeout', async () => {
    const { startAccountEventPublisher, waitForAccountEventPublisherReady } = await loadPublisher();
    startAccountEventPublisher(publisherConfig);

    const pending = waitForAccountEventPublisherReady(5_000);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toBe(false);
  });

  it('logs one warning for two errors between ready events and one recovery on the next ready', async () => {
    const { startAccountEventPublisher } = await loadPublisher();
    startAccountEventPublisher(publisherConfig);
    const connection = requireConnection();

    connection.emit('ready');
    connection.emit('error', new Error('connection refused'));
    connection.emit('error', new Error('connection refused'));

    expect(loggerService.warn).toHaveBeenCalledTimes(1);
    expect(loggerService.warn).toHaveBeenCalledWith('Account event Redis connection lost', {
      connection: 'podverse-workers-account-events-pub',
      error: 'connection refused',
    });

    connection.emit('ready');

    expect(loggerService.info).toHaveBeenCalledTimes(1);
    expect(loggerService.info).toHaveBeenCalledWith('Account event Redis connection restored', {
      connection: 'podverse-workers-account-events-pub',
    });
  });

  it('unregisters and quits once when close runs twice', async () => {
    const { startAccountEventPublisher, closeAccountEventPublisher } = await loadPublisher();
    startAccountEventPublisher(publisherConfig);
    const connection = requireConnection();

    await closeAccountEventPublisher();
    await closeAccountEventPublisher();

    expect(unregisterAccountEventPublisher).toHaveBeenCalledTimes(1);
    expect(connection.quit).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).not.toHaveBeenCalled();
  });
});
