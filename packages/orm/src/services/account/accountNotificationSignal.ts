import type { AccountEvent, PublishableAccountEvent } from '@orm/lib/accountEventPublisher.js';
import { publishAccountEvents } from '@orm/lib/accountEventPublisher.js';

import { isPlainObject } from '@podverse/helpers';

/**
 * A notification change as the server sees it. These are server-internal; the client-facing
 * stream contract lives in `@podverse/helpers`.
 */
export type AccountNotificationSignal =
  | { kind: 'created'; pairs: Array<[account_id: number, notification_id: number]> }
  | { kind: 'read_all'; account_id: number; last_read_at: string }
  | { kind: 'read_one'; account_id: number; notification_id: number };

const createdPairsToEvents = (
  pairs: Array<[account_id: number, notification_id: number]>
): PublishableAccountEvent[] => {
  const idsByAccount = new Map<number, number[]>();
  for (const [account_id, notification_id] of pairs) {
    const ids = idsByAccount.get(account_id);
    if (ids === undefined) {
      idsByAccount.set(account_id, [notification_id]);
    } else {
      ids.push(notification_id);
    }
  }

  return Array.from(idsByAccount, ([account_id, notification_ids]): PublishableAccountEvent => ({
    account_id,
    type: 'notification.created',
    data: { notification_ids },
  }));
};

const signalToEvents = (signal: AccountNotificationSignal): PublishableAccountEvent[] => {
  switch (signal.kind) {
    case 'created':
      return createdPairsToEvents(signal.pairs);
    case 'read_all':
      return [
        {
          account_id: signal.account_id,
          type: 'notification.read_all',
          data: { last_read_at: signal.last_read_at },
        },
      ];
    case 'read_one':
      return [
        {
          account_id: signal.account_id,
          type: 'notification.read_one',
          data: { notification_id: signal.notification_id },
        },
      ];
  }
};

/**
 * Publishes every signal as account events in one call. Same commit rule as
 * `publishAccountEvents`: call it only after the write has committed.
 */
export async function publishAccountNotificationSignals(
  signals: AccountNotificationSignal[]
): Promise<void> {
  const events = signals.flatMap(signalToEvents);
  if (events.length === 0) {
    return;
  }
  await publishAccountEvents(events);
}

export async function publishAccountNotificationCreated(
  rows: Array<{ id: number; account_id: number }>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await publishAccountNotificationSignals([
    { kind: 'created', pairs: rows.map((row): [number, number] => [row.account_id, row.id]) },
  ]);
}

export async function publishAccountNotificationReadAll(
  account_id: number,
  last_read_at: Date
): Promise<void> {
  await publishAccountNotificationSignals([
    { kind: 'read_all', account_id, last_read_at: last_read_at.toISOString() },
  ]);
}

export async function publishAccountNotificationReadOne(
  account_id: number,
  notification_id: number
): Promise<void> {
  await publishAccountNotificationSignals([{ kind: 'read_one', account_id, notification_id }]);
}

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const readPositiveIntegerList = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const entries: unknown[] = value;
  const ids: number[] = [];
  for (const entry of entries) {
    if (!isPositiveSafeInteger(entry)) {
      return null;
    }
    ids.push(entry);
  }
  return ids;
};

/** The notification signal an account event carries, or null for any other or malformed type. */
export function toAccountNotificationSignal(event: AccountEvent): AccountNotificationSignal | null {
  const { account_id, data } = event;
  if (!isPlainObject(data)) {
    return null;
  }

  switch (event.type) {
    case 'notification.created': {
      const ids = readPositiveIntegerList(data.notification_ids);
      if (ids === null) {
        return null;
      }
      return { kind: 'created', pairs: ids.map((id): [number, number] => [account_id, id]) };
    }
    case 'notification.read_all': {
      const last_read_at = data.last_read_at;
      if (typeof last_read_at !== 'string' || last_read_at.length === 0) {
        return null;
      }
      return { kind: 'read_all', account_id, last_read_at };
    }
    case 'notification.read_one': {
      const notification_id = data.notification_id;
      if (!isPositiveSafeInteger(notification_id)) {
        return null;
      }
      return { kind: 'read_one', account_id, notification_id };
    }
    default:
      return null;
  }
}
