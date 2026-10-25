import { beforeEach, describe, expect, it } from 'vitest';

import type { PlaybackPresenceResponse } from '@podverse/helpers';
import { PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS } from '@podverse/helpers';

import {
  PLAYBACK_AVAILABILITY_PENDING_TIMEOUT_MS,
  startPlaybackCheckInLoop,
} from './crossDevicePlaybackCheckIn';
import { createCrossDevicePlaybackStore } from './crossDevicePlaybackStore';

type CheckInCall = {
  resolve: (response: PlaybackPresenceResponse) => void;
  reject: (error: unknown) => void;
};

const PRESENCE: PlaybackPresenceResponse = {
  session_id_text: 'session-this',
  devices: { revision: 1, devices: [] },
  state: null,
};

const MEMBERSHIP_ERROR = {
  response: {
    status: 403,
    data: { code: 'membership_expired', i18nKey: 'membership.membership_expired' },
  },
};

const UNAVAILABLE_ERROR = {
  response: { status: 503, data: { code: 'playback_unavailable' } },
};

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

/** Lets the loop observe a settled check-in. */
async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

let fakeTimers = createFakeTimers();

function start(options: { isLeader: boolean }) {
  const calls: CheckInCall[] = [];
  const membershipBlocks: number[] = [];
  const store = createCrossDevicePlaybackStore({ now: fakeTimers.now, tabId: 'tab-this' });
  store.reset({ accountId: 1, enabled: true });
  const loop = startPlaybackCheckInLoop({
    store,
    checkIn: () =>
      new Promise<PlaybackPresenceResponse>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
    isLeader: () => options.isLeader,
    onMembershipBlocked: () => {
      membershipBlocks.push(fakeTimers.now());
    },
    now: fakeTimers.now,
    setTimer: fakeTimers.setTimer,
    clearTimer: fakeTimers.clearTimer,
  });
  return { calls, membershipBlocks, store, loop };
}

describe('startPlaybackCheckInLoop', () => {
  beforeEach(() => {
    fakeTimers = createFakeTimers();
  });

  it('checks in at start, and the answer makes availability ready with this session', async () => {
    const { calls, store } = start({ isLeader: false });
    expect(calls).toHaveLength(1);
    expect(store.getSnapshot().availability).toBe('pending');

    calls[0]?.resolve(PRESENCE);
    await settle();

    expect(store.getSnapshot().availability).toBe('ready');
    expect(store.getSnapshot().thisSessionIdText).toBe('session-this');
  });

  it('stops a follower after its first success and keeps the leader on the check-in interval', async () => {
    const follower = start({ isLeader: false });
    const leader = start({ isLeader: true });
    follower.calls[0]?.resolve(PRESENCE);
    leader.calls[0]?.resolve(PRESENCE);
    await settle();

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    expect(leader.calls).toHaveLength(2);
    leader.calls[1]?.resolve(PRESENCE);
    await settle();

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS - 1);
    expect(leader.calls).toHaveLength(2);
    fakeTimers.advanceTimersByTime(1);
    expect(leader.calls).toHaveLength(3);

    expect(follower.calls).toHaveLength(1);
  });

  it('marks availability unavailable on a membership 403 and checks in no more', async () => {
    const { calls, membershipBlocks, store, loop } = start({ isLeader: true });
    calls[0]?.reject(MEMBERSHIP_ERROR);
    await settle();

    expect(store.getSnapshot().availability).toBe('unavailable');
    expect(membershipBlocks).toHaveLength(1);

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS * 3);
    loop.checkInNow();
    expect(calls).toHaveLength(1);
  });

  it('marks availability unavailable on a 503 before ready, then ready after a later success', async () => {
    const { calls, store } = start({ isLeader: false });
    calls[0]?.reject(UNAVAILABLE_ERROR);
    await settle();
    expect(store.getSnapshot().availability).toBe('unavailable');

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    expect(calls).toHaveLength(2);
    calls[1]?.resolve(PRESENCE);
    await settle();

    expect(store.getSnapshot().availability).toBe('ready');
  });

  it('keeps availability ready when a check-in fails after ready', async () => {
    const { calls, store } = start({ isLeader: true });
    calls[0]?.resolve(PRESENCE);
    await settle();

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    calls[1]?.reject(UNAVAILABLE_ERROR);
    await settle();

    expect(store.getSnapshot().availability).toBe('ready');
    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    expect(calls).toHaveLength(3);
  });

  it('marks availability unavailable when the first check-in is still unanswered at the timeout', () => {
    const { store } = start({ isLeader: false });

    fakeTimers.advanceTimersByTime(PLAYBACK_AVAILABILITY_PENDING_TIMEOUT_MS - 1);
    expect(store.getSnapshot().availability).toBe('pending');

    fakeTimers.advanceTimersByTime(1);
    expect(store.getSnapshot().availability).toBe('unavailable');
  });

  it('never starts a second check-in while one is slow', async () => {
    const { calls, loop } = start({ isLeader: true });

    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS * 3);
    loop.checkInNow();
    expect(calls).toHaveLength(1);

    calls[0]?.resolve(PRESENCE);
    await settle();
    fakeTimers.advanceTimersByTime(PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    expect(calls).toHaveLength(2);
  });
});
