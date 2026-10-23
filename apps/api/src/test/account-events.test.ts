import type { IncomingHttpHeaders, Server } from 'node:http';
import http from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildEpisodePath } from '@podverse/helpers';
import type { AccountEvent, ORMContext } from '@podverse/orm';

import {
  authHeaders,
  getBaseApiUrl,
  startTestApp,
  stopTestApp,
  TEST_USER_ACCOUNT_ID_TEXT,
} from './helpers/index.js';

const TEST_USER_ID = 1;
const TEST_EMAIL = 'account-events-test@example.com';

type NotificationRow = {
  id: number;
  account_id: number;
  category: string;
  title: string;
  body: string | null;
  link_path: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
  expires_at: Date;
};

const {
  accountGetMock,
  captured,
  categorySetCategoryCacheMock,
  countUnreadMock,
  getManyByIdsForAccountMock,
  getMaxIdForAccountMock,
  listForAccountAfterIdMock,
} = vi.hoisted(() => {
  const captured: {
    handlers?: { onEvent: (event: AccountEvent) => void; onRecovered: () => void };
  } = {};
  return {
    accountGetMock: vi.fn(async () => ({
      id: TEST_USER_ID,
      id_text: TEST_USER_ACCOUNT_ID_TEXT,
      account_credentials: { email: TEST_EMAIL },
      notifications_last_read_at: null,
    })),
    captured,
    categorySetCategoryCacheMock: vi.fn(async () => {}),
    countUnreadMock: vi.fn(async (_account_id: number, _cutoff: Date | null) => 4),
    getManyByIdsForAccountMock: vi.fn(
      async (_account_id: number, _ids: number[]): Promise<NotificationRow[]> => []
    ),
    getMaxIdForAccountMock: vi.fn(async (_account_id: number): Promise<number | null> => 100),
    listForAccountAfterIdMock: vi.fn(
      async (
        _account_id: number,
        _after_id: number,
        _limit: number
      ): Promise<NotificationRow[]> => []
    ),
  };
});

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    setCategoryCache = categorySetCategoryCacheMock;
  }

  class MockAccountService {
    get = accountGetMock;
  }

  class MockAccountNotificationService {
    countUnread = countUnreadMock;
    getManyByIdsForAccount = getManyByIdsForAccountMock;
    getMaxIdForAccount = getMaxIdForAccountMock;
    listForAccountAfterId = listForAccountAfterIdMock;
  }

  return {
    ...actual,
    AccountNotificationService: MockAccountNotificationService,
    AccountService: MockAccountService,
    CategoryService: MockCategoryService,
  };
});

vi.mock('@api/lib/accountEvents/accountEventRedis.js', () => ({
  closeAccountEventPublisher: async () => undefined,
  startAccountEventPublisher: () => undefined,
  subscribeAccountEvents: (handlers: {
    onEvent: (event: AccountEvent) => void;
    onRecovered: () => void;
  }) => {
    captured.handlers = handlers;
    return { close: async () => undefined };
  },
}));

type StreamEvent = { id?: string; event: string; data: unknown };

type OpenedStream = {
  status: number;
  headers: IncomingHttpHeaders;
  events: StreamEvent[];
  /** Resolves with the next event of that name not already returned. */
  nextEvent: (name: string) => Promise<StreamEvent>;
  close: () => void;
};

/** Comments and the retry line carry no `event:` and are skipped. */
const parseBlock = (block: string): StreamEvent | null => {
  let id: string | undefined;
  let event: string | undefined;
  let data: unknown;
  for (const line of block.split('\n')) {
    if (line.startsWith('id: ')) {
      id = line.slice('id: '.length);
    } else if (line.startsWith('event: ')) {
      event = line.slice('event: '.length);
    } else if (line.startsWith('data: ')) {
      data = JSON.parse(line.slice('data: '.length));
    }
  }
  if (event === undefined) {
    return null;
  }
  return id === undefined ? { event, data } : { id, event, data };
};

const row = (id: number): NotificationRow => ({
  id,
  account_id: TEST_USER_ID,
  category: 'new-item',
  title: `Episode ${id}`,
  body: 'A new episode is available.',
  link_path: buildEpisodePath('abc123def'),
  payload: null,
  created_at: new Date('2026-10-20T00:00:00.000Z'),
  expires_at: new Date('2026-11-20T00:00:00.000Z'),
});

describe('account event stream route', () => {
  let app: import('express').Express;
  let ormContext: ORMContext | undefined;
  let server: Server | undefined;
  let eventsPath = '';
  let port = 0;

  /**
   * Supertest buffers the whole response, which never ends for a stream, so this reads chunks from
   * a raw request instead.
   */
  const openStream = (headers: Record<string, string>): Promise<OpenedStream> =>
    new Promise((resolve, reject) => {
      const req = http.get(
        { host: '127.0.0.1', port, path: eventsPath, headers, agent: false },
        (res) => {
          res.setEncoding('utf8');
          res.on('error', () => undefined);
          const events: StreamEvent[] = [];
          const consumed = new Set<number>();
          const waiters: Array<{ name: string; resolve: (event: StreamEvent) => void }> = [];
          let buffer = '';

          const resolveWaiters = (): void => {
            for (const waiter of [...waiters]) {
              const index = events.findIndex(
                (entry, entryIndex) => !consumed.has(entryIndex) && entry.event === waiter.name
              );
              const match = events[index];
              if (match !== undefined) {
                consumed.add(index);
                waiters.splice(waiters.indexOf(waiter), 1);
                waiter.resolve(match);
              }
            }
          };

          res.on('data', (chunk: string) => {
            buffer += chunk;
            let separator = buffer.indexOf('\n\n');
            while (separator !== -1) {
              const parsed = parseBlock(buffer.slice(0, separator));
              buffer = buffer.slice(separator + 2);
              if (parsed !== null) {
                events.push(parsed);
              }
              separator = buffer.indexOf('\n\n');
            }
            resolveWaiters();
          });

          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            events,
            nextEvent: (name) =>
              new Promise<StreamEvent>((resolveEvent) => {
                waiters.push({ name, resolve: resolveEvent });
                resolveWaiters();
              }),
            close: () => {
              req.destroy();
            },
          });
        }
      );
      req.on('error', reject);
    });

  const emit = (event: AccountEvent): void => {
    if (captured.handlers === undefined) {
      throw new Error('subscribeAccountEvents was not called during app startup');
    }
    captured.handlers.onEvent(event);
  };

  beforeAll(async () => {
    const result = await startTestApp();
    app = result.app;
    server = result.server;
    ormContext = result.ormContext;
    eventsPath = `${await getBaseApiUrl()}/account/events`;
    const address = server?.address();
    if (address === null || address === undefined || typeof address === 'string') {
      throw new Error('Test server is not listening on a TCP port');
    }
    port = address.port;
  }, 30000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  beforeEach(() => {
    countUnreadMock.mockClear();
    getManyByIdsForAccountMock.mockClear();
    listForAccountAfterIdMock.mockClear();
  });

  it('returns 401 JSON without auth', async () => {
    const response = await request(app).get(eventsPath);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('opens a text/event-stream whose first event is notification.state with the unread count', async () => {
    const stream = await openStream(authHeaders(TEST_USER_ID));
    try {
      expect(stream.status).toBe(200);
      expect(String(stream.headers['content-type'])).toMatch(/^text\/event-stream/);

      await stream.nextEvent('notification.state');
      expect(stream.events[0]).toEqual({
        event: 'notification.state',
        data: { unread_count: 4, last_read_at: null },
      });
    } finally {
      stream.close();
    }
  });

  it('sends notification.created with the notification id as the SSE id when a created event arrives', async () => {
    const stream = await openStream(authHeaders(TEST_USER_ID));
    try {
      await stream.nextEvent('notification.state');
      getManyByIdsForAccountMock.mockResolvedValueOnce([row(301)]);

      emit({
        account_id: TEST_USER_ID,
        type: 'notification.created',
        data: { notification_ids: [301] },
      });

      const created = await stream.nextEvent('notification.created');
      expect(getManyByIdsForAccountMock).toHaveBeenCalledWith(TEST_USER_ID, [301]);
      expect(created).toEqual({
        id: '301',
        event: 'notification.created',
        data: {
          notification: {
            id: 301,
            account_id: TEST_USER_ID,
            body: 'A new episode is available.',
            category: 'new-item',
            created_at: '2026-10-20T00:00:00.000Z',
            expires_at: '2026-11-20T00:00:00.000Z',
            is_unread: true,
            link_path: buildEpisodePath('abc123def'),
            payload: null,
            title: 'Episode 301',
          },
          unread_count: 4,
        },
      });
    } finally {
      stream.close();
    }
  });

  it('replays the rows after Last-Event-ID in id order', async () => {
    listForAccountAfterIdMock.mockResolvedValueOnce([row(101), row(102), row(103)]);

    const stream = await openStream({ ...authHeaders(TEST_USER_ID), 'Last-Event-ID': '100' });
    try {
      const replayed = [
        await stream.nextEvent('notification.created'),
        await stream.nextEvent('notification.created'),
        await stream.nextEvent('notification.created'),
      ];

      expect(listForAccountAfterIdMock).toHaveBeenCalledWith(TEST_USER_ID, 100, 51);
      expect(replayed.map((entry) => entry.id)).toEqual(['101', '102', '103']);
      expect(stream.events[0]?.event).toBe('notification.state');
    } finally {
      stream.close();
    }
  });

  it('sends notification.resync instead of rows when the replay is over the limit', async () => {
    listForAccountAfterIdMock.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, index) => row(101 + index))
    );

    const stream = await openStream({ ...authHeaders(TEST_USER_ID), 'Last-Event-ID': '100' });
    try {
      const resync = await stream.nextEvent('notification.resync');

      expect(resync).toEqual({ event: 'notification.resync', data: { reason: 'replay_limit' } });
      expect(stream.events.some((entry) => entry.event === 'notification.created')).toBe(false);
    } finally {
      stream.close();
    }
  });

  it('sends notification.read with scope all when a read_all event arrives', async () => {
    const stream = await openStream(authHeaders(TEST_USER_ID));
    try {
      await stream.nextEvent('notification.state');

      emit({
        account_id: TEST_USER_ID,
        type: 'notification.read_all',
        data: { last_read_at: '2026-10-21T00:00:00.000Z' },
      });

      const read = await stream.nextEvent('notification.read');
      expect(read).toEqual({
        event: 'notification.read',
        data: { scope: 'all', last_read_at: '2026-10-21T00:00:00.000Z', unread_count: 4 },
      });
      expect(countUnreadMock).toHaveBeenLastCalledWith(
        TEST_USER_ID,
        new Date('2026-10-21T00:00:00.000Z')
      );
    } finally {
      stream.close();
    }
  });
});
