import { beforeEach, describe, expect, it } from 'vitest';

import type { PlaybackStatePublishBody } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers';

import { createPlaybackPublishScheduler } from './playbackPublishScheduler';

type PublishCall = {
  body: PlaybackStatePublishBody;
  resolve: () => void;
  reject: (error: unknown) => void;
};

/** A `publish` whose requests stay in flight until the test settles them. */
function createPublishMock() {
  const calls: PublishCall[] = [];
  const publish = (body: PlaybackStatePublishBody) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ body, resolve, reject });
    });
  return { calls, publish };
}

/** Lets the scheduler observe a settled request. */
async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function body(overrides: Partial<PlaybackStatePublishBody> = {}): PlaybackStatePublishBody {
  return {
    claim: false,
    resource: {
      ref: { kind: 'item', item_id_text: 'item-1' },
      medium: MediumEnum.Podcast,
      title: 'Episode Title',
      channel_title: 'Channel Title',
      image_url: null,
    },
    status: 'playing',
    is_live: false,
    position_seconds: 0,
    duration_seconds: 600,
    rate: 1,
    ...overrides,
  };
}

/** A clock and timer queue the test advances by hand; due timers fire in time order. */
function createFakeTimers() {
  let nowMs = 0;
  let nextId = 1;
  const timers = new Map<number, { atMs: number; callback: () => void }>();

  const nextDue = (targetMs: number) => {
    let due: { id: number; atMs: number; callback: () => void } | null = null;
    for (const [id, timer] of timers) {
      if (timer.atMs <= targetMs && (due === null || timer.atMs < due.atMs)) {
        due = { id, ...timer };
      }
    }
    return due;
  };

  return {
    now: () => nowMs,
    setTimer: (callback: () => void, ms: number) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { atMs: nowMs + ms, callback });
      return id;
    },
    clearTimer: (id: number) => {
      timers.delete(id);
    },
    advanceTimersByTime: (ms: number) => {
      const targetMs = nowMs + ms;
      for (let due = nextDue(targetMs); due !== null; due = nextDue(targetMs)) {
        timers.delete(due.id);
        nowMs = due.atMs;
        due.callback();
      }
      nowMs = targetMs;
    },
  };
}

let fakeTimers = createFakeTimers();

function start() {
  const mock = createPublishMock();
  const scheduler = createPlaybackPublishScheduler({
    publish: mock.publish,
    now: fakeTimers.now,
    setTimer: fakeTimers.setTimer,
    clearTimer: fakeTimers.clearTimer,
  });
  return { ...mock, scheduler };
}

describe('createPlaybackPublishScheduler', () => {
  beforeEach(() => {
    fakeTimers = createFakeTimers();
  });

  it('publishes the first body at once', () => {
    const { calls, scheduler } = start();

    scheduler.update({ body: body({ status: 'paused' }) });

    expect(calls).toHaveLength(1);
  });

  it('publishes a status change inside the gap once, at the end of the gap, with the newest body', async () => {
    const { calls, scheduler } = start();
    scheduler.update({ body: body({ status: 'paused', position_seconds: 10 }) });
    calls[0]?.resolve();
    await settle();

    fakeTimers.advanceTimersByTime(100);
    scheduler.update({ body: body({ status: 'playing', position_seconds: 10 }) });
    fakeTimers.advanceTimersByTime(200);
    scheduler.update({ body: body({ status: 'playing', position_seconds: 10.2 }) });
    fakeTimers.advanceTimersByTime(199);
    expect(calls).toHaveLength(1);

    fakeTimers.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.position_seconds).toBe(10.2);
  });

  it('republishes a steady playing body every interval', async () => {
    const { calls, scheduler } = start();
    scheduler.update({ body: body({ position_seconds: 0 }) });
    calls[0]?.resolve();
    await settle();

    fakeTimers.advanceTimersByTime(5_000);
    scheduler.update({ body: body({ position_seconds: 5 }) });
    expect(calls).toHaveLength(1);

    fakeTimers.advanceTimersByTime(5_000);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.position_seconds).toBe(5);
    calls[1]?.resolve();
    await settle();

    fakeTimers.advanceTimersByTime(10_000);
    expect(calls).toHaveLength(3);
  });

  it('publishes a jump while playing as a discrete change', async () => {
    const { calls, scheduler } = start();
    scheduler.update({ body: body({ position_seconds: 0 }) });
    calls[0]?.resolve();
    await settle();

    fakeTimers.advanceTimersByTime(1_000);
    scheduler.update({ body: body({ position_seconds: 6 }) });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.position_seconds).toBe(6);
  });

  it('waits for the request in flight to settle, rejections included', async () => {
    const { calls, scheduler } = start();
    scheduler.update({ body: body({ status: 'paused' }) });

    fakeTimers.advanceTimersByTime(600);
    scheduler.update({ body: body({ status: 'playing' }) });
    fakeTimers.advanceTimersByTime(1_000);
    expect(calls).toHaveLength(1);

    calls[0]?.reject(new Error('Network down'));
    await settle();

    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.status).toBe('playing');
  });

  it('cancels the trailing publish when the body becomes null', async () => {
    const { calls, scheduler } = start();
    scheduler.update({ body: body({ status: 'paused' }) });
    calls[0]?.resolve();
    await settle();

    fakeTimers.advanceTimersByTime(100);
    scheduler.update({ body: body({ status: 'playing' }) });
    scheduler.update({ body: null });
    fakeTimers.advanceTimersByTime(1_000);
    expect(calls).toHaveLength(1);

    scheduler.update({ body: body({ status: 'paused' }) });
    expect(calls).toHaveLength(2);
  });
});
