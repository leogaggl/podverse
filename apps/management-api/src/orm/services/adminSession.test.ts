import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_CONSTANTS, sha256Hex } from '@podverse/helpers';

const { query, transaction } = vi.hoisted(() => ({
  query: vi.fn(async (_sql: string, _parameters?: readonly unknown[]): Promise<unknown> => []),
  transaction: vi.fn(),
}));

vi.mock('@management-api/orm/db/index.js', () => ({
  AppDataSourceReadWrite: {
    manager: { query },
    transaction,
  },
}));

import {
  createAdminSession,
  getAdminSessionStatus,
  revokeAdminSessions,
  rotateAdminSessionRefreshToken,
} from './adminSession.js';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const LATER = new Date('2027-10-22T12:00:00.000Z');
const EARLIER = new Date('2026-10-01T12:00:00.000Z');

const CURRENT_ID = 'current-refresh-token-id';
const PREVIOUS_ID = 'previous-refresh-token-id';

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '41',
    id_text: 'admsess12a',
    admin_account_id: 3,
    client_type: 'web',
    device_label: 'Firefox on macOS',
    created_at: EARLIER,
    last_seen_at: EARLIER,
    idle_expires_at: LATER,
    refresh_token_hash: sha256Hex(CURRENT_ID),
    previous_refresh_token_hash: sha256Hex(PREVIOUS_ID),
    revoked_reason: null,
    ...overrides,
  };
}

function paramsOf(callIndex: number): readonly unknown[] {
  const params = query.mock.calls[callIndex]?.[1];
  return Array.isArray(params) ? params : [];
}

function sqlOf(callIndex: number): string {
  return String(query.mock.calls[callIndex]?.[0]);
}

function rotate(presentedTokenId: string) {
  return rotateAdminSessionRefreshToken({
    sessionIdText: 'admsess12a',
    adminAccountId: 3,
    presentedTokenId,
    lastSeenAt: NOW,
    idleExpiresAt: LATER,
    now: NOW,
  });
}

/** The locked SELECT answers with `locked`; an UPDATE returns the row it was given. */
function answerRotation(locked: Record<string, unknown> | undefined) {
  query.mockImplementation(async (sql: string, parameters?: readonly unknown[]) => {
    if (sql.includes('FOR UPDATE')) {
      return locked === undefined ? [] : [locked];
    }
    if (sql.includes('RETURNING')) {
      return [[sessionRow({ last_seen_at: parameters?.[3], idle_expires_at: parameters?.[4] })], 1];
    }
    return [[], 1];
  });
}

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue([]);
  transaction.mockReset();
  transaction.mockImplementation(async (run: (manager: { query: typeof query }) => unknown) =>
    run({ query })
  );
});

describe('createAdminSession', () => {
  it('stores the hash of the minted refresh token id and returns the raw id', async () => {
    query.mockResolvedValue([sessionRow({ client_type: 'mobile' })]);

    const result = await createAdminSession({
      adminAccountId: 3,
      clientType: 'mobile',
      deviceLabel: 'Pixel 6 Pro',
      idleExpiresAt: LATER,
      withRefreshToken: true,
    });

    const storedHash = paramsOf(0)[5];
    expect(result.refreshTokenId).not.toBeNull();
    expect(storedHash).not.toBe(result.refreshTokenId);
    expect(storedHash).toBe(sha256Hex(result.refreshTokenId ?? ''));
    expect(result.session.id_text).toBe('admsess12a');
    expect(result.session.admin_account_id).toBe(3);
  });

  it('stores no refresh token hash for a web session', async () => {
    query.mockResolvedValue([sessionRow({ refresh_token_hash: null })]);

    const result = await createAdminSession({
      adminAccountId: 3,
      clientType: 'web',
      deviceLabel: 'Firefox on macOS',
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });

    expect(result.refreshTokenId).toBeNull();
    expect(paramsOf(0)[5]).toBeNull();
  });

  it('stores a null label for blank input and cuts a long one to 255', async () => {
    query.mockResolvedValue([sessionRow()]);

    await createAdminSession({
      adminAccountId: 3,
      clientType: 'web',
      deviceLabel: '   ',
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });
    await createAdminSession({
      adminAccountId: 3,
      clientType: 'web',
      deviceLabel: 'x'.repeat(DATABASE_CONSTANTS.varchar_normal + 40),
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });

    expect(paramsOf(0)[3]).toBeNull();
    expect(paramsOf(1)[3]).toBe('x'.repeat(255));
  });
});

describe('getAdminSessionStatus', () => {
  it('reports the revoked reason even after the idle expiry has passed', async () => {
    query.mockResolvedValue([
      sessionRow({ idle_expires_at: EARLIER, revoked_reason: 'admin_force_logout' }),
    ]);

    const status = await getAdminSessionStatus({
      sessionIdText: 'admsess12a',
      adminAccountId: 3,
      now: NOW,
    });

    expect(status).toEqual({ status: 'revoked', reason: 'admin_force_logout' });
  });

  it('reports a row on another admin as missing', async () => {
    query.mockResolvedValue([sessionRow({ admin_account_id: 4 })]);

    const status = await getAdminSessionStatus({
      sessionIdText: 'admsess12a',
      adminAccountId: 3,
      now: NOW,
    });

    expect(status).toEqual({ status: 'missing' });
  });

  it('reports an unrevoked row past its idle expiry as expired, and a live one as active', async () => {
    query.mockResolvedValueOnce([sessionRow({ idle_expires_at: NOW })]);
    query.mockResolvedValueOnce([sessionRow()]);

    const expired = await getAdminSessionStatus({
      sessionIdText: 'admsess12a',
      adminAccountId: 3,
      now: NOW,
    });
    const active = await getAdminSessionStatus({
      sessionIdText: 'admsess12a',
      adminAccountId: 3,
      now: NOW,
    });

    expect(expired).toEqual({ status: 'expired' });
    expect(active.status).toBe('active');
  });
});

describe('rotateAdminSessionRefreshToken', () => {
  it('rotates the current id, moving its hash to previous', async () => {
    answerRotation(sessionRow());

    const result = await rotate(CURRENT_ID);

    expect(result.outcome).toBe('rotated');
    const refreshTokenId = result.outcome === 'rotated' ? result.refreshTokenId : '';
    const update = paramsOf(1);
    expect(update[1]).toBe(sha256Hex(refreshTokenId));
    expect(update[1]).not.toBe(refreshTokenId);
    expect(update[2]).toBe(sha256Hex(CURRENT_ID));
    expect(update[3]).toBe(NOW);
    expect(update[4]).toBe(LATER);
  });

  it('rotates the previous id at any delay, keeping previous', async () => {
    answerRotation(sessionRow({ last_seen_at: new Date('2026-01-01T00:00:00.000Z') }));

    const result = await rotate(PREVIOUS_ID);

    expect(result.outcome).toBe('rotated');
    const refreshTokenId = result.outcome === 'rotated' ? result.refreshTokenId : '';
    const update = paramsOf(1);
    expect(update[1]).toBe(sha256Hex(refreshTokenId));
    expect(update[2]).toBe(sha256Hex(PREVIOUS_ID));
  });

  it('revokes the session with refresh_reuse when the id is neither current nor previous', async () => {
    answerRotation(sessionRow());

    const result = await rotate('some-other-token-id');

    expect(result).toEqual({ outcome: 'reused' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(sqlOf(1)).toContain("revoked_reason = 'refresh_reuse'");
    expect(paramsOf(1)).toEqual(['41', NOW]);
  });

  it('returns the status of revoked, expired, and other-admin rows without writing', async () => {
    answerRotation(sessionRow({ revoked_reason: 'signed_out_elsewhere' }));
    expect(await rotate(CURRENT_ID)).toEqual({
      outcome: 'revoked',
      reason: 'signed_out_elsewhere',
    });

    answerRotation(sessionRow({ idle_expires_at: EARLIER }));
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'expired' });

    answerRotation(sessionRow({ admin_account_id: 4 }));
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'missing' });

    answerRotation(undefined);
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'missing' });

    expect(query.mock.calls.every((call) => String(call[0]).includes('FOR UPDATE'))).toBe(true);
  });
});

describe('revokeAdminSessions', () => {
  it('passes the except id through only when it is given', async () => {
    query.mockResolvedValue([[], 2]);

    const all = await revokeAdminSessions({
      adminAccountId: 3,
      reason: 'admin_force_logout',
      exceptSessionIdText: null,
      now: NOW,
    });
    const others = await revokeAdminSessions({
      adminAccountId: 3,
      reason: 'password_changed',
      exceptSessionIdText: 'keep12345a',
      now: NOW,
    });

    expect(all).toBe(2);
    expect(others).toBe(2);
    expect(paramsOf(0)).toEqual([3, 'admin_force_logout', NOW]);
    expect(sqlOf(0)).not.toContain('id_text <>');
    expect(paramsOf(1)).toEqual([3, 'password_changed', NOW, 'keep12345a']);
    expect(sqlOf(1)).toContain('id_text <> $4');
  });
});
