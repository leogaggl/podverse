import { ensureAuthenticated } from '@management-api/lib/auth/index.js';
import { requireCrud } from '@management-api/lib/authz/requireCrud.js';
import { AuditLogService } from '@management-api/lib/database/auditLog.js';
import type { FeedMergeAuditSnapshot } from '@management-api/lib/feed/feedMergeReviewAppDb.js';
import type { FeedMergeDetail } from '@management-api/lib/feed/feedMergeReviewAppDb.js';
import type { FeedMergeReviewUpdate } from '@management-api/lib/feed/feedMergeReviewAppDb.js';
import {
  approveChannelMerge,
  getFeedMerge,
  listFeedMerges,
  rejectChannelMerge,
  revertAppliedChannelMerge,
} from '@management-api/lib/feed/feedMergeReviewAppDb.js';
import { MergeStatusConflictError } from '@management-api/lib/feed/feedMergeReviewErrors.js';
import { getAuditRequestId } from '@management-api/lib/getAuditRequestId.js';
import type { FeedMergeListStatus } from '@management-api/schemas/feedMergeReview.js';
import type { FeedMergeNoteBodyValidated } from '@management-api/schemas/feedMergeReview.js';
import {
  feedMergeListQuerySchema,
  feedMergeNoteBodySchema,
  parseFeedMergeListQuery,
  parseFeedMergeNoteBody,
} from '@management-api/schemas/feedMergeReview.js';
import type { Request, Response, Router } from 'express';

const auditLog = new AuditLogService();

function parseIdParam(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function snapshotRecord(snapshot: FeedMergeAuditSnapshot): Record<string, unknown> {
  return {
    id: snapshot.id,
    status: snapshot.status,
    note: snapshot.note,
    from_podcast_index_id: snapshot.from_podcast_index_id,
    to_podcast_index_id: snapshot.to_podcast_index_id,
  };
}

function snapshotFromDetail(merge: FeedMergeDetail): FeedMergeAuditSnapshot {
  return {
    id: merge.id,
    status: merge.status,
    note: merge.note,
    from_podcast_index_id: merge.from_podcast_index_id,
    to_podcast_index_id: merge.to_podcast_index_id,
  };
}

function sendMergeError(res: Response, err: unknown, label: string): void {
  if (err instanceof MergeStatusConflictError) {
    res.status(409).json({ message: err.message });
    return;
  }
  console.error(label, err);
  res.status(500).json({ message: 'Internal server error' });
}

function readAdminId(req: Request, res: Response): number | null {
  const adminId = req.user?.id;
  if (!adminId) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }
  return adminId;
}

async function recordMergeAudit(
  req: Request,
  adminId: number,
  before: FeedMergeAuditSnapshot,
  merge: FeedMergeDetail
): Promise<void> {
  await auditLog.record({
    adminAccountId: adminId,
    operation: 'update',
    tableName: 'channel_merge',
    rowId: merge.id,
    beforeSnapshot: snapshotRecord(before),
    afterSnapshot: snapshotRecord(snapshotFromDetail(merge)),
    requestId: getAuditRequestId(req),
  });
}

function statusFilter(status: FeedMergeListStatus): FeedMergeDetail['status'] | null {
  if (status === 'all') {
    return null;
  }
  return status;
}

async function handleReviewPost(
  req: Request,
  res: Response,
  label: string,
  run: (id: number, note: string | null | undefined) => Promise<FeedMergeReviewUpdate | null>
): Promise<void> {
  const id = parseIdParam(req.params.id);
  if (id === null || id <= 0) {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }
  const { error, value } = feedMergeNoteBodySchema.validate(req.body ?? {}, {
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({ message: error.message });
    return;
  }
  const body: FeedMergeNoteBodyValidated | null = parseFeedMergeNoteBody(value);
  if (body === null) {
    res.status(400).json({ message: 'Invalid note' });
    return;
  }
  const adminId = readAdminId(req, res);
  if (adminId === null) {
    return;
  }
  try {
    const updated = await run(id, body.note);
    if (updated === null) {
      res.status(404).json({ message: 'Merge not found' });
      return;
    }
    await recordMergeAudit(req, adminId, updated.before, updated.merge);
    res.json({ merge: updated.merge });
  } catch (err) {
    sendMergeError(res, err, label);
  }
}

export function registerFeedMergeReviewRoutes(router: Router): void {
  router.get('/merges', ensureAuthenticated, requireCrud('feeds', 'read'), async (req, res) => {
    const { error, value } = feedMergeListQuerySchema.validate(req.query, {
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }
    const query = parseFeedMergeListQuery(value);
    if (query === null) {
      res.status(400).json({ message: 'Invalid query' });
      return;
    }
    try {
      const { merges, total } = await listFeedMerges({
        page: query.page,
        limit: query.limit,
        status: statusFilter(query.status),
      });
      const totalPages = Math.max(1, Math.ceil(total / query.limit));
      res.json({
        merges,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      });
    } catch (err) {
      console.error('[feeds/merges]', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  router.get(
    '/merges/:id',
    ensureAuthenticated,
    requireCrud('feeds', 'read'),
    async (req, res) => {
      const id = parseIdParam(req.params.id);
      if (id === null || id <= 0) {
        res.status(400).json({ message: 'Invalid id' });
        return;
      }
      try {
        const merge = await getFeedMerge(id);
        if (merge === null) {
          res.status(404).json({ message: 'Merge not found' });
          return;
        }
        res.json({ merge });
      } catch (err) {
        console.error('[feeds/merges/:id]', err);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  );

  router.post(
    '/merges/:id/approve',
    ensureAuthenticated,
    requireCrud('feeds', 'update'),
    async (req, res) => {
      await handleReviewPost(req, res, '[feeds/merges/approve]', approveChannelMerge);
    }
  );

  router.post(
    '/merges/:id/reject',
    ensureAuthenticated,
    requireCrud('feeds', 'update'),
    async (req, res) => {
      await handleReviewPost(req, res, '[feeds/merges/reject]', rejectChannelMerge);
    }
  );

  router.post(
    '/merges/:id/revert',
    ensureAuthenticated,
    requireCrud('feeds', 'update'),
    async (req, res) => {
      await handleReviewPost(req, res, '[feeds/merges/revert]', (id) =>
        revertAppliedChannelMerge(id)
      );
    }
  );
}
