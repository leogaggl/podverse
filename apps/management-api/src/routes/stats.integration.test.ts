import { app } from '@management-api/app.js';
import { config } from '@management-api/config/index.js';
import { TEST_ADMIN_SESSION_CLAIMS } from '@management-api/test/adminSessionStoreStub.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATS_POPULARITY_RANGE_LOOKBACK_DAYS } from '@podverse/helpers';

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';
const statsBase = `${config.api.prefix}${config.api.version}/stats`;

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

const { getWithRoleAndPermissionsMock, queryMock, readWriteQueryMock, readWriteTransactionMock } =
  vi.hoisted(() => ({
    getWithRoleAndPermissionsMock: vi.fn(async (id: number) => {
      if (id === 1) return superuserWithAllPerms;
      if (id === 2) return adminWithStatsRead;
      if (id === 3) return adminWithNoPerms;
      return null;
    }),
    queryMock: vi.fn(async () => []),
    readWriteQueryMock: vi.fn(async () => []),
    readWriteTransactionMock: vi.fn(
      async (fn: (manager: { query: typeof queryMock }) => Promise<unknown>) =>
        fn({ query: readWriteQueryMock })
    ),
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

// Avoid loading management ORM DataSource and entities (see database routes mock pattern).
vi.mock('@management-api/lib/database/auditLog.js', () => {
  class AuditLogService {
    async record() {
      return;
    }
  }
  return { AuditLogService };
});

const adminIdTextByUserId: Record<number, string> = {
  1: 'pvMgtSu001',
  2: 'pvMgtAd002',
  3: 'pvMgtAd003',
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

describe('Stats Routes', () => {
  beforeEach(() => {
    getWithRoleAndPermissionsMock.mockClear();
    queryMock.mockReset();
    readWriteQueryMock.mockReset();
    readWriteTransactionMock.mockReset();
    queryMock.mockResolvedValue([]);
    readWriteQueryMock.mockResolvedValue([]);
    readWriteTransactionMock.mockImplementation(
      async (fn: (manager: { query: typeof queryMock }) => Promise<unknown>) =>
        fn({ query: readWriteQueryMock })
    );
  });

  describe('GET /stats/:entityType/top', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`${statsBase}/channel/top`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for admin without stats permission', async () => {
      const res = await request(app).get(`${statsBase}/channel/top`).set(authHeaders(3));
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid entity type', async () => {
      const res = await request(app).get(`${statsBase}/invalid/top`).set(authHeaders(1));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid entity type');
    });

    it.each(['7day', '30day', '1year'])('returns 400 for range=%s', async (range) => {
      const res = await request(app)
        .get(`${statsBase}/channel/top?range=${range}`)
        .set(authHeaders(1));
      expect(res.status).toBe(400);
    });

    it('orders the week range from stats_popularity_channel.week_count', async () => {
      queryMock.mockResolvedValueOnce([{ total: 0 }]);
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app).get(`${statsBase}/channel/top?range=week`).set(authHeaders(1));
      expect(res.status).toBe(200);

      const rowSql = querySql(1);
      expect(rowSql).toContain('stats_popularity_channel');
      expect(rowSql).toContain('week_count');
      expect(rowSql).not.toContain('stats_aggregated');
      expect(rowSql).not.toContain('day_current_count');
    });

    it('returns data for superuser', async () => {
      queryMock.mockResolvedValueOnce([{ total: 0 }]);
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`${statsBase}/channel/top?range=all-time&limit=10`)
        .set(authHeaders(1));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ rows: [], total: 0 });
    });

    it('returns data for admin with stats read', async () => {
      queryMock.mockResolvedValueOnce([{ total: 0 }]);
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app).get(`${statsBase}/channel/top`).set(authHeaders(2));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /stats/:entityType/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`${statsBase}/channel/1`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid entity type', async () => {
      const res = await request(app).get(`${statsBase}/invalid/1`).set(authHeaders(1));
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid id', async () => {
      const res = await request(app).get(`${statsBase}/channel/notanumber`).set(authHeaders(1));
      expect(res.status).toBe(400);
    });

    it('returns 404 when stats record not found', async () => {
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app).get(`${statsBase}/channel/999`).set(authHeaders(1));
      expect(res.status).toBe(404);
    });

    it('returns popularity counts and a zero-filled daily series', async () => {
      queryMock.mockResolvedValueOnce([
        {
          id: 42,
          title: 'Test Podcast',
          day_count: 1,
          week_count: 7,
          month_count: 30,
          all_time_count: 100,
        },
      ]);
      queryMock.mockResolvedValueOnce([]);

      const res = await request(app).get(`${statsBase}/channel/42`).set(authHeaders(1));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 42,
        title: 'Test Podcast',
        day_count: 1,
        week_count: 7,
        month_count: 30,
        all_time_count: 100,
      });
      expect(res.body.range_count).toBeUndefined();
      expect(res.body.daily).toHaveLength(STATS_POPULARITY_RANGE_LOOKBACK_DAYS.month + 1);
      const daily: unknown = res.body.daily;
      expect(Array.isArray(daily)).toBe(true);
      if (Array.isArray(daily)) {
        for (const point of daily) {
          expect(point).toMatchObject({ listener_count: 0 });
        }
      }
    });
  });

  describe('GET /stats/:entityType/search', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`${statsBase}/channel/search?q=test`);
      expect(res.status).toBe(401);
    });

    it('returns 400 without query param', async () => {
      const res = await request(app).get(`${statsBase}/channel/search`).set(authHeaders(1));
      expect(res.status).toBe(400);
    });

    it('returns search results', async () => {
      queryMock.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Test Podcast',
          day_count: 10,
          week_count: 25,
          month_count: 50,
          all_time_count: 100,
          range_count: 100,
        },
      ]);
      queryMock.mockResolvedValueOnce([{ total: 1 }]);

      const res = await request(app).get(`${statsBase}/channel/search?q=Test`).set(authHeaders(1));
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('searches profiles on stats_popularity_account', async () => {
      queryMock.mockResolvedValueOnce([]);
      queryMock.mockResolvedValueOnce([{ total: 0 }]);

      const res = await request(app).get(`${statsBase}/account/search?q=Ada`).set(authHeaders(1));
      expect(res.status).toBe(200);

      const rowSql = querySql(0);
      expect(rowSql).toContain('stats_popularity_account');
      expect(rowSql).toContain('account_profile');
      expect(rowSql).toContain('account_id');
      expect(rowSql).not.toContain('tracked_account_id');
    });
  });
});

function querySql(callIndex: number): string {
  const call = queryMock.mock.calls[callIndex];
  const sql = call?.[0];
  return typeof sql === 'string' ? sql : '';
}
