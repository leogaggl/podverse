import { ensureAuthenticated } from '@management-api/lib/auth/index.js';
import { requireCrud } from '@management-api/lib/authz/requireCrud.js';
import { AuditLogService } from '@management-api/lib/database/auditLog.js';
import { getAuditRequestId } from '@management-api/lib/getAuditRequestId.js';
import { getParam } from '@management-api/lib/params.js';
import type { StatsFlaggedListenerRow } from '@management-api/lib/stats/flaggedListeners.js';
import {
  clearFlaggedListener,
  listFlaggedListeners,
} from '@management-api/lib/stats/flaggedListeners.js';
import {
  parseStatsFlaggedListenerListQuery,
  statsFlaggedListenerListQuerySchema,
} from '@management-api/schemas/statsFlaggedListeners.js';
import type { Request, Response, Router } from 'express';

const auditLog = new AuditLogService();

function parsePositiveId(raw: string | undefined): number | null {
  if (raw === undefined || !/^[1-9][0-9]*$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) {
    return null;
  }
  return id;
}

function readAdminId(req: Request, res: Response): number | null {
  const adminId = req.user?.id;
  if (!adminId) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }
  return adminId;
}

function flagAuditSnapshot(row: StatsFlaggedListenerRow): Record<string, unknown> {
  return {
    id: row.id,
    reason: row.reason,
    flagged_at: row.flagged_at,
    times_flagged: row.times_flagged,
    cleared_at: row.cleared_at,
    cleared_by_admin_id: row.cleared_by_admin_id,
  };
}

export function registerStatsFlaggedListenerRoutes(router: Router): void {
  router.get(
    '/flagged-listeners',
    ensureAuthenticated,
    requireCrud('stats', 'read'),
    async (req, res): Promise<void> => {
      const { error, value } = statsFlaggedListenerListQuerySchema.validate(req.query, {
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        res.status(400).json({ message: error.message });
        return;
      }
      const query = parseStatsFlaggedListenerListQuery(value);
      if (query === null) {
        res.status(400).json({ message: 'Invalid query' });
        return;
      }
      try {
        const { rows, total } = await listFlaggedListeners(query);
        res.json({ rows, total, page: query.page, pageSize: query.limit });
      } catch (err) {
        console.error('[stats/flagged-listeners]', err);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  );

  router.post(
    '/flagged-listeners/:id/clear',
    ensureAuthenticated,
    requireCrud('stats', 'update'),
    async (req, res): Promise<void> => {
      const id = parsePositiveId(getParam(req, 'id'));
      if (id === null) {
        res.status(400).json({ message: 'Invalid id' });
        return;
      }
      const adminId = readAdminId(req, res);
      if (adminId === null) {
        return;
      }
      try {
        const result = await clearFlaggedListener(id, adminId);
        if (result.kind === 'not_found') {
          res.status(404).json({ message: 'Flagged listener not found' });
          return;
        }
        if (result.kind === 'already_cleared') {
          res.status(409).json({ message: 'Flag already cleared' });
          return;
        }
        await auditLog.record({
          adminAccountId: adminId,
          operation: 'update',
          tableName: 'stats_flagged_listener',
          rowId: id,
          beforeSnapshot: flagAuditSnapshot(result.before),
          afterSnapshot: flagAuditSnapshot(result.row),
          requestId: getAuditRequestId(req),
        });
        res.json({ row: result.row });
      } catch (err) {
        console.error('[stats/flagged-listeners/:id/clear]', err);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  );
}
