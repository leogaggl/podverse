import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountNotificationStreamEvent, DTOAccountNotification } from '@podverse/helpers';
import { ACCOUNT_NOTIFICATION_STREAM_EVENT, NotificationCategoryEnum } from '@podverse/helpers';
import type { AccountPlaybackStreamEvent } from '@podverse/helpers/accountPlaybackStream';
import { ACCOUNT_PLAYBACK_STREAM_EVENT } from '@podverse/helpers/accountPlaybackStream';

import type { NotificationStreamConnectParams } from './notificationStreamController';
import { createNotificationStreamController } from './notificationStreamController';
import { NotificationStreamHttpError } from './notificationStreamPolicy';
import type { NotificationStreamAppEvent } from './notificationStreamStore';
import {
  getNotificationStreamConnection,
  getNotificationUnreadCount,
  resetNotificationStreamStore,
  subscribeNotificationStreamEvents,
  subscribeNotificationStreamPlaybackEvents,
} from './notificationStreamStore';

const sampleNotification = (id: number): DTOAccountNotification => ({
  account_id: 7,
  body: null,
  category: NotificationCategoryEnum.NewContent,
  created_at: '2026-01-01T00:00:00.000Z',
  expires_at: '2026-02-01T00:00:00.000Z',
  id,
  is_unread: true,
  link_path: '/notifications',
  payload: null,
  title: `Notification ${id}`,
});

const stateEvent = (unreadCount: number): AccountNotificationStreamEvent => ({
  type: ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
  data: { unread_count: unreadCount, last_read_at: null },
});

const createdEvent = (id: number, unreadCount: number): AccountNotificationStreamEvent => ({
  type: ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
  data: { notification: sampleNotification(id), unread_count: unreadCount },
});

const playbackDevicesEvent = (revision: number): AccountPlaybackStreamEvent => ({
  type: ACCOUNT_PLAYBACK_STREAM_EVENT.devices,
  data: { revision, devices: [] },
});

type FakeConnection = {
  params: NotificationStreamConnectParams;
  end: () => void;
  fail: (error: Error) => void;
  /** Delivers an event the way the client does: activity first, then the parsed event. */
  deliver: (event: AccountNotificationStreamEvent) => void;
  deliverPlayback: (event: AccountPlaybackStreamEvent) => void;
};

/** Lets the timer queue and every pending promise callback run. */
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const createHarness = () => {
  let nowMs = 1_000_000;
  let failEveryConnect: Error | null = null;
  const connections: FakeConnection[] = [];

  const connect = vi.fn(
    (params: NotificationStreamConnectParams) =>
      new Promise<void>((resolve, reject) => {
        connections.push({
          params,
          end: () => {
            resolve();
          },
          fail: (error) => {
            reject(error);
          },
          deliver: (event) => {
            params.onActivity();
            params.onEvent(event);
          },
          deliverPlayback: (event) => {
            params.onActivity();
            params.onPlaybackEvent(event);
          },
        });
        if (failEveryConnect !== null) {
          reject(failEveryConnect);
        }
      })
  );
  const fetchUnreadCount = vi.fn(() => Promise.resolve(7));
  const controller = createNotificationStreamController({
    connect,
    fetchUnreadCount,
    now: () => nowMs,
    random: () => 0.5,
  });

  return {
    connect,
    controller,
    fetchUnreadCount,
    latest: (): FakeConnection => {
      const connection = connections.at(-1);
      if (connection === undefined) {
        throw new Error('connect was not called');
      }
      return connection;
    },
    /** Moves the wall clock and fires every timer due in that span. */
    advance: async (ms: number): Promise<void> => {
      nowMs += ms;
      await vi.advanceTimersByTimeAsync(ms);
      await flush();
    },
    /** Moves only the wall clock, as when Android holds JS timers in the background. */
    moveWallClock: (ms: number): void => {
      nowMs += ms;
    },
    failEveryConnectWith: (error: Error | null): void => {
      failEveryConnect = error;
    },
  };
};

type Harness = ReturnType<typeof createHarness>;

describe('createNotificationStreamController', () => {
  let harness: Harness;
  let appEvents: NotificationStreamAppEvent[];
  let unsubscribeAppEvents: () => void;

  const createdIds = (): number[] =>
    appEvents.flatMap((event) => (event.type === 'created' ? [event.notification.id] : []));
  const resyncCount = (): number => appEvents.filter((event) => event.type === 'resync').length;

  beforeEach(() => {
    vi.useFakeTimers();
    resetNotificationStreamStore();
    appEvents = [];
    unsubscribeAppEvents = subscribeNotificationStreamEvents((event) => {
      appEvents.push(event);
    });
    harness = createHarness();
  });

  afterEach(() => {
    harness.controller.stop();
    unsubscribeAppEvents();
    vi.useRealTimers();
  });

  it('start connects with no Last-Event-ID, and a second start does nothing', () => {
    harness.controller.start();
    harness.controller.start();

    expect(harness.connect).toHaveBeenCalledTimes(1);
    expect(harness.latest().params.lastEventId).toBeNull();
    expect(getNotificationStreamConnection()).toBe('connecting');
  });

  it('a state event opens the stream, sets the count, and publishes one resync', () => {
    harness.controller.start();
    const connection = harness.latest();

    connection.deliver(stateEvent(3));

    expect(getNotificationStreamConnection()).toBe('open');
    expect(getNotificationUnreadCount()).toBe(3);
    expect(appEvents).toEqual([{ type: 'resync' }]);

    connection.deliver(stateEvent(4));

    expect(getNotificationUnreadCount()).toBe(4);
    expect(appEvents).toEqual([{ type: 'resync' }]);
  });

  it('publishes playback events from the current attempt only, and they never open the stream', async () => {
    const playbackEvents: AccountPlaybackStreamEvent[] = [];
    const unsubscribePlayback = subscribeNotificationStreamPlaybackEvents((event) => {
      playbackEvents.push(event);
    });
    harness.controller.start();
    const first = harness.latest();

    first.deliverPlayback(playbackDevicesEvent(1));

    expect(playbackEvents).toEqual([playbackDevicesEvent(1)]);
    expect(getNotificationStreamConnection()).toBe('connecting');
    expect(getNotificationUnreadCount()).toBe(0);
    expect(appEvents).toEqual([]);

    await harness.advance(15_000);
    expect(first.params.signal.aborted).toBe(true);
    first.deliverPlayback(playbackDevicesEvent(2));

    expect(playbackEvents).toEqual([playbackDevicesEvent(1)]);

    await harness.advance(1_000);
    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(harness.latest().params.lastEventId).toBeNull();
    unsubscribePlayback();
  });

  it('publishes each created id once and reconnects with the highest id', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(0));

    first.deliver(createdEvent(12, 1));
    first.deliver(createdEvent(10, 2));
    first.deliver(createdEvent(12, 2));

    expect(createdIds()).toEqual([12, 10]);
    expect(getNotificationUnreadCount()).toBe(2);

    await harness.advance(10_000);
    first.end();
    await flush();

    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(harness.latest().params.lastEventId).toBe(12);

    harness.latest().deliver(stateEvent(2));

    expect(resyncCount()).toBe(1);
  });

  it('reconnects at once after a clean end that followed 10 s open', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(0));

    await harness.advance(10_000);
    first.end();
    await flush();

    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(getNotificationStreamConnection()).toBe('connecting');
    expect(harness.fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('waits 1 s after a clean end that came sooner than 10 s', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(0));

    await harness.advance(9_999);
    first.end();
    await flush();

    expect(getNotificationStreamConnection()).toBe('retrying');
    await harness.advance(999);
    expect(harness.connect).toHaveBeenCalledTimes(1);
    await harness.advance(1);
    expect(harness.connect).toHaveBeenCalledTimes(2);
  });

  it('retries a 503 at 1 s and then 2 s, refetching the count once', async () => {
    harness.controller.start();
    harness.latest().fail(new NotificationStreamHttpError(503));
    await flush();

    expect(getNotificationStreamConnection()).toBe('retrying');
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(1);
    expect(getNotificationUnreadCount()).toBe(7);

    await harness.advance(999);
    expect(harness.connect).toHaveBeenCalledTimes(1);
    await harness.advance(1);
    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(harness.latest().params.lastEventId).toBeNull();

    harness.latest().fail(new NotificationStreamHttpError(503));
    await flush();

    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(1);
    await harness.advance(1_999);
    expect(harness.connect).toHaveBeenCalledTimes(2);
    await harness.advance(1);
    expect(harness.connect).toHaveBeenCalledTimes(3);
  });

  it('polls at 60 s while the stream is down and stops once a connection opens', async () => {
    harness.failEveryConnectWith(new NotificationStreamHttpError(503));
    harness.controller.start();
    await flush();

    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(1);
    await harness.advance(59_999);
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(1);
    await harness.advance(1);
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(2);

    // Reconnects ran at 1, 3, 8, 18, and 48 s; the next one is 30 s later, at 78 s.
    harness.failEveryConnectWith(null);
    await harness.advance(18_000);
    expect(harness.connect).toHaveBeenCalledTimes(7);
    harness.latest().deliver(stateEvent(1));
    expect(getNotificationStreamConnection()).toBe('open');

    await harness.advance(59_000);
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('stops reconnecting after a 429, refetches once, and keeps polling', async () => {
    harness.controller.start();
    harness.latest().fail(new NotificationStreamHttpError(429));
    await flush();

    expect(getNotificationStreamConnection()).toBe('stopped');
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(1);

    await harness.advance(60_000);
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(2);
    await harness.advance(60_000);
    expect(harness.fetchUnreadCount).toHaveBeenCalledTimes(3);
    expect(harness.connect).toHaveBeenCalledTimes(1);
  });

  it('stops after a 401 with no refetch and no poll', async () => {
    harness.controller.start();
    harness.latest().fail(new NotificationStreamHttpError(401));
    await flush();

    expect(getNotificationStreamConnection()).toBe('stopped');
    await harness.advance(180_000);
    expect(harness.fetchUnreadCount).not.toHaveBeenCalled();
    expect(harness.connect).toHaveBeenCalledTimes(1);
  });

  it('aborts and retries when no state event arrives within 15 s', async () => {
    harness.controller.start();
    const first = harness.latest();

    await harness.advance(14_999);
    expect(first.params.signal.aborted).toBe(false);
    await harness.advance(1);
    expect(first.params.signal.aborted).toBe(true);
    expect(getNotificationStreamConnection()).toBe('retrying');

    first.fail(new Error('aborted'));
    await flush();

    await harness.advance(999);
    expect(harness.connect).toHaveBeenCalledTimes(1);
    await harness.advance(1);
    expect(harness.connect).toHaveBeenCalledTimes(2);
  });

  it('aborts and retries after 60 s with no bytes on an open stream', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(0));

    await harness.advance(30_000);
    first.params.onActivity();
    await harness.advance(59_999);
    expect(first.params.signal.aborted).toBe(false);
    await harness.advance(1);
    expect(first.params.signal.aborted).toBe(true);
    expect(getNotificationStreamConnection()).toBe('retrying');
  });

  it('stop aborts, clears timers, drops late events, and the next start opens fresh', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(2));
    first.deliver(createdEvent(5, 3));

    harness.controller.stop();

    expect(first.params.signal.aborted).toBe(true);
    expect(getNotificationStreamConnection()).toBe('idle');

    first.deliver(createdEvent(9, 4));
    first.deliver(stateEvent(8));
    first.fail(new NotificationStreamHttpError(503));
    await flush();

    expect(getNotificationUnreadCount()).toBe(3);
    expect(createdIds()).toEqual([5]);
    expect(getNotificationStreamConnection()).toBe('idle');

    await harness.advance(180_000);
    expect(harness.connect).toHaveBeenCalledTimes(1);
    expect(harness.fetchUnreadCount).not.toHaveBeenCalled();

    harness.controller.start();
    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(harness.latest().params.lastEventId).toBeNull();
  });

  it('keeps a connection that sent bytes 5 s before the return to the foreground', async () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(1));

    await harness.advance(5_000);
    harness.controller.resumeForeground();

    expect(harness.connect).toHaveBeenCalledTimes(1);
    expect(first.params.signal.aborted).toBe(false);
    expect(resyncCount()).toBe(1);
  });

  it('restarts with no Last-Event-ID when the wall clock moved 61 s past the last bytes', () => {
    harness.controller.start();
    const first = harness.latest();
    first.deliver(stateEvent(1));
    first.deliver(createdEvent(20, 2));

    harness.moveWallClock(61_000);
    expect(getNotificationStreamConnection()).toBe('open');
    harness.controller.resumeForeground();

    expect(first.params.signal.aborted).toBe(true);
    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(harness.latest().params.lastEventId).toBeNull();
  });

  it('does nothing on a return to the foreground before start', () => {
    harness.controller.resumeForeground();

    expect(harness.connect).not.toHaveBeenCalled();
    expect(getNotificationStreamConnection()).toBe('idle');
  });
});
