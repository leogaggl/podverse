import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    status = 'ready';
    connect = vi.fn(() => Promise.resolve());
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

vi.mock('@management-api/config/index.js', () => ({
  config: {
    keyvaldb: {
      host: 'keyval.example',
      port: 6379,
      password: 'secret',
    },
  },
}));

vi.mock('@management-api/factories/loggerService.js', () => ({
  loggerService,
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
    redisInstances.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('registers one publisher connection and ignores a second start', async () => {
    const { startAccountEventPublisher } = await loadPublisher();

    startAccountEventPublisher();
    startAccountEventPublisher();

    expect(redisInstances).toHaveLength(1);
    const connection = requireConnection();
    expect(connection.options.connectionName).toBe('podverse-management-api-account-events-pub');
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

  it('logs one warning for an outage and one recovery when the connection is ready again', async () => {
    const { startAccountEventPublisher } = await loadPublisher();
    startAccountEventPublisher();
    const connection = requireConnection();

    connection.emit('ready');
    connection.emit('error', new Error('connection refused'));
    connection.emit('error', new Error('connection refused'));

    expect(loggerService.warn).toHaveBeenCalledTimes(1);
    expect(loggerService.warn).toHaveBeenCalledWith('Account event Redis connection lost', {
      connection: 'podverse-management-api-account-events-pub',
      error: 'connection refused',
    });

    connection.emit('ready');

    expect(loggerService.info).toHaveBeenCalledTimes(1);
    expect(loggerService.info).toHaveBeenCalledWith('Account event Redis connection restored', {
      connection: 'podverse-management-api-account-events-pub',
    });
  });

  it('unregisters and quits once when close runs twice', async () => {
    const { startAccountEventPublisher, closeAccountEventPublisher } = await loadPublisher();
    startAccountEventPublisher();
    const connection = requireConnection();

    await closeAccountEventPublisher();
    await closeAccountEventPublisher();

    expect(unregisterAccountEventPublisher).toHaveBeenCalledTimes(1);
    expect(connection.quit).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).not.toHaveBeenCalled();
  });
});
