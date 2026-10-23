import { app } from '@management-api/app.js';
import { config } from '@management-api/config/index.js';
import { TEST_ADMIN_SESSION_CLAIMS } from '@management-api/test/adminSessionStoreStub.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';
const statsBase = `${config.api.prefix}${config.api.version}/stats`;
const listenerId = '11111111-1111-4111-8111-111111111111';
const flaggedAt = new Date('2026-10-20T08:00:00.000Z');
const clearedAt = new Date('2026-10-23T15:04:00.000Z');

const superuserWithAllPerms = {
  id: 1,
  id_text: 'pvMgtSu001',
  admin_account_role_id: 1,
  admin_account_role: { role: 'superuser' },
  admin_account_credentials: { email: 'super@example.com' },
  permissions: {
    id: 1,
    admin_account_id: 1,
    feedsCrud: 15,
    feedTakedownReasonsCrud: 15,
    adminsCrud: 15,
    statsCrud: 15,
    billingPricesCrud: 15,
    created_at: new Date(),
    updated_at: new Date(),
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
  updated_at: new Date('2020-01-01T00:00:00.000Z'),
};

const adminWithStatsRead = {
  id: 2,
  id_text: 'pvMgtAd002',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'reader@example.com' },
  permissions: {
    id: 2,
    admin_account_id: 2,
    feedsCrud: 0,
    feedTakedownReasonsCrud: 0,
    adminsCrud: 0,
    statsCrud: 2,
    billingPricesCrud: 0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
  updated_at: new Date('2020-01-01T00:00:00.000Z'),
};

const adminWithNoPerms = {
  id: 3,
  id_text: 'pvMgtAd003',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'noperms@example.com' },
  permissions: {
    id: 3,
    admin_account_id: 3,
    feedsCrud: 0,
    feedTakedownReasonsCrud: 0,
    adminsCrud: 0,
    statsCrud: 0,
    billingPricesCrud: 0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
  updated_at: new Date('2020-01-01T00:00:00.000Z'),
};

const adminWithStatsReadAndUpdate = {
  id: 4,
  id_text: 'pvMgtAd004',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'editor@example.com' },
  permissions: {
    id: 4,
    admin_account_id: 4,
    feedsCrud: 0,
    feedTakedownReasonsCrud: 0,
    adminsCrud: 0,
    statsCrud: 6,
    billingPricesCrud: 0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
  updated_at: new Date('2020-01-01T00:00:00.000Z'),
};

const {
  getWithRoleAndPermissionsMock,
  queryMock,
  readWriteQueryMock,
  readWriteTransactionMock,
  auditRecordMock,
} = vi.hoisted(() => ({
  getWithRoleAndPermissionsMock: vi.fn(async (id: number) => {
    if (id === 1) return superuserWithAllPerms;
    if (id === 2) return adminWithStatsRead;
    if (id === 3) return adminWithNoPerms;
    if (id === 4) return adminWithStatsReadAndUpdate;
    return null;
  }),
  queryMock: vi.fn(async () => []),
  readWriteQueryMock: vi.fn(async () => []),
  readWriteTransactionMock: vi.fn(
    async (fn: (manager: { query: typeof queryMock }) => Promise<unknown>) =>
      fn({ query: readWriteQueryMock })
  ),
  auditRecordMock: vi.fn(async (_entry: Record<string, unknown>) => undefined),
}));

vi.mock('@management-api/orm/services/adminAccount.js', () => {
  class AdminAccountService {
    async getWithRoleAndPermissions(id: number) {
      return getWithRoleAndPermissionsMock(id);
    }
  }
  return { AdminAccountService };
});

vi.mock('@management-api/orm/db/appDb.js', () => ({
  AppDbDataSourceRead: {
    query: queryMock,
  },
  AppDbDataSourceReadWrite: {
    query: readWriteQueryMock,
    transaction: readWriteTransactionMock,
  },
}));

vi.mock('@management-api/lib/database/auditLog.js', () => {
  class AuditLogService {
    record(entry: Record<string, unknown>) {
      return auditRecordMock(entry);
    }
  }
  return { AuditLogService };
});

const adminIdTextByUserId: Record<number, string> = {
  1: 'pvMgtSu001',
  2: 'pvMgtAd002',
  3: 'pvMgtAd003',
  4: 'pvMgtAd004',
};

function authHeaders(userId: number) {
  const token = jwt.sign(
    {
      id: userId,
      id_text: adminIdTextByUserId[userId] ?? 'pvMgtSu001',
      ...TEST_ADMIN_SESSION_CLAIMS,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { Authorization: `Bearer ${token}` };
}

function sqlTexts(calls: ReadonlyArray<ReadonlyArray<unknown>>): string[] {
  const texts: string[] = [];
  for (const call of calls) {
    const sql = call[0];
    if (typeof sql === 'string') {
      texts.push(sql);
    }
  }
  return texts;
}

function assertQueriesStayOffAccounts(calls: ReadonlyArray<ReadonlyArray<unknown>>): void {
  for (const sql of sqlTexts(calls)) {
    expect(sql).not.toContain('listener_identity');
    expect(sql).not.toMatch(/\baccount/);
  }
}

function activeFlagRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    listener_id: listenerId,
    reason: 'stored_cap_reached',
    flagged_at: flaggedAt,
    times_flagged: 2,
    cleared_at: null,
    cleared_by_admin_id: null,
    listens_last_7_days: 14,
    opens_last_7_days: 3,
    ...overrides,
  };
}

describe('Flagged listener routes', () => {
  beforeEach(() => {
    getWithRoleAndPermissionsMock.mockClear();
    queryMock.mockReset();
    readWriteQueryMock.mockReset();
    readWriteTransactionMock.mockReset();
    auditRecordMock.mockReset();
    queryMock.mockResolvedValue([]);
    readWriteQueryMock.mockResolvedValue([]);
    readWriteTransactionMock.mockImplementation(
      async (fn: (manager: { query: typeof queryMock }) => Promise<unknown>) =>
        fn({ query: readWriteQueryMock })
    );
  });

  describe('GET /stats/flagged-listeners', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`${statsBase}/flagged-listeners`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for an admin with no stats permission', async () => {
      const res = await request(app).get(`${statsBase}/flagged-listeners`).set(authHeaders(3));
      expect(res.status).toBe(403);
    });

    it('returns ISO dates and numeric counts for a stats reader, with active flags first', async () => {
      queryMock.mockResolvedValueOnce([{ total: 1 }]);
      queryMock.mockResolvedValueOnce([activeFlagRow()]);

      const res = await request(app).get(`${statsBase}/flagged-listeners`).set(authHeaders(2));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 25 });
      expect(res.body.rows).toEqual([
        {
          id: 12,
          listener_id: listenerId,
          reason: 'stored_cap_reached',
          flagged_at: flaggedAt.toISOString(),
          times_flagged: 2,
          cleared_at: null,
          cleared_by_admin_id: null,
          listens_last_7_days: 14,
          opens_last_7_days: 3,
        },
      ]);

      const rowSql = sqlTexts(queryMock.mock.calls).find((sql) => sql.includes('ORDER BY'));
      expect(rowSql).toContain('cleared_at IS NULL');
      expect(rowSql).toContain('ORDER BY f.flagged_at DESC');
      assertQueriesStayOffAccounts(queryMock.mock.calls);
    });

    it('orders cleared flags by cleared_at', async () => {
      queryMock.mockResolvedValueOnce([{ total: 0 }]);
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`${statsBase}/flagged-listeners?status=cleared`)
        .set(authHeaders(2));
      expect(res.status).toBe(200);

      const rowSql = sqlTexts(queryMock.mock.calls).find((sql) => sql.includes('ORDER BY'));
      expect(rowSql).toContain('cleared_at IS NOT NULL');
      expect(rowSql).toContain('ORDER BY f.cleared_at DESC');
      assertQueriesStayOffAccounts(queryMock.mock.calls);
    });

    it('returns 400 for status=open', async () => {
      const res = await request(app)
        .get(`${statsBase}/flagged-listeners?status=open`)
        .set(authHeaders(2));
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(expect.any(String));
    });

    it('returns 400 for limit=101', async () => {
      const res = await request(app)
        .get(`${statsBase}/flagged-listeners?limit=101`)
        .set(authHeaders(2));
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(expect.any(String));
    });
  });

  describe('POST /stats/flagged-listeners/:id/clear', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post(`${statsBase}/flagged-listeners/12/clear`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for a stats reader', async () => {
      const res = await request(app)
        .post(`${statsBase}/flagged-listeners/12/clear`)
        .set(authHeaders(2));
      expect(res.status).toBe(403);
    });

    it.each(['abc', '0'])('returns 400 for id %s', async (id) => {
      const res = await request(app)
        .post(`${statsBase}/flagged-listeners/${id}/clear`)
        .set(authHeaders(4));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid id' });
    });

    it('returns 404 when the locked select finds no row', async () => {
      readWriteQueryMock.mockResolvedValueOnce([]);

      const res = await request(app)
        .post(`${statsBase}/flagged-listeners/12/clear`)
        .set(authHeaders(4));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Flagged listener not found' });
      expect(auditRecordMock).not.toHaveBeenCalled();
      assertQueriesStayOffAccounts(readWriteQueryMock.mock.calls);
    });

    it('returns 409 when the flag is already cleared', async () => {
      readWriteQueryMock.mockResolvedValueOnce([
        activeFlagRow({ cleared_at: clearedAt, cleared_by_admin_id: 2 }),
      ]);

      const res = await request(app)
        .post(`${statsBase}/flagged-listeners/12/clear`)
        .set(authHeaders(4));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: 'Flag already cleared' });
      expect(auditRecordMock).not.toHaveBeenCalled();
      const updateSql = sqlTexts(readWriteQueryMock.mock.calls).find((sql) =>
        sql.startsWith('UPDATE')
      );
      expect(updateSql).toBeUndefined();
    });

    it('clears the flag, returns the row, and writes an audit entry', async () => {
      readWriteQueryMock.mockResolvedValueOnce([activeFlagRow()]);
      readWriteQueryMock.mockResolvedValueOnce([[], 1]);
      readWriteQueryMock.mockResolvedValueOnce([
        activeFlagRow({ cleared_at: clearedAt, cleared_by_admin_id: 4 }),
      ]);

      const res = await request(app)
        .post(`${statsBase}/flagged-listeners/12/clear`)
        .set(authHeaders(4));
      expect(res.status).toBe(200);
      expect(res.body.row.cleared_at).toBe(clearedAt.toISOString());
      expect(res.body.row.cleared_by_admin_id).toBe(4);

      const updateCall = readWriteQueryMock.mock.calls.find((call) => {
        const sql = call[0];
        return typeof sql === 'string' && sql.startsWith('UPDATE');
      });
      expect(updateCall?.[1]).toEqual([12, 4]);
      expect(auditRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update',
          tableName: 'stats_flagged_listener',
          rowId: 12,
          adminAccountId: 4,
        })
      );
      const entry = auditRecordMock.mock.calls[0]?.[0];
      expect(entry?.beforeSnapshot).toEqual({
        id: 12,
        reason: 'stored_cap_reached',
        flagged_at: flaggedAt.toISOString(),
        times_flagged: 2,
        cleared_at: null,
        cleared_by_admin_id: null,
      });
      expect(entry?.afterSnapshot).toEqual({
        id: 12,
        reason: 'stored_cap_reached',
        flagged_at: flaggedAt.toISOString(),
        times_flagged: 2,
        cleared_at: clearedAt.toISOString(),
        cleared_by_admin_id: 4,
      });
      assertQueriesStayOffAccounts(readWriteQueryMock.mock.calls);
    });
  });
});
