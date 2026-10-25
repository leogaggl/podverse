import type { AccountEvent } from '@orm/lib/accountEventPublisher.js';
import { publishAccountEvents } from '@orm/lib/accountEventPublisher.js';

import type { AccountSessionRevokeReason } from '@podverse/helpers';
import { isAccountSessionRevokeReason, isPlainObject } from '@podverse/helpers';

/**
 * Sessions that ended together on one account. Server-internal: the reason crosses Redis between
 * server processes only, and clients receive the mapped notice.
 */
export type AccountSessionEndedSignal = {
  account_id: number;
  session_id_texts: string[];
  reason: AccountSessionRevokeReason;
};

/** Publishes one `session.ended` event. Call only after the revoke has committed. */
export async function publishAccountSessionsEnded(
  signal: AccountSessionEndedSignal
): Promise<void> {
  if (signal.session_id_texts.length === 0) {
    return;
  }
  await publishAccountEvents([
    {
      account_id: signal.account_id,
      type: 'session.ended',
      data: { session_id_texts: signal.session_id_texts, reason: signal.reason },
    },
  ]);
}

const readSessionIdTexts = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const entries: unknown[] = value;
  const ids: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string' || entry.length === 0) {
      return null;
    }
    ids.push(entry);
  }
  return ids;
};

/** The signal a `session.ended` account event carries, or null for any other or malformed event. */
export function toAccountSessionEndedSignal(event: AccountEvent): AccountSessionEndedSignal | null {
  const { account_id, data } = event;
  if (event.type !== 'session.ended' || !isPlainObject(data)) {
    return null;
  }
  const session_id_texts = readSessionIdTexts(data.session_id_texts);
  const reason = data.reason;
  if (session_id_texts === null || !isAccountSessionRevokeReason(reason)) {
    return null;
  }
  return { account_id, session_id_texts, reason };
}
