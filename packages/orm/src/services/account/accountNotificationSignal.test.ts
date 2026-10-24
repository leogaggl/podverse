import type { AccountEvent, PublishableAccountEvent } from '@orm/lib/accountEventPublisher.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publishAccountEventsMock } = vi.hoisted(() => ({
  publishAccountEventsMock: vi.fn(async (_events: PublishableAccountEvent[]) => undefined),
}));

vi.mock('@orm/lib/accountEventPublisher.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@orm/lib/accountEventPublisher.js')>();
  return { ...original, publishAccountEvents: publishAccountEventsMock };
});

import {
  publishAccountNotificationReadAll,
  publishAccountNotificationReadOne,
  publishAccountNotificationSignals,
  toAccountNotificationSignal,
} from './accountNotificationSignal.js';

describe('accountNotificationSignal', () => {
  beforeEach(() => {
    publishAccountEventsMock.mockClear();
  });

  it('groups created pairs into one event per account, in first-seen order', async () => {
    await publishAccountNotificationSignals([
      {
        kind: 'created',
        pairs: [
          [1, 10],
          [2, 20],
          [1, 11],
        ],
      },
    ]);

    expect(publishAccountEventsMock).toHaveBeenCalledTimes(1);
    expect(publishAccountEventsMock).toHaveBeenCalledWith([
      { account_id: 1, type: 'notification.created', data: { notification_ids: [10, 11] } },
      { account_id: 2, type: 'notification.created', data: { notification_ids: [20] } },
    ]);
  });

  it('maps read_all and read_one to their notification event types', async () => {
    await publishAccountNotificationReadAll(4, new Date('2026-10-01T12:00:00.000Z'));
    await publishAccountNotificationReadOne(4, 99);

    expect(publishAccountEventsMock).toHaveBeenNthCalledWith(1, [
      {
        account_id: 4,
        type: 'notification.read_all',
        data: { last_read_at: '2026-10-01T12:00:00.000Z' },
      },
    ]);
    expect(publishAccountEventsMock).toHaveBeenNthCalledWith(2, [
      { account_id: 4, type: 'notification.read_one', data: { notification_id: 99 } },
    ]);
  });

  it('publishes nothing for an empty signal list', async () => {
    await publishAccountNotificationSignals([]);

    expect(publishAccountEventsMock).not.toHaveBeenCalled();
  });

  it('toAccountNotificationSignal reads back each notification event type', () => {
    expect(
      toAccountNotificationSignal({
        account_id: 3,
        type: 'notification.created',
        data: { notification_ids: [5, 6] },
      })
    ).toEqual({
      kind: 'created',
      pairs: [
        [3, 5],
        [3, 6],
      ],
    });
    expect(
      toAccountNotificationSignal({
        account_id: 3,
        type: 'notification.read_all',
        data: { last_read_at: '2026-10-01T12:00:00.000Z' },
      })
    ).toEqual({ kind: 'read_all', account_id: 3, last_read_at: '2026-10-01T12:00:00.000Z' });
    expect(
      toAccountNotificationSignal({
        account_id: 3,
        type: 'notification.read_one',
        data: { notification_id: 8 },
      })
    ).toEqual({ kind: 'read_one', account_id: 3, notification_id: 8 });
  });

  it('toAccountNotificationSignal ignores playback events and an empty created id list', () => {
    const playbackEvent: AccountEvent = {
      account_id: 3,
      type: 'playback.progress',
      data: { position_seconds: 12 },
    };

    expect(toAccountNotificationSignal(playbackEvent)).toBeNull();
    expect(
      toAccountNotificationSignal({
        account_id: 3,
        type: 'notification.created',
        data: { notification_ids: [] },
      })
    ).toBeNull();
  });
});
