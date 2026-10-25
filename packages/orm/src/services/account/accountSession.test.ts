import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_CONSTANTS, sha256Hex } from '@podverse/helpers';

import type { AccountSessionEndedSignal } from './accountSessionSignal.js';

const { publishAccountSessionsEnded, query, steps, transaction } = vi.hoisted(() => {
  const steps: string[] = [];
  return {
    publishAccountSessionsEnded: vi.fn(async (_signal: AccountSessionEndedSignal) => {
      steps.push('published');
    }),
    query: vi.fn(async (_sql: string, _parameters?: readonly unknown[]): Promise<unknown> => []),
    steps,
    transaction: vi.fn(),
  };
});

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceReadWrite: {
    manager: { query },
    transaction,
  },
}));

vi.mock('./accountSessionSignal.js', () => ({ publishAccountSessionsEnded }));

import {
  createAccountSession,
  getAccountSessionStatus,
  revokeAccountSession,
  revokeAccountSessions,
  rotateAccountSessionRefreshToken,
} from './accountSession.js';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const LATER = new Date('2027-10-22T12:00:00.000Z');
const EARLIER = new Date('2026-10-01T12:00:00.000Z');

const CURRENT_ID = 'current-refresh-token-id';
const PREVIOUS_ID = 'previous-refresh-token-id';

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '41',
    id_text: 'sess12345a',
    account_id: 7,
    client_type: 'mobile',
    device_label: 'Pixel 6 Pro',
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
  return rotateAccountSessionRefreshToken({
    sessionIdText: 'sess12345a',
    accountId: 7,
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
  publishAccountSessionsEnded.mockClear();
  steps.length = 0;
  transaction.mockReset();
  transaction.mockImplementation(
    async (run: (manager: { query: typeof query }) => Promise<unknown>) => {
      const result = await run({ query });
      steps.push('committed');
      return result;
    }
  );
});

describe('createAccountSession', () => {
  it('stores the hash of the minted refresh token id and returns the raw id', async () => {
    query.mockResolvedValue([sessionRow()]);

    const result = await createAccountSession({
      accountId: 7,
      clientType: 'mobile',
      deviceLabel: 'Pixel 6 Pro',
      idleExpiresAt: LATER,
      withRefreshToken: true,
    });

    const storedHash = paramsOf(0)[5];
    expect(result.refreshTokenId).not.toBeNull();
    expect(storedHash).not.toBe(result.refreshTokenId);
    expect(storedHash).toBe(sha256Hex(result.refreshTokenId ?? ''));
    expect(result.session.id_text).toBe('sess12345a');
  });

  it('stores no refresh token hash for a web session', async () => {
    query.mockResolvedValue([sessionRow({ client_type: 'web', refresh_token_hash: null })]);

    const result = await createAccountSession({
      accountId: 7,
      clientType: 'web',
      deviceLabel: 'Firefox on macOS',
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });

    expect(result.refreshTokenId).toBeNull();
    expect(paramsOf(0)[5]).toBeNull();
  });

  it('stores a null label for blank input and cuts a long one', async () => {
    query.mockResolvedValue([sessionRow()]);

    await createAccountSession({
      accountId: 7,
      clientType: 'web',
      deviceLabel: '   ',
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });
    await createAccountSession({
      accountId: 7,
      clientType: 'web',
      deviceLabel: 'x'.repeat(DATABASE_CONSTANTS.varchar_normal + 40),
      idleExpiresAt: LATER,
      withRefreshToken: false,
    });

    expect(paramsOf(0)[3]).toBeNull();
    expect(paramsOf(1)[3]).toBe('x'.repeat(DATABASE_CONSTANTS.varchar_normal));
  });
});

describe('getAccountSessionStatus', () => {
  it('reports the revoked reason even after the idle expiry has passed', async () => {
    query.mockResolvedValue([
      sessionRow({ idle_expires_at: EARLIER, revoked_reason: 'admin_force_logout' }),
    ]);

    const status = await getAccountSessionStatus({
      sessionIdText: 'sess12345a',
      accountId: 7,
      now: NOW,
    });

    expect(status).toEqual({ status: 'revoked', reason: 'admin_force_logout' });
  });

  it('reports a row on another account as missing', async () => {
    query.mockResolvedValue([sessionRow({ account_id: 8 })]);

    const status = await getAccountSessionStatus({
      sessionIdText: 'sess12345a',
      accountId: 7,
      now: NOW,
    });

    expect(status).toEqual({ status: 'missing' });
  });

  it('reports an unrevoked row past its idle expiry as expired, and a live one as active', async () => {
    query.mockResolvedValueOnce([sessionRow({ idle_expires_at: NOW })]);
    query.mockResolvedValueOnce([sessionRow()]);

    const expired = await getAccountSessionStatus({
      sessionIdText: 'sess12345a',
      accountId: 7,
      now: NOW,
    });
    const active = await getAccountSessionStatus({
      sessionIdText: 'sess12345a',
      accountId: 7,
      now: NOW,
    });

    expect(expired).toEqual({ status: 'expired' });
    expect(active.status).toBe('active');
  });
});

describe('rotateAccountSessionRefreshToken', () => {
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
    expect(publishAccountSessionsEnded).not.toHaveBeenCalled();
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

  it('publishes refresh_reuse for the reused session after the transaction resolves', async () => {
    answerRotation(sessionRow());

    await rotate('some-other-token-id');

    expect(publishAccountSessionsEnded).toHaveBeenCalledTimes(1);
    expect(publishAccountSessionsEnded).toHaveBeenCalledWith({
      account_id: 7,
      session_id_texts: ['sess12345a'],
      reason: 'refresh_reuse',
    });
    expect(steps).toEqual(['committed', 'published']);
  });

  it('returns the status of revoked, expired, and other-account rows without writing', async () => {
    answerRotation(sessionRow({ revoked_reason: 'signed_out_elsewhere' }));
    expect(await rotate(CURRENT_ID)).toEqual({
      outcome: 'revoked',
      reason: 'signed_out_elsewhere',
    });

    answerRotation(sessionRow({ idle_expires_at: EARLIER }));
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'expired' });

    answerRotation(sessionRow({ account_id: 8 }));
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'missing' });

    answerRotation(undefined);
    expect(await rotate(CURRENT_ID)).toEqual({ outcome: 'missing' });

    expect(query.mock.calls.every((call) => String(call[0]).includes('FOR UPDATE'))).toBe(true);
  });
});

describe('revokeAccountSession', () => {
  it('publishes the ended session once when a row changed', async () => {
    query.mockResolvedValue([[], 1]);

    const revoked = await revokeAccountSession({
      accountId: 7,
      sessionIdText: 'sess12345a',
      reason: 'signed_out_elsewhere',
      now: NOW,
    });

    expect(revoked).toBe(true);
    expect(publishAccountSessionsEnded).toHaveBeenCalledTimes(1);
    expect(publishAccountSessionsEnded).toHaveBeenCalledWith({
      account_id: 7,
      session_id_texts: ['sess12345a'],
      reason: 'signed_out_elsewhere',
    });
  });

  it('publishes nothing when no row changed', async () => {
    query.mockResolvedValue([[], 0]);

    const revoked = await revokeAccountSession({
      accountId: 7,
      sessionIdText: 'sess12345a',
      reason: 'signed_out_elsewhere',
      now: NOW,
    });

    expect(revoked).toBe(false);
    expect(publishAccountSessionsEnded).not.toHaveBeenCalled();
  });
});

describe('revokeAccountSessions', () => {
  it('passes the except id through only when it is given', async () => {
    query.mockResolvedValue([[{ id_text: 'sessaaaaa1' }, { id_text: 'sessbbbbb2' }], 2]);

    const all = await revokeAccountSessions({
      accountId: 7,
      reason: 'admin_force_logout',
      exceptSessionIdText: null,
      now: NOW,
    });
    const others = await revokeAccountSessions({
      accountId: 7,
      reason: 'password_changed',
      exceptSessionIdText: 'keep12345a',
      now: NOW,
    });

    expect(all).toBe(2);
    expect(others).toBe(2);
    expect(paramsOf(0)).toEqual([7, 'admin_force_logout', NOW]);
    expect(sqlOf(0)).not.toContain('id_text <>');
    expect(sqlOf(0)).toContain('RETURNING id_text');
    expect(paramsOf(1)).toEqual([7, 'password_changed', NOW, 'keep12345a']);
    expect(sqlOf(1)).toContain('id_text <> $4');
    expect(sqlOf(1)).toContain('RETURNING id_text');
  });

  it('publishes exactly the returned session ids and returns their count', async () => {
    query.mockResolvedValue([[{ id_text: 'sessaaaaa1' }, { id_text: 'sessbbbbb2' }], 2]);

    const count = await revokeAccountSessions({
      accountId: 7,
      reason: 'password_changed',
      exceptSessionIdText: 'keep12345a',
      now: NOW,
    });

    expect(count).toBe(2);
    expect(publishAccountSessionsEnded).toHaveBeenCalledTimes(1);
    expect(publishAccountSessionsEnded).toHaveBeenCalledWith({
      account_id: 7,
      session_id_texts: ['sessaaaaa1', 'sessbbbbb2'],
      reason: 'password_changed',
    });
  });

  it('returns 0 and publishes no event when no row changed', async () => {
    query.mockResolvedValue([[], 0]);

    const count = await revokeAccountSessions({
      accountId: 7,
      reason: 'admin_force_logout',
      exceptSessionIdText: null,
      now: NOW,
    });

    expect(count).toBe(0);
    expect(publishAccountSessionsEnded).not.toHaveBeenCalled();
  });
});
