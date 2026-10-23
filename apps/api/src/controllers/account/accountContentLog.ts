import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { validateQueryObject } from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import { listAccountContentLogs } from '@podverse/orm';

const contentLogQuerySchema = Joi.object({
  type: Joi.string().valid('removed_content').required(),
});

export class AccountContentLogController {
  static async list(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        validateQueryObject(contentLogQuerySchema, req, res, async () => {
          try {
            const account = getAuthenticatedUser(req);
            const rows = await listAccountContentLogs(account.id, 'removed_content');
            res.status(200).json({ rows });
          } catch (error) {
            handleGenericErrorResponse(res, error);
          }
        });
      },
      {
        skipMembershipStatus: true,
        apiKeyAccess: { resource: 'history', action: 'read' },
      }
    );
  }
}
