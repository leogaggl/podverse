import { describe, expect, it } from 'vitest';

import type { AccountNotificationStreamEvent, AuthSessionEndedNotice } from '@podverse/helpers';
import { ACCOUNT_SESSION_STREAM_EVENT } from '@podverse/helpers';

import type {
  NotificationStreamConnectionOptions,
  NotificationStreamStatus,
} from './notificationStreamConnection';
import type {
  BroadcastChannelLike,
  LockManagerLike,
  NotificationStreamEnvironment,
} from './notificationStreamCoordinator';
import { startNotificationStreamCoordinator } from './notificationStreamCoordinator';

const API_BASE_URL = 'http://localhost:4030/api/v2';

const NOTIFICATION = {
  id: 7,
  account_id: 1,
  title: 'New Episode',
  created_at: '2026-10-22T12:00:00.000Z',
  is_unread: true,
};
const CREATED_RAW = JSON.stringify({ notification: NOTIFICATION, unread_count: 1 });
const CREATED_PARSED = {
  type: 'notification.created',
  data: { notification: NOTIFICATION, unread_count: 1 },
};

/** Lets queued microtasks (lock grants, channel delivery) run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** One holder per name, FIFO waiters, released when the holder's promise settles or its signal aborts. */
function createInMemoryLocks(): LockManagerLike & { isHeld(name: string): boolean } {
  const holders = new Set<string>();
  const waiters = new Map<string, Array<() => void>>();

  const grantNext = (name: string) => {
    const next = waiters.get(name)?.shift();
    if (next !== undefined) {
      queueMicrotask(next);
    }
  };

  return {
    isHeld: (name) => holders.has(name),
    request(name, { signal }, callback) {
      return new Promise<unknown>((resolve, reject) => {
        const abortError = () => new DOMException('The request was aborted.', 'AbortError');
        const run = () => {
          signal.removeEventListener('abort', onAbort);
          holders.add(name);
          callback()
            .then(resolve, reject)
            .finally(() => {
              holders.delete(name);
              grantNext(name);
            });
        };
        const onAbort = () => {
          const queue = waiters.get(name) ?? [];
          const index = queue.indexOf(run);
          if (index >= 0) {
            queue.splice(index, 1);
          }
          reject(abortError());
        };

        if (signal.aborted) {
          reject(abortError());
          return;
        }
        if (!holders.has(name) && (waiters.get(name)?.length ?? 0) === 0) {
          holders.add(name);
          queueMicrotask(run);
          return;
        }
        signal.addEventListener('abort', onAbort);
        waiters.set(name, [...(waiters.get(name) ?? []), run]);
      });
    },
  };
}

type FakeChannel = BroadcastChannelLike & { name: string; closed: boolean };

/** Delivers each message to every other open channel of the same name, asynchronously. */
function createChannelHub() {
  const channels = new Set<FakeChannel>();

  const create = (name: string): BroadcastChannelLike => {
    const channel: FakeChannel = {
      name,
      closed: false,
      onmessage: null,
      postMessage(message) {
        if (channel.closed) {
          throw new Error('Posted to a closed channel');
        }
        const data: unknown = JSON.parse(JSON.stringify(message));
        for (const other of channels) {
          if (other !== channel && other.name === name) {
            queueMicrotask(() => {
              if (!other.closed) {
                other.onmessage?.(new MessageEvent('message', { data }));
              }
            });
          }
        }
      },
      close() {
        channel.closed = true;
        channels.delete(channel);
      },
    };
    channels.add(channel);
    return channel;
  };

  return { create, openCount: () => channels.size };
}

type FakeConnection = {
  options: NotificationStreamConnectionOptions;
  closed: boolean;
};

function createTestBrowser() {
  const locks = createInMemoryLocks();
  const hub = createChannelHub();
  const connections: FakeConnection[] = [];

  const environment: NotificationStreamEnvironment = {
    locks,
    createChannel: hub.create,
    openConnection: (options) => {
      const fake: FakeConnection = { options, closed: false };
      connections.push(fake);
      options.onStatus('connecting');
      return {
        getLastEventId: () => null,
        close: () => {
          if (!fake.closed) {
            fake.closed = true;
            options.onStatus('off');
          }
        },
      };
    },
  };

  const start = (accountId: number, overrides: Partial<NotificationStreamEnvironment> = {}) => {
    const events: AccountNotificationStreamEvent[] = [];
    const statuses: NotificationStreamStatus[] = [];
    const sessionEnded: AuthSessionEndedNotice[] = [];
    const coordinator = startNotificationStreamCoordinator({
      accountId,
      apiBaseUrl: API_BASE_URL,
      onEvent: (event) => events.push(event),
      onSessionEnded: (notice) => sessionEnded.push(notice),
      onStatus: (status) => statuses.push(status),
      environment: { ...environment, ...overrides },
    });
    return { coordinator, events, statuses, sessionEnded };
  };

  const connectionAt = (index: number): FakeConnection => {
    const connection = connections[index];
    if (connection === undefined) {
      throw new Error(`No connection at index ${index}`);
    }
    return connection;
  };

  const emitCreated = (connection: FakeConnection, lastEventId: number) => {
    connection.options.onRawEvent({
      eventName: 'notification.created',
      rawData: CREATED_RAW,
      lastEventId,
    });
  };

  const emitSessionEnded = (connection: FakeConnection, notice: AuthSessionEndedNotice | null) => {
    connection.options.onRawEvent({
      eventName: ACCOUNT_SESSION_STREAM_EVENT.ended,
      rawData: JSON.stringify({ notice }),
      lastEventId: null,
    });
  };

  const openConnections = () => connections.filter((connection) => !connection.closed);

  return {
    locks,
    hub,
    connections,
    start,
    connectionAt,
    emitCreated,
    emitSessionEnded,
    openConnections,
  };
}

describe('startNotificationStreamCoordinator', () => {
  it('opens one stream for two tabs and delivers each event, parsed, in both', async () => {
    const browser = createTestBrowser();
    const leader = browser.start(1);
    const follower = browser.start(1);
    await flush();

    expect(browser.connections).toHaveLength(1);

    browser.emitCreated(browser.connectionAt(0), 7);
    await flush();

    expect(leader.events).toEqual([CREATED_PARSED]);
    expect(follower.events).toEqual([CREATED_PARSED]);
  });

  it('hands the stream to the follower, resuming from the last relayed created id', async () => {
    const browser = createTestBrowser();
    const leader = browser.start(1);
    browser.start(1);
    await flush();

    browser.emitCreated(browser.connectionAt(0), 7);
    await flush();
    leader.coordinator.stop();
    await flush();

    expect(browser.connections).toHaveLength(2);
    expect(browser.connectionAt(0).closed).toBe(true);
    expect(browser.connectionAt(1).options.initialLastEventId).toBe(7);
    expect(browser.openConnections()).toHaveLength(1);
  });

  it('ignores events and statuses relayed for another account', async () => {
    const browser = createTestBrowser();
    browser.start(2);
    const otherAccountFollower = browser.start(2);
    browser.start(1);
    await flush();

    expect(browser.connections).toHaveLength(2);
    const accountOneConnection = browser.connectionAt(1);
    accountOneConnection.options.onStatus('open');
    browser.emitCreated(accountOneConnection, 7);
    await flush();

    expect(otherAccountFollower.events).toEqual([]);
    expect(otherAccountFollower.statuses).not.toContain('open');
  });

  it('gives a late follower the current status through the snapshot', async () => {
    const browser = createTestBrowser();
    browser.start(1);
    await flush();
    browser.connectionAt(0).options.onStatus('open');
    await flush();

    const lateFollower = browser.start(1);
    await flush();

    expect(browser.connections).toHaveLength(1);
    expect(lateFollower.statuses[lateFollower.statuses.length - 1]).toBe('open');
  });

  it('opens a stream in every tab when Web Locks are unavailable', async () => {
    const browser = createTestBrowser();
    const first = browser.start(1, { locks: null });
    browser.start(1, { locks: null });
    await flush();

    expect(browser.openConnections()).toHaveLength(2);

    browser.emitCreated(browser.connectionAt(0), 7);
    expect(first.events).toEqual([CREATED_PARSED]);
  });

  it('tells every tab of the account when this browser session was ended elsewhere', async () => {
    const browser = createTestBrowser();
    const leader = browser.start(1);
    const follower = browser.start(1);
    await flush();

    browser.emitSessionEnded(browser.connectionAt(0), 'admin_force_logout');
    await flush();

    expect(leader.sessionEnded).toEqual(['admin_force_logout']);
    expect(follower.sessionEnded).toEqual(['admin_force_logout']);
    expect(leader.events).toEqual([]);
    expect(follower.events).toEqual([]);
    expect(browser.connections).toHaveLength(1);
    expect(browser.locks.isHeld('podverse:notification-stream:1')).toBe(true);
  });

  it('does not sign out when the ended event has a null notice', async () => {
    const browser = createTestBrowser();
    const leader = browser.start(1);
    const follower = browser.start(1);
    await flush();

    browser.emitSessionEnded(browser.connectionAt(0), null);
    await flush();

    expect(leader.sessionEnded).toEqual([]);
    expect(follower.sessionEnded).toEqual([]);
  });

  it('does not tell another account that this browser session ended', async () => {
    const browser = createTestBrowser();
    const otherAccount = browser.start(2);
    const thisAccount = browser.start(1);
    await flush();

    browser.emitSessionEnded(browser.connectionAt(1), 'admin_force_logout');
    await flush();

    expect(thisAccount.sessionEnded).toEqual(['admin_force_logout']);
    expect(otherAccount.sessionEnded).toEqual([]);
  });

  it('stops cleanly when called twice and leaves no stream, lock, or channel', async () => {
    const browser = createTestBrowser();
    const tab = browser.start(1);
    await flush();

    tab.coordinator.stop();
    tab.coordinator.stop();
    await flush();

    expect(tab.statuses.filter((status) => status === 'off')).toHaveLength(1);
    expect(tab.statuses[tab.statuses.length - 1]).toBe('off');
    expect(browser.openConnections()).toHaveLength(0);
    expect(browser.hub.openCount()).toBe(0);
    expect(browser.locks.isHeld('podverse:notification-stream:1')).toBe(false);
  });
});
