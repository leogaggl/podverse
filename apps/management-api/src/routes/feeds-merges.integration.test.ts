import { app } from '@management-api/app.js';
import { config } from '@management-api/config/index.js';
import { MergeStatusConflictError } from '@management-api/lib/feed/feedMergeReviewErrors.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';
const mergesBase = `${config.api.prefix}${config.api.version}/feeds/merges`;

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

const adminWithFeedsReadOnly = {
  id: 2,
  id_text: 'pvMgtAd002',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'reader@example.com' },
  permissions: {
    id: 2,
    admin_account_id: 2,
    feedsCrud: 2,
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

const adminWithNoFeedPerms = {
  id: 3,
  id_text: 'pvMgtAd003',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'none@example.com' },
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

const { getWithRoleAndPermissionsMock } = vi.hoisted(() => ({
  getWithRoleAndPermissionsMock: vi.fn(async (id: number) => {
    if (id === 1) {
      return superuserWithAllPerms;
    }
    if (id === 2) {
      return adminWithFeedsReadOnly;
    }
    if (id === 3) {
      return adminWithNoFeedPerms;
    }
    return null;
  }),
}));

const sampleMerge = {
  id: 7,
  from_podcast_index_id: 11,
  to_podcast_index_id: 22,
  from_channel_title: 'Old Show',
  to_channel_title: 'Survivor Show',
  confidence: '0.4200',
  mode: 'absorb' as const,
  status: 'needs_review' as const,
  note: null,
  from_feed_lifecycle_state_key: 'active',
  match_stats: { oldCount: 1, survivorCount: 1, matched: 1 },
  item_pairs: [{ from_title: 'Episode', to_title: 'Episode', match_tier: 'guid' as const }],
};

const { listMerges, getMerge, approveMerge, rejectMerge, revertMerge, audit } = vi.hoisted(() => ({
  listMerges: vi.fn(),
  getMerge: vi.fn(),
  approveMerge: vi.fn(),
  rejectMerge: vi.fn(),
  revertMerge: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@management-api/orm/services/adminAccount.js', () => {
  class AdminAccountService {
    async get(id: number) {
      return getWithRoleAndPermissionsMock(id);
    }
    async getWithRoleAndPermissions(id: number) {
      return getWithRoleAndPermissionsMock(id);
    }
  }
  return { AdminAccountService };
});

vi.mock('@management-api/lib/feed/feedMergeReviewAppDb.js', () => ({
  listFeedMerges: (...args: unknown[]) => listMerges(...args),
  getFeedMerge: (...args: unknown[]) => getMerge(...args),
  approveChannelMerge: (...args: unknown[]) => approveMerge(...args),
  rejectChannelMerge: (...args: unknown[]) => rejectMerge(...args),
  revertAppliedChannelMerge: (...args: unknown[]) => revertMerge(...args),
}));

vi.mock('@management-api/lib/database/auditLog.js', () => {
  class AuditLogService {
    async record(args: unknown) {
      return audit(args);
    }
  }
  return { AuditLogService };
});

const adminAuthHeaders = (userId: number): { Authorization: string } => ({
  Authorization: `Bearer ${jwt.sign({ id: userId, id_text: 'pvMgtSu001' }, JWT_SECRET, { expiresIn: '1h' })}`,
});

describe('feed merge review routes', () => {
  beforeEach(() => {
    listMerges.mockReset();
    getMerge.mockReset();
    approveMerge.mockReset();
    rejectMerge.mockReset();
    revertMerge.mockReset();
    audit.mockReset();
    listMerges.mockResolvedValue({ merges: [sampleMerge], total: 1 });
    getMerge.mockResolvedValue(sampleMerge);
  });

  it('GET /feeds/merges defaults to needs_review', async () => {
    const res = await request(app).get(mergesBase).set(adminAuthHeaders(1));
    expect(res.status).toBe(200);
    expect(res.body.merges).toHaveLength(1);
    expect(listMerges).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      status: 'needs_review',
    });
  });

  it('GET /feeds/merges?status=all lists every status', async () => {
    await request(app).get(mergesBase).query({ status: 'all' }).set(adminAuthHeaders(1));
    expect(listMerges).toHaveBeenCalledWith(expect.objectContaining({ status: null }));
  });

  it('GET /feeds/merges returns 401 without a session', async () => {
    const res = await request(app).get(mergesBase);
    expect(res.status).toBe(401);
  });

  it('GET /feeds/merges returns 403 without feed read', async () => {
    const res = await request(app).get(mergesBase).set(adminAuthHeaders(3));
    expect(res.status).toBe(403);
  });

  it('GET /feeds/merges/:id returns the pair and sample episodes', async () => {
    const res = await request(app).get(`${mergesBase}/7`).set(adminAuthHeaders(1));
    expect(res.status).toBe(200);
    expect(res.body.merge.from_feed_lifecycle_state_key).toBe('active');
    expect(res.body.merge.item_pairs).toHaveLength(1);
  });

  it('GET /feeds/merges/:id returns 404 when the pair is missing', async () => {
    getMerge.mockResolvedValueOnce(null);
    const res = await request(app).get(`${mergesBase}/7`).set(adminAuthHeaders(1));
    expect(res.status).toBe(404);
  });

  it('POST approve marks the pair verified, audits, and does not revert', async () => {
    approveMerge.mockResolvedValue({
      before: {
        id: 7,
        status: 'needs_review',
        note: null,
        from_podcast_index_id: 11,
        to_podcast_index_id: 22,
      },
      merge: {
        ...sampleMerge,
        status: 'verified',
        note: 'Same show',
        from_feed_lifecycle_state_key: 'active',
      },
    });
    const res = await request(app)
      .post(`${mergesBase}/7/approve`)
      .set(adminAuthHeaders(1))
      .send({ note: 'Same show' });
    expect(res.status).toBe(200);
    expect(res.body.merge.status).toBe('verified');
    expect(res.body.merge.from_feed_lifecycle_state_key).toBe('active');
    expect(approveMerge).toHaveBeenCalledWith(7, 'Same show');
    expect(revertMerge).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'channel_merge',
        rowId: 7,
        operation: 'update',
        beforeSnapshot: expect.objectContaining({ status: 'needs_review' }),
        afterSnapshot: expect.objectContaining({ status: 'verified', note: 'Same show' }),
      })
    );
  });

  it('POST approve returns 409 when the pair is not needs_review', async () => {
    approveMerge.mockRejectedValue(
      new MergeStatusConflictError('Approve is allowed only when the merge needs review')
    );
    const res = await request(app)
      .post(`${mergesBase}/7/approve`)
      .set(adminAuthHeaders(1))
      .send({});
    expect(res.status).toBe(409);
    expect(revertMerge).not.toHaveBeenCalled();
  });

  it('POST approve returns 403 without feed update', async () => {
    const res = await request(app)
      .post(`${mergesBase}/7/approve`)
      .set(adminAuthHeaders(2))
      .send({});
    expect(res.status).toBe(403);
    expect(approveMerge).not.toHaveBeenCalled();
  });

  it('POST reject marks the pair rejected', async () => {
    rejectMerge.mockResolvedValue({
      before: {
        id: 7,
        status: 'needs_review',
        note: null,
        from_podcast_index_id: 11,
        to_podcast_index_id: 22,
      },
      merge: { ...sampleMerge, status: 'rejected' },
    });
    const res = await request(app).post(`${mergesBase}/7/reject`).set(adminAuthHeaders(1)).send({});
    expect(res.status).toBe(200);
    expect(res.body.merge.status).toBe('rejected');
    expect(rejectMerge).toHaveBeenCalledWith(7, undefined);
    expect(approveMerge).not.toHaveBeenCalled();
  });

  it('POST reject returns 409 when the pair is applied', async () => {
    rejectMerge.mockRejectedValue(
      new MergeStatusConflictError(
        'Reject is allowed only from detected, verified, or needs review'
      )
    );
    const res = await request(app).post(`${mergesBase}/7/reject`).set(adminAuthHeaders(1)).send({});
    expect(res.status).toBe(409);
  });

  it('POST revert restores an applied pair', async () => {
    revertMerge.mockResolvedValue({
      before: {
        id: 7,
        status: 'applied',
        note: null,
        from_podcast_index_id: 11,
        to_podcast_index_id: 22,
      },
      merge: { ...sampleMerge, status: 'reverted', from_feed_lifecycle_state_key: 'active' },
    });
    const res = await request(app).post(`${mergesBase}/7/revert`).set(adminAuthHeaders(1)).send({});
    expect(res.status).toBe(200);
    expect(res.body.merge.status).toBe('reverted');
    expect(revertMerge).toHaveBeenCalledWith(7);
    expect(approveMerge).not.toHaveBeenCalled();
  });

  it('POST revert returns 409 when the pair is not applied', async () => {
    revertMerge.mockRejectedValue(
      new MergeStatusConflictError('Revert is allowed only when the merge is applied')
    );
    const res = await request(app).post(`${mergesBase}/7/revert`).set(adminAuthHeaders(1)).send({});
    expect(res.status).toBe(409);
    expect(approveMerge).not.toHaveBeenCalled();
  });
});
