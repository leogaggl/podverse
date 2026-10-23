import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

type AccountEventRedisOptions = {
  host: string;
  port: number;
  password: string;
  connectionName: string;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number | null;
  lazyConnect: boolean;
  autoResubscribe?: boolean;
  retryStrategy: (times: number) => number | null | void;
};

type AccountEventRedisDouble = {
  options: AccountEventRedisOptions;
  status: string;
  connect: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
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
      info: vi.fn(),
      logError: vi.fn(),
      warn: vi.fn(),
    },
    registerAccountEventPublisher: vi.fn(),
    unregisterAccountEventPublisher: vi.fn(),
  };
});

vi.mock('ioredis', () => {
  class Redis extends EventEmitter {
    readonly options: AccountEventRedisOptions;
    status = 'ready';
    connect = vi.fn(async () => Promise.resolve());
    subscribe = vi.fn(async (_channel: string) => Promise.resolve(1));
    publish = vi.fn(async (_channel: string, _message: string) => Promise.resolve(0));
    quit = vi.fn(async () => Promise.resolve('OK'));
    disconnect = vi.fn();

    constructor(options: AccountEventRedisOptions) {
      super();
      this.options = options;
      redisInstances.push(this);
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

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();
  return {
    ...actual,
    registerAccountEventPublisher,
    unregisterAccountEventPublisher,
  };
});

const loadRedisModule = async () => import('./accountEventRedis.js');

const getConnectionByName = (connectionName: string): AccountEventRedisDouble => {
  const connection = redisInstances.find(
    (entry) => entry.options.connectionName === connectionName
  );
  expect(connection).toBeDefined();
  if (connection === undefined) {
    throw new Error(`missing connection ${connectionName}`);
  }
  return connection;
};

describe('account event Redis wiring', () => {
  beforeEach(() => {
    redisInstances.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('startAccountEventPublisher registers one publisher connection and ignores a second start', async () => {
    const { startAccountEventPublisher } = await loadRedisModule();

    startAccountEventPublisher();
    startAccountEventPublisher();

    expect(redisInstances).toHaveLength(1);
    const connection = getConnectionByName('podverse-api-account-events-pub');
    expect(connection.options).toMatchObject({
      enableOfflineQueue: false,
      host: 'keyval.example',
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      password: 'secret',
      port: 6379,
    });
    expect(connection.options.retryStrategy(1)).toBe(5_000);
    expect(connection.connect).toHaveBeenCalledTimes(1);
    expect(registerAccountEventPublisher).toHaveBeenCalledTimes(1);
    expect(registerAccountEventPublisher).toHaveBeenCalledWith(connection);
  });

  it('subscribeAccountEvents subscribes on ready then calls onRecovered, and does so again after reconnect', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const onEvent = vi.fn();
    const onRecovered = vi.fn();
    const subscription = subscribeAccountEvents({ onEvent, onRecovered });
    const connection = getConnectionByName('podverse-api-account-events-sub');

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(connection.subscribe).toHaveBeenCalledTimes(1);
      expect(onRecovered).toHaveBeenCalledTimes(1);
    });
    expect(connection.subscribe).toHaveBeenCalledWith('podverse:account-events');
    expect(connection.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      onRecovered.mock.invocationCallOrder[0]
    );

    connection.emit('error', new Error('connection refused'));
    connection.emit('ready');
    await vi.waitFor(() => {
      expect(connection.subscribe).toHaveBeenCalledTimes(2);
      expect(onRecovered).toHaveBeenCalledTimes(2);
    });

    await subscription.close();
  });

  it('subscribeAccountEvents logs one warning when ready repeatedly fails to subscribe, then recovers', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const onRecovered = vi.fn();
    const subscription = subscribeAccountEvents({ onEvent: vi.fn(), onRecovered });
    const connection = getConnectionByName('podverse-api-account-events-sub');
    connection.subscribe
      .mockRejectedValueOnce(new Error('no route to host'))
      .mockRejectedValueOnce(new Error('no route to host'))
      .mockResolvedValueOnce(1);

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(loggerService.warn).toHaveBeenCalledTimes(1);
    });
    expect(loggerService.warn).toHaveBeenCalledWith(
      'Failed to subscribe to account event channel',
      {
        connection: 'podverse-api-account-events-sub',
        error: 'no route to host',
      }
    );
    expect(onRecovered).not.toHaveBeenCalled();

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(loggerService.warn).toHaveBeenCalledTimes(1);
    });
    expect(onRecovered).not.toHaveBeenCalled();

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(onRecovered).toHaveBeenCalledTimes(1);
    });

    await subscription.close();
  });

  it('message handling emits events in order and warns once across malformed messages', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const onEvent = vi.fn();
    const subscription = subscribeAccountEvents({ onEvent, onRecovered: vi.fn() });
    const connection = getConnectionByName('podverse-api-account-events-sub');

    connection.emit(
      'message',
      'podverse:account-events',
      JSON.stringify({
        events: [
          {
            account_id: 7,
            type: 'notification.read_one',
            data: { notification_id: 41 },
          },
          {
            account_id: 7,
            type: 'notification.read_one',
            data: { notification_id: 42 },
          },
        ],
      })
    );

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      account_id: 7,
      data: { notification_id: 41 },
      type: 'notification.read_one',
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      account_id: 7,
      data: { notification_id: 42 },
      type: 'notification.read_one',
    });

    connection.emit('message', 'podverse:account-events', '{not json');
    connection.emit('message', 'podverse:account-events', '{still bad');
    expect(loggerService.warn).toHaveBeenCalledWith('Ignoring malformed account event message');
    const malformedCalls = loggerService.warn.mock.calls.filter(
      ([message]) => message === 'Ignoring malformed account event message'
    );
    expect(malformedCalls).toHaveLength(1);

    await subscription.close();
  });

  it('continues processing events when onEvent throws', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const onEvent = vi.fn((event: { data: { notification_id: number } }) => {
      if (event.data.notification_id === 41) {
        throw new Error('boom');
      }
    });
    const subscription = subscribeAccountEvents({ onEvent, onRecovered: vi.fn() });
    const connection = getConnectionByName('podverse-api-account-events-sub');

    connection.emit(
      'message',
      'podverse:account-events',
      JSON.stringify({
        events: [
          {
            account_id: 7,
            type: 'notification.read_one',
            data: { notification_id: 41 },
          },
          {
            account_id: 7,
            type: 'notification.read_one',
            data: { notification_id: 42 },
          },
        ],
      })
    );

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(loggerService.logError).toHaveBeenCalledTimes(1);
    expect(loggerService.logError).toHaveBeenCalledWith(
      'Account event handler failed while processing an event',
      expect.any(Error)
    );

    await subscription.close();
  });

  it('outage logging warns once per outage and logs one recovery', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const subscription = subscribeAccountEvents({ onEvent: vi.fn(), onRecovered: vi.fn() });
    const connection = getConnectionByName('podverse-api-account-events-sub');

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(connection.subscribe).toHaveBeenCalledTimes(1);
    });

    connection.emit('error', new Error('connection refused'));
    connection.emit('error', new Error('connection refused'));
    expect(loggerService.warn).toHaveBeenCalledTimes(1);
    expect(loggerService.warn).toHaveBeenCalledWith('Account event Redis connection lost', {
      connection: 'podverse-api-account-events-sub',
      error: 'connection refused',
    });

    connection.emit('ready');
    await vi.waitFor(() => {
      expect(loggerService.info).toHaveBeenCalledTimes(1);
    });
    expect(loggerService.info).toHaveBeenCalledWith('Account event Redis connection restored', {
      connection: 'podverse-api-account-events-sub',
    });

    await subscription.close();
  });

  it('closeAccountEventPublisher unregisters and closes once across two close calls', async () => {
    const { closeAccountEventPublisher, startAccountEventPublisher } = await loadRedisModule();
    startAccountEventPublisher();
    const connection = getConnectionByName('podverse-api-account-events-pub');

    await closeAccountEventPublisher();
    await closeAccountEventPublisher();

    expect(unregisterAccountEventPublisher).toHaveBeenCalledTimes(1);
    expect(connection.quit).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).not.toHaveBeenCalled();
  });

  it('subscription close is safe to call twice and closes once', async () => {
    const { subscribeAccountEvents } = await loadRedisModule();
    const subscription = subscribeAccountEvents({ onEvent: vi.fn(), onRecovered: vi.fn() });
    const connection = getConnectionByName('podverse-api-account-events-sub');

    await subscription.close();
    await subscription.close();

    expect(connection.quit).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).not.toHaveBeenCalled();
  });
});
