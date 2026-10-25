import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountEvent } from '@podverse/orm';

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
  countUnreadMock,
  getManyByIdsForAccountMock,
  getMaxIdForAccountMock,
  listForAccountAfterIdMock,
  loggerService,
  subscriptionCloseMock,
} = vi.hoisted(() => {
  const captured: {
    handlers?: { onEvent: (event: AccountEvent) => void; onRecovered: () => void };
  } = {};
  return {
    accountGetMock: vi.fn(
      async (
        account_id: number
      ): Promise<{ id: number; notifications_last_read_at: Date | null }> => ({
        id: account_id,
        notifications_last_read_at: null,
      })
    ),
    captured,
    countUnreadMock: vi.fn(async (_account_id: number, _cutoff: Date | null) => 3),
    getManyByIdsForAccountMock: vi.fn(
      async (_account_id: number, _ids: number[]): Promise<NotificationRow[]> => []
    ),
    getMaxIdForAccountMock: vi.fn(async (_account_id: number): Promise<number | null> => 10),
    listForAccountAfterIdMock: vi.fn(
      async (
        _account_id: number,
        _after_id: number,
        _limit: number
      ): Promise<NotificationRow[]> => []
    ),
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      logError: vi.fn(),
      warn: vi.fn(),
    },
    subscriptionCloseMock: vi.fn(async () => undefined),
  };
});

vi.mock('@api/factories/loggerService.js', () => ({ loggerService }));

vi.mock('@api/lib/accountEvents/accountEventRedis.js', () => ({
  subscribeAccountEvents: vi.fn(
    (handlers: { onEvent: (event: AccountEvent) => void; onRecovered: () => void }) => {
      captured.handlers = handlers;
      return { close: subscriptionCloseMock };
    }
  ),
}));

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockAccountNotificationService {
    countUnread = countUnreadMock;
    getManyByIdsForAccount = getManyByIdsForAccountMock;
    getMaxIdForAccount = getMaxIdForAccountMock;
    listForAccountAfterId = listForAccountAfterIdMock;
  }

  class MockAccountService {
    get = accountGetMock;
  }

  return {
    ...actual,
    AccountNotificationService: MockAccountNotificationService,
    AccountService: MockAccountService,
  };
});

type FakeResponse = {
  chunks: string[];
  endCalls: number;
  writable: boolean;
  writableEnded: boolean;
  write: (chunk: string) => boolean;
  end: () => void;
};

type WrittenEvent = { id?: string; event: string; data: unknown };

const DEFAULT_SESSION_ID_TEXT = 'sessdefault1';

const createResponse = (): FakeResponse => {
  const response: FakeResponse = {
    chunks: [],
    endCalls: 0,
    writable: true,
    writableEnded: false,
    write: (chunk) => {
      response.chunks.push(chunk);
      return true;
    },
    end: () => {
      response.endCalls += 1;
      response.writable = false;
      response.writableEnded = true;
    },
  };
  return response;
};

const eventsOf = (response: FakeResponse): WrittenEvent[] =>
  response.chunks.flatMap((chunk): WrittenEvent[] => {
    let id: string | undefined;
    let event: string | undefined;
    let data: unknown;
    for (const line of chunk.split('\n')) {
      if (line.startsWith('id: ')) {
        id = line.slice('id: '.length);
      } else if (line.startsWith('event: ')) {
        event = line.slice('event: '.length);
      } else if (line.startsWith('data: ')) {
        data = JSON.parse(line.slice('data: '.length));
      }
    }
    if (event === undefined) {
      return [];
    }
    return id === undefined ? [{ event, data }] : [{ id, event, data }];
  });

const createdIdsOf = (response: FakeResponse): Array<string | undefined> =>
  eventsOf(response)
    .filter((entry) => entry.event === 'notification.created')
    .map((entry) => entry.id);

const pingCountOf = (response: FakeResponse): number =>
  response.chunks.filter((chunk) => chunk === ': ping\n\n').length;

const row = (id: number, account_id = 1): NotificationRow => ({
  id,
  account_id,
  category: 'new-item',
  title: `Notification ${id}`,
  body: null,
  link_path: null,
  payload: null,
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  expires_at: new Date('2026-11-01T00:00:00.000Z'),
});

/** Every mocked query resolves as a microtask, so one macrotask turn drains the account queues. */
const flush = (): Promise<void> =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

const loadHub = async () => import('./accountEventStreamHub.js');
type Hub = Awaited<ReturnType<typeof loadHub>>;

const openStream = async (
  hub: Hub,
  account_id: number,
  options: {
    lastEventId?: number | null;
    tokenExpiresAt?: number;
    sessionIdText?: string | null;
  } = {}
): Promise<FakeResponse> => {
  const response = createResponse();
  hub.openAccountEventStream({
    account_id,
    sessionIdText:
      options.sessionIdText === undefined ? DEFAULT_SESSION_ID_TEXT : options.sessionIdText,
    response,
    cutoff: null,
    lastEventId: options.lastEventId ?? null,
    tokenExpiresAt: options.tokenExpiresAt,
  });
  await flush();
  return response;
};

const emit = (event: AccountEvent): void => {
  if (captured.handlers === undefined) {
    throw new Error('subscribeAccountEvents was not called');
  }
  captured.handlers.onEvent(event);
};

describe('account event stream hub', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    captured.handlers = undefined;
    vi.useFakeTimers({
      now: new Date('2026-10-22T12:00:00.000Z'),
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    countUnreadMock.mockImplementation(async () => 3);
    getMaxIdForAccountMock.mockImplementation(async () => 10);
    listForAccountAfterIdMock.mockImplementation(async () => []);
    getManyByIdsForAccountMock.mockImplementation(async (account_id, ids) =>
      ids.map((id) => row(id, account_id))
    );
    accountGetMock.mockImplementation(async (account_id) => ({
      id: account_id,
      notifications_last_read_at: null,
    }));
  });

  afterEach(async () => {
    const hub = await loadHub();
    await hub.closeAccountEventStreamHub();
    vi.useRealTimers();
  });

  it('sends a notification.created event to both streams of that account and to no stream of another account', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const first = await openStream(hub, 1);
    const second = await openStream(hub, 1);
    const otherAccount = await openStream(hub, 2);

    expect(first.chunks[0]).toBe('retry: 5000\n\n');
    expect(eventsOf(first)[0]).toEqual({
      event: 'notification.state',
      data: { unread_count: 3, last_read_at: null },
    });

    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [11] } });
    await flush();

    for (const response of [first, second]) {
      expect(eventsOf(response).filter((entry) => entry.event === 'notification.created')).toEqual([
        {
          id: '11',
          event: 'notification.created',
          data: {
            notification: expect.objectContaining({ id: 11, account_id: 1, is_unread: true }),
            unread_count: 3,
          },
        },
      ]);
    }
    expect(createdIdsOf(otherAccount)).toEqual([]);
    expect(getManyByIdsForAccountMock).toHaveBeenCalledTimes(1);
    expect(getManyByIdsForAccountMock).toHaveBeenCalledWith(1, [11]);
  });

  it('does not send the same notification id twice when a second event repeats it', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const response = await openStream(hub, 1);

    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [11] } });
    await flush();
    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [11, 12] } });
    await flush();

    expect(createdIdsOf(response)).toEqual(['11', '12']);
  });

  it('delivers two events for one account in order even when the first query resolves last', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const response = await openStream(hub, 1);

    let releaseFirst: (rows: NotificationRow[]) => void = () => undefined;
    getManyByIdsForAccountMock.mockImplementationOnce(
      () =>
        new Promise<NotificationRow[]>((resolve) => {
          releaseFirst = resolve;
        })
    );

    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [11] } });
    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [12] } });
    await flush();
    expect(createdIdsOf(response)).toEqual([]);

    releaseFirst([row(11)]);
    await flush();

    expect(createdIdsOf(response)).toEqual(['11', '12']);
  });

  it('writes nothing and runs no query for a playback.progress event', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const response = await openStream(hub, 1);
    const chunkCount = response.chunks.length;
    vi.clearAllMocks();

    emit({ account_id: 1, type: 'playback.progress', data: { position_seconds: 120 } });
    emit({ account_id: 1, type: 'playback.progress', data: { position_seconds: 121 } });
    await flush();

    expect(response.chunks).toHaveLength(chunkCount);
    expect(countUnreadMock).not.toHaveBeenCalled();
    expect(getManyByIdsForAccountMock).not.toHaveBeenCalled();
    expect(loggerService.debug).toHaveBeenCalledTimes(1);
    expect(loggerService.debug).toHaveBeenCalledWith(expect.any(String), {
      type: 'playback.progress',
    });
  });

  it('refuses the eleventh stream for one account', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    for (let index = 0; index < 10; index += 1) {
      await openStream(hub, 1);
    }

    expect(hub.getAccountEventStreamAdmission(1)).toBe('limit');
    expect(hub.getAccountEventStreamAdmission(2)).toBe('open');
  });

  it('writes a heartbeat every 25 seconds and ends the stream at token expiry or at 30 minutes, whichever is first', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const shortToken = await openStream(hub, 1, { tokenExpiresAt: nowSeconds + 60 });
    const longToken = await openStream(hub, 2, { tokenExpiresAt: nowSeconds + 24 * 60 * 60 });

    vi.advanceTimersByTime(25_000);
    expect(pingCountOf(shortToken)).toBe(1);
    vi.advanceTimersByTime(25_000);
    expect(pingCountOf(shortToken)).toBe(2);
    expect(shortToken.writableEnded).toBe(false);

    vi.advanceTimersByTime(10_000);
    expect(shortToken.writableEnded).toBe(true);
    expect(longToken.writableEnded).toBe(false);

    vi.advanceTimersByTime(30 * 60_000 - 60_000 - 1);
    expect(longToken.writableEnded).toBe(false);
    vi.advanceTimersByTime(1);
    expect(longToken.writableEnded).toBe(true);
    expect(pingCountOf(shortToken)).toBe(2);
  });

  it('replays rows after the high-water mark and sends a fresh state event on recovery', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const response = await openStream(hub, 1);
    const eventCountBeforeRecovery = eventsOf(response).length;

    const lastReadAt = new Date('2026-10-02T00:00:00.000Z');
    accountGetMock.mockResolvedValueOnce({ id: 1, notifications_last_read_at: lastReadAt });
    countUnreadMock.mockImplementation(async () => 2);
    listForAccountAfterIdMock.mockResolvedValueOnce([row(11), row(12)]);

    captured.handlers?.onRecovered();
    await flush();

    expect(listForAccountAfterIdMock).toHaveBeenCalledWith(1, 10, 51);
    expect(countUnreadMock).toHaveBeenLastCalledWith(1, lastReadAt);
    expect(eventsOf(response).slice(eventCountBeforeRecovery)).toEqual([
      expect.objectContaining({ id: '11', event: 'notification.created' }),
      expect.objectContaining({ id: '12', event: 'notification.created' }),
      {
        event: 'notification.state',
        data: { unread_count: 2, last_read_at: lastReadAt.toISOString() },
      },
    ]);
  });

  it('closeAccountEventStreamHub ends every stream and closes the subscription once', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const first = await openStream(hub, 1);
    const second = await openStream(hub, 2);

    await hub.closeAccountEventStreamHub();
    await hub.closeAccountEventStreamHub();

    expect(first.writableEnded).toBe(true);
    expect(second.writableEnded).toBe(true);
    expect(subscriptionCloseMock).toHaveBeenCalledTimes(1);
    expect(hub.getAccountEventStreamAdmission(1)).toBe('closed');

    vi.advanceTimersByTime(60_000);
    expect(pingCountOf(first)).toBe(0);
  });

  it('ends only the stream of the ended session with the mapped notice and runs no query', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const sessionA = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });
    const sessionB = await openStream(hub, 1, { sessionIdText: 'sessbbbbb2' });
    const chunkCountOfB = sessionB.chunks.length;
    vi.clearAllMocks();

    emit({
      account_id: 1,
      type: 'session.ended',
      data: { session_id_texts: ['sessaaaaa1'], reason: 'admin_force_logout' },
    });

    expect(eventsOf(sessionA).at(-1)).toEqual({
      event: 'session.ended',
      data: { notice: 'admin_force_logout' },
    });
    expect(sessionA.writableEnded).toBe(true);
    expect(sessionB.writableEnded).toBe(false);
    expect(sessionB.chunks).toHaveLength(chunkCountOfB);
    await flush();
    expect(accountGetMock).not.toHaveBeenCalled();
    expect(countUnreadMock).not.toHaveBeenCalled();
    expect(getManyByIdsForAccountMock).not.toHaveBeenCalled();
    expect(getMaxIdForAccountMock).not.toHaveBeenCalled();
    expect(listForAccountAfterIdMock).not.toHaveBeenCalled();
  });

  it('sends a null notice when the device signed itself out', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const response = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });

    emit({
      account_id: 1,
      type: 'session.ended',
      data: { session_id_texts: ['sessaaaaa1'], reason: 'signed_out' },
    });

    expect(eventsOf(response).at(-1)).toEqual({ event: 'session.ended', data: { notice: null } });
    expect(response.writableEnded).toBe(true);
  });

  it('leaves another account that uses the same session id text open', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const ownStream = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });
    const otherAccount = await openStream(hub, 2, { sessionIdText: 'sessaaaaa1' });

    emit({
      account_id: 1,
      type: 'session.ended',
      data: { session_id_texts: ['sessaaaaa1'], reason: 'password_changed' },
    });

    expect(ownStream.writableEnded).toBe(true);
    expect(otherAccount.writableEnded).toBe(false);
    expect(eventsOf(otherAccount).some((entry) => entry.event === 'session.ended')).toBe(false);
  });

  it('writes nothing to a stream that ended while a notification query was in flight and still reaches the other stream', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const sessionA = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });
    const sessionB = await openStream(hub, 1, { sessionIdText: 'sessbbbbb2' });

    let releaseRows: (rows: NotificationRow[]) => void = () => undefined;
    getManyByIdsForAccountMock.mockImplementationOnce(
      () =>
        new Promise<NotificationRow[]>((resolve) => {
          releaseRows = resolve;
        })
    );
    emit({ account_id: 1, type: 'notification.created', data: { notification_ids: [11] } });
    await flush();

    emit({
      account_id: 1,
      type: 'session.ended',
      data: { session_id_texts: ['sessaaaaa1'], reason: 'signed_out_elsewhere' },
    });
    const chunkCountOfA = sessionA.chunks.length;
    releaseRows([row(11)]);
    await flush();

    expect(sessionA.chunks).toHaveLength(chunkCountOfA);
    expect(createdIdsOf(sessionA)).toEqual([]);
    expect(createdIdsOf(sessionB)).toEqual(['11']);
  });

  it('closes a stream that registers for a session ended 30 seconds earlier, and not one 61 seconds later', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    emit({
      account_id: 1,
      type: 'session.ended',
      data: {
        session_id_texts: ['sessaaaaa1', 'sessbbbbb2'],
        reason: 'signed_out_elsewhere',
      },
    });

    vi.advanceTimersByTime(30_000);
    vi.clearAllMocks();
    const early = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });

    expect(early.chunks[0]).toBe('retry: 5000\n\n');
    expect(eventsOf(early)).toEqual([
      { event: 'session.ended', data: { notice: 'signed_out_elsewhere' } },
    ]);
    expect(early.writableEnded).toBe(true);
    expect(countUnreadMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(31_000);
    const late = await openStream(hub, 1, { sessionIdText: 'sessbbbbb2' });

    expect(late.writableEnded).toBe(false);
    expect(eventsOf(late)).toEqual([
      { event: 'notification.state', data: { unread_count: 3, last_read_at: null } },
    ]);
  });

  it('calls res.end() once on every end path and leaves no timer', async () => {
    const hub = await loadHub();
    hub.startAccountEventStreamHub();
    const nowSeconds = Math.floor(Date.now() / 1000);

    const sessionEnd = await openStream(hub, 1, { sessionIdText: 'sessaaaaa1' });
    const clientClose = createResponse();
    const clientCloseStream = hub.openAccountEventStream({
      account_id: 2,
      sessionIdText: 'sessbbbbb2',
      response: clientClose,
      cutoff: null,
      lastEventId: null,
    });
    await flush();
    const writeThrows = await openStream(hub, 3);
    const backpressure = await openStream(hub, 4);
    const tokenExpiry = await openStream(hub, 5, { tokenExpiresAt: nowSeconds + 60 });
    const lifetimeCap = await openStream(hub, 6);

    emit({
      account_id: 1,
      type: 'session.ended',
      data: { session_id_texts: ['sessaaaaa1'], reason: 'signed_out' },
    });
    hub.closeAccountEventStream(clientCloseStream);
    hub.closeAccountEventStream(clientCloseStream);

    writeThrows.write = () => {
      throw new Error('socket gone');
    };
    backpressure.write = () => false;
    vi.advanceTimersByTime(25_000);
    vi.advanceTimersByTime(35_000);
    vi.advanceTimersByTime(25 * 60_000 - 60_000);

    const hubShutdown = await openStream(hub, 7);
    vi.advanceTimersByTime(5 * 60_000);
    expect(lifetimeCap.writableEnded).toBe(true);
    expect(hubShutdown.writableEnded).toBe(false);
    await hub.closeAccountEventStreamHub();

    for (const response of [
      sessionEnd,
      clientClose,
      writeThrows,
      backpressure,
      tokenExpiry,
      lifetimeCap,
      hubShutdown,
    ]) {
      expect(response.endCalls).toBe(1);
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
