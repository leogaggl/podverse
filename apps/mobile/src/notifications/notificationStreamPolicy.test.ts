import { describe, expect, it } from 'vitest';

import type { NotificationStreamRunInputs } from './notificationStreamPolicy';
import {
  classifyNotificationStreamFailure,
  createSeenNotificationIds,
  notificationStreamForegroundReturnAction,
  NotificationStreamHttpError,
  notificationStreamRetryDelayMs,
  shouldRunNotificationStream,
} from './notificationStreamPolicy';

const SIGNED_IN_FOREGROUND: NotificationStreamRunInputs = {
  signedIn: true,
  appActive: true,
  backgroundAudioActive: false,
  offlineModeEnabled: false,
  termsBlocksAccountSync: false,
};

const BACKGROUND_WITH_AUDIO: NotificationStreamRunInputs = {
  ...SIGNED_IN_FOREGROUND,
  appActive: false,
  backgroundAudioActive: true,
};

describe('classifyNotificationStreamFailure', () => {
  it.each([
    [401, 'final'],
    [403, 'poll_only'],
    [404, 'poll_only'],
    [429, 'poll_only'],
    [500, 'retry'],
    [503, 'retry'],
  ] as const)('classifies HTTP %i as %s', (status, kind) => {
    expect(classifyNotificationStreamFailure(new NotificationStreamHttpError(status))).toBe(kind);
  });

  it('retries a failure with no status', () => {
    expect(classifyNotificationStreamFailure(new Error('socket closed'))).toBe('retry');
    expect(classifyNotificationStreamFailure(undefined)).toBe('retry');
  });

  it('reads an axios-shaped status the same way', () => {
    expect(classifyNotificationStreamFailure({ response: { status: 401 } })).toBe('final');
  });
});

describe('notificationStreamRetryDelayMs', () => {
  it('walks the ladder and holds at the last rung', () => {
    const delays = [1, 2, 3, 4, 5, 6].map((failureCount) =>
      notificationStreamRetryDelayMs(failureCount, () => 0.5)
    );

    expect(delays).toEqual([1000, 2000, 5000, 10000, 30000, 30000]);
  });

  it('scales by a jitter factor from 0.8 to 1.2', () => {
    expect(notificationStreamRetryDelayMs(1, () => 0)).toBe(800);
    expect(notificationStreamRetryDelayMs(1, () => 0.999)).toBe(1200);
  });
});

describe('createSeenNotificationIds', () => {
  it('drops a repeat and evicts the oldest id past the limit', () => {
    const seen = createSeenNotificationIds(3);

    expect(seen.add(1)).toBe(true);
    expect(seen.add(1)).toBe(false);
    expect(seen.add(2)).toBe(true);
    expect(seen.add(3)).toBe(true);
    expect(seen.add(4)).toBe(true);

    expect(seen.add(1)).toBe(true);
    expect(seen.add(3)).toBe(false);
  });

  it('forgets every id on clear', () => {
    const seen = createSeenNotificationIds(3);
    seen.add(5);

    seen.clear();

    expect(seen.add(5)).toBe(true);
  });
});

describe('shouldRunNotificationStream', () => {
  it('runs in the foreground while signed in', () => {
    expect(shouldRunNotificationStream(SIGNED_IN_FOREGROUND)).toBe(true);
  });

  it('stays open in the background while audio plays', () => {
    expect(shouldRunNotificationStream(BACKGROUND_WITH_AUDIO)).toBe(true);
  });

  it('closes in the background with audio stopped', () => {
    expect(shouldRunNotificationStream({ ...SIGNED_IN_FOREGROUND, appActive: false })).toBe(false);
  });

  it('closes when audio stops while in the background', () => {
    const stopped = { ...BACKGROUND_WITH_AUDIO, backgroundAudioActive: false };

    expect(shouldRunNotificationStream(BACKGROUND_WITH_AUDIO)).toBe(true);
    expect(shouldRunNotificationStream(stopped)).toBe(false);
  });

  it.each([
    ['signed out', { signedIn: false }],
    ['Offline Mode on', { offlineModeEnabled: true }],
    ['terms blocking account sync', { termsBlocksAccountSync: true }],
  ] as const)('closes when %s, even while audio plays', (_label, override) => {
    expect(shouldRunNotificationStream({ ...BACKGROUND_WITH_AUDIO, ...override })).toBe(false);
  });
});

describe('notificationStreamForegroundReturnAction', () => {
  it('keeps an open stream on a return to the foreground while audio plays', () => {
    const returned = { ...BACKGROUND_WITH_AUDIO, appActive: true };

    expect(shouldRunNotificationStream(BACKGROUND_WITH_AUDIO)).toBe(true);
    expect(shouldRunNotificationStream(returned)).toBe(true);
    expect(
      notificationStreamForegroundReturnAction({ connection: 'open', msSinceActivity: 5_000 })
    ).toBe('keep');
  });

  it.each([
    ['open', 60_000],
    ['open', null],
    ['retrying', 5_000],
    ['connecting', 5_000],
    ['stopped', 5_000],
  ] as const)('restarts for %s with %s ms since activity', (connection, msSinceActivity) => {
    expect(notificationStreamForegroundReturnAction({ connection, msSinceActivity })).toBe(
      'restart'
    );
  });
});
