import type { PublishableAccountEvent } from '@orm/lib/accountEventPublisher.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publishAccountEventsMock } = vi.hoisted(() => ({
  publishAccountEventsMock: vi.fn(async (_events: PublishableAccountEvent[]) => undefined),
}));

vi.mock('@orm/lib/accountEventPublisher.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@orm/lib/accountEventPublisher.js')>();
  return { ...original, publishAccountEvents: publishAccountEventsMock };
});

import type { AccountSessionEndedSignal } from './accountSessionSignal.js';
import {
  publishAccountSessionsEnded,
  toAccountSessionEndedSignal,
} from './accountSessionSignal.js';

describe('accountSessionSignal', () => {
  beforeEach(() => {
    publishAccountEventsMock.mockClear();
  });

  it('publishes one session.ended event with both session ids and the reason', async () => {
    await publishAccountSessionsEnded({
      account_id: 7,
      session_id_texts: ['sessaaaaa1', 'sessbbbbb2'],
      reason: 'password_changed',
    });

    expect(publishAccountEventsMock).toHaveBeenCalledTimes(1);
    expect(publishAccountEventsMock).toHaveBeenCalledWith([
      {
        account_id: 7,
        type: 'session.ended',
        data: { session_id_texts: ['sessaaaaa1', 'sessbbbbb2'], reason: 'password_changed' },
      },
    ]);
  });

  it('publishes nothing for an empty session id list', async () => {
    await publishAccountSessionsEnded({
      account_id: 7,
      session_id_texts: [],
      reason: 'signed_out',
    });

    expect(publishAccountEventsMock).not.toHaveBeenCalled();
  });

  it('toAccountSessionEndedSignal reads back a published event', async () => {
    const signal: AccountSessionEndedSignal = {
      account_id: 7,
      session_id_texts: ['sessaaaaa1'],
      reason: 'admin_force_logout',
    };
    await publishAccountSessionsEnded(signal);
    const published = publishAccountEventsMock.mock.calls[0]?.[0][0];
    if (published === undefined) {
      throw new Error('No session.ended event was published');
    }

    expect(toAccountSessionEndedSignal(published)).toEqual(signal);
  });

  it('toAccountSessionEndedSignal ignores other types, an empty or non-string id list, and an unknown reason', () => {
    expect(
      toAccountSessionEndedSignal({
        account_id: 7,
        type: 'notification.created',
        data: { notification_ids: [1] },
      })
    ).toBeNull();
    expect(
      toAccountSessionEndedSignal({
        account_id: 7,
        type: 'session.ended',
        data: { session_id_texts: [], reason: 'signed_out' },
      })
    ).toBeNull();
    expect(
      toAccountSessionEndedSignal({
        account_id: 7,
        type: 'session.ended',
        data: { session_id_texts: [42], reason: 'signed_out' },
      })
    ).toBeNull();
    expect(
      toAccountSessionEndedSignal({
        account_id: 7,
        type: 'session.ended',
        data: { session_id_texts: ['sessaaaaa1'], reason: 'vanished' },
      })
    ).toBeNull();
  });
});
