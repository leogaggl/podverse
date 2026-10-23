import { randomBytes } from 'node:crypto';

import type * as AdminSessionStore from '@management-api/lib/auth/adminSessionStore.js';
import type { AdminSessionRow } from '@management-api/orm/services/adminSession.js';
import { vi } from 'vitest';

import { ONE_YEAR_MS } from '@podverse/helpers';

/** The session every stubbed login starts and every test token names. */
export const TEST_ADMIN_SESSION_ID_TEXT = 'pvMgtSes001';

/** Session claims for a test access token; spread next to `id` and `id_text` in `jwt.sign`. */
export const TEST_ADMIN_SESSION_CLAIMS = {
  sid: TEST_ADMIN_SESSION_ID_TEXT,
  token_use: 'access',
  scope: 'podverse_management_mobile',
} as const;

function randomRefreshTokenId(): string {
  return randomBytes(32).toString('base64url');
}

function stubSessionRow(adminAccountId: number, sessionIdText: string): AdminSessionRow {
  const now = new Date();
  return {
    id: '1',
    id_text: sessionIdText,
    admin_account_id: adminAccountId,
    client_type: 'web',
    device_label: null,
    created_at: now,
    last_seen_at: now,
    idle_expires_at: new Date(now.getTime() + ONE_YEAR_MS),
  };
}

/**
 * Stands in for `adminSessionStore.ts` in management API tests whose admins exist only in mocks,
 * so no session row can reference them. Every session is active and never due for renewal. Tests
 * may assert calls on these mocks; `*.real.integration.test.ts` files run without this stub.
 */
export const adminSessionStoreStub = {
  startAdminSession: vi.fn<typeof AdminSessionStore.startAdminSession>(async (input) => ({
    sessionIdText: TEST_ADMIN_SESSION_ID_TEXT,
    refreshTokenId: input.withRefreshToken ? randomRefreshTokenId() : null,
  })),
  checkAdminSession: vi.fn<typeof AdminSessionStore.checkAdminSession>(async (input) => ({
    kind: 'active',
    session: stubSessionRow(input.adminAccountId, input.sessionIdText),
    renewDue: false,
  })),
  renewAdminSession: vi.fn<typeof AdminSessionStore.renewAdminSession>(async () => true),
  rotateAdminRefreshToken: vi.fn<typeof AdminSessionStore.rotateAdminRefreshToken>(
    async (input) => ({
      kind: 'rotated',
      refreshTokenId: randomRefreshTokenId(),
      session: stubSessionRow(input.adminAccountId, input.sessionIdText),
    })
  ),
  endAdminSession: vi.fn<typeof AdminSessionStore.endAdminSession>(async () => true),
  endAdminSessions: vi.fn<typeof AdminSessionStore.endAdminSessions>(async () => 0),
  listAdminSessions: vi.fn<typeof AdminSessionStore.listAdminSessions>(async () => []),
} satisfies typeof AdminSessionStore;
