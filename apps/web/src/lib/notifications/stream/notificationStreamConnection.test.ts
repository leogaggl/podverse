import { describe, expect, it } from 'vitest';

import type {
  EventSourceLike,
  NotificationStreamStatus,
  RawNotificationStreamEvent,
} from './notificationStreamConnection';
import { openNotificationStreamConnection } from './notificationStreamConnection';

const API_BASE_URL = 'http://localhost:4030/api/v2';
const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

class FakeEventSource implements EventSourceLike {
  readyState = CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
    this.readyState = CLOSED;
  }

  open(): void {
    this.readyState = OPEN;
    this.onopen?.(new Event('open'));
  }

  fail(readyState: number): void {
    this.readyState = readyState;
    this.onerror?.(new Event('error'));
  }

  emit(type: string, data: string, lastEventId = ''): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data, lastEventId }));
  }
}

type PendingTimer = { id: number; ms: number; callback: () => void };

function setup() {
  const sources: FakeEventSource[] = [];
  const statuses: NotificationStreamStatus[] = [];
  const events: RawNotificationStreamEvent[] = [];
  const timers: PendingTimer[] = [];
  let nextTimerId = 1;

  const connection = openNotificationStreamConnection({
    apiBaseUrl: API_BASE_URL,
    initialLastEventId: null,
    onRawEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
    createEventSource: (url) => {
      const source = new FakeEventSource(url);
      sources.push(source);
      return source;
    },
    setTimer: (callback, ms) => {
      const id = nextTimerId++;
      timers.push({ id, ms, callback });
      return id;
    },
    clearTimer: (id) => {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) {
        timers.splice(index, 1);
      }
    },
  });

  const latestSource = (): FakeEventSource => {
    const source = sources[sources.length - 1];
    if (source === undefined) {
      throw new Error('No event source was created');
    }
    return source;
  };

  const runNextTimer = (): number => {
    const timer = timers.shift();
    if (timer === undefined) {
      throw new Error('No timer is pending');
    }
    timer.callback();
    return timer.ms;
  };

  return { connection, sources, statuses, events, timers, latestSource, runNextTimer };
}

describe('openNotificationStreamConnection', () => {
  it('reports open and forwards a created event with its id', () => {
    const { connection, statuses, events, latestSource } = setup();
    expect(latestSource().url).toBe(`${API_BASE_URL}/account/events`);

    latestSource().open();
    latestSource().emit('notification.created', '{"n":1}', '7');

    expect(statuses).toEqual(['connecting', 'open']);
    expect(events).toEqual([
      { eventName: 'notification.created', rawData: '{"n":1}', lastEventId: 7 },
    ]);
    expect(connection.getLastEventId()).toBe(7);
  });

  it('reports connecting and leaves the source alone while the browser retries', () => {
    const { sources, statuses, timers, latestSource } = setup();
    latestSource().open();

    latestSource().fail(CONNECTING);

    expect(statuses).toEqual(['connecting', 'open', 'connecting']);
    expect(sources).toHaveLength(1);
    expect(timers).toHaveLength(0);
  });

  it('replaces a closed source after a backoff that doubles and resets on open', () => {
    const { sources, statuses, latestSource, runNextTimer } = setup();
    latestSource().open();
    latestSource().emit('notification.created', '{}', '7');

    latestSource().fail(CLOSED);
    expect(statuses[statuses.length - 1]).toBe('down');
    expect(sources[0]?.closed).toBe(true);

    expect(runNextTimer()).toBe(30_000);
    expect(sources).toHaveLength(2);
    expect(latestSource().url).toBe(`${API_BASE_URL}/account/events?last_event_id=7`);

    latestSource().fail(CLOSED);
    expect(runNextTimer()).toBe(60_000);

    latestSource().open();
    latestSource().fail(CLOSED);
    expect(runNextTimer()).toBe(30_000);
    expect(sources).toHaveLength(4);
  });

  it('reports off on close and cancels a pending retry', () => {
    const { connection, sources, statuses, timers, latestSource } = setup();
    latestSource().fail(CLOSED);
    expect(timers).toHaveLength(1);

    connection.close();
    connection.close();

    expect(timers).toHaveLength(0);
    expect(sources).toHaveLength(1);
    expect(statuses.filter((status) => status === 'off')).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toBe('off');
  });

  it('closes after a session ended event with a notice and does not open another source', () => {
    const { sources, statuses, events, timers, latestSource, runNextTimer } = setup();
    latestSource().open();

    latestSource().emit('session.ended', '{"notice":"signed_out_elsewhere"}');

    expect(events).toEqual([
      {
        eventName: 'session.ended',
        rawData: '{"notice":"signed_out_elsewhere"}',
        lastEventId: null,
      },
    ]);
    expect(latestSource().closed).toBe(true);
    expect(statuses).toEqual(['connecting', 'open', 'off']);

    const fiveMinutesMs = 300_000;
    let elapsed = 0;
    let pending = timers[0];
    while (pending !== undefined && pending.ms <= fiveMinutesMs - elapsed) {
      elapsed += runNextTimer();
      pending = timers[0];
    }
    expect(sources).toHaveLength(1);
  });

  it('leaves the source open after a session ended event with a null notice', () => {
    const { sources, statuses, events, latestSource } = setup();
    latestSource().open();

    latestSource().emit('session.ended', '{"notice":null}');

    expect(events).toEqual([
      { eventName: 'session.ended', rawData: '{"notice":null}', lastEventId: null },
    ]);
    expect(latestSource().closed).toBe(false);
    expect(sources).toHaveLength(1);
    expect(statuses).toEqual(['connecting', 'open']);
  });
});
