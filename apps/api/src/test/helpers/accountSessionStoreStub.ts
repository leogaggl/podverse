import { randomBytes } from 'node:crypto';

import { vi } from 'vitest';

import { ONE_YEAR_MS } from '@podverse/helpers';
import type { AccountSessionRow } from '@podverse/orm';

import type * as AccountSessionStore from '../../lib/auth/accountSessionStore.js';
import { TEST_ACCOUNT_SESSION_ID_TEXT } from './testAccountIds.js';

function randomRefreshTokenId(): string {
  return randomBytes(32).toString('base64url');
}

function stubSessionRow(accountId: number, sessionIdText: string): AccountSessionRow {
  const now = new Date();
  return {
    id: '1',
    id_text: sessionIdText,
    account_id: accountId,
    client_type: 'web',
    device_label: null,
    created_at: now,
    last_seen_at: now,
    idle_expires_at: new Date(now.getTime() + ONE_YEAR_MS),
  };
}

/**
 * Stands in for `accountSessionStore.ts` in API tests whose accounts exist only in mocks, so no
 * session row can reference them. Every session is active and never due for renewal. Tests may
 * assert calls on these mocks; `startTestApp({ accountSessions: 'real' })` uses the real store.
 */
export const accountSessionStoreStub = {
  startAccountSession: vi.fn<typeof AccountSessionStore.startAccountSession>(async (input) => ({
    sessionIdText: TEST_ACCOUNT_SESSION_ID_TEXT,
    refreshTokenId: input.withRefreshToken ? randomRefreshTokenId() : null,
  })),
  checkAccountSession: vi.fn<typeof AccountSessionStore.checkAccountSession>(async (input) => ({
    kind: 'active',
    session: stubSessionRow(input.accountId, input.sessionIdText),
    renewDue: false,
  })),
  renewAccountSession: vi.fn<typeof AccountSessionStore.renewAccountSession>(async () => true),
  rotateMobileRefreshToken: vi.fn<typeof AccountSessionStore.rotateMobileRefreshToken>(
    async (input) => ({
      kind: 'rotated',
      refreshTokenId: randomRefreshTokenId(),
      session: stubSessionRow(input.accountId, input.sessionIdText),
    })
  ),
  endAccountSession: vi.fn<typeof AccountSessionStore.endAccountSession>(async () => true),
  endAccountSessions: vi.fn<typeof AccountSessionStore.endAccountSessions>(async () => 0),
  listAccountSessions: vi.fn<typeof AccountSessionStore.listAccountSessions>(async () => []),
} satisfies typeof AccountSessionStore;
