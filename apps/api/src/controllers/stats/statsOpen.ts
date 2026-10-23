import { config } from '@api/config/index.js';
import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import {
  POPULARITY_TRACKING_NOT_ALLOWED_BODY,
  STATS_TARGET_NOT_FOUND_BODY,
} from '@api/controllers/stats/statsListen.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { assertListenStatsAllowed, ListenStatsOptedOutError } from '@api/lib/legal/listenStats.js';
import { validateBodyObject } from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import type { PopularityOpenResult } from '@podverse/helpers';
import { ACCOUNT_ENTITLEMENT_CAPABILITY } from '@podverse/helpers';
import type { StatsOpenTarget } from '@podverse/orm';
import { StatsOpenWriteService } from '@podverse/orm';

type StatsOpenBody =
  | { account_id_text: string; playlist_id_text?: undefined }
  | { playlist_id_text: string; account_id_text?: undefined };

const bodySchema = Joi.object({
  account_id_text: Joi.string(),
  playlist_id_text: Joi.string(),
}).xor('account_id_text', 'playlist_id_text');

function openTarget(body: StatsOpenBody): StatsOpenTarget {
  if (body.playlist_id_text !== undefined) {
    return { kind: 'playlist', id_text: body.playlist_id_text };
  }
  return { kind: 'account', id_text: body.account_id_text };
}

function openResponse(result: PopularityOpenResult): { status: number; body: object } {
  switch (result) {
    case 'counted':
      return { status: 201, body: { result } };
    case 'unchanged':
    case 'own_content':
      return { status: 200, body: { result } };
    case 'not_allowed':
      return { status: 403, body: POPULARITY_TRACKING_NOT_ALLOWED_BODY };
    case 'not_found':
      return { status: 404, body: STATS_TARGET_NOT_FOUND_BODY };
  }
}

export class StatsOpenController {
  private static statsOpenWriteService = new StatsOpenWriteService();

  /** Records a profile or playlist open. Opens count toward popularity only, never taste. */
  static async create(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        validateBodyObject(bodySchema, req, res, async () => {
          const jwtUser = getAuthenticatedUser(req);
          const body: StatsOpenBody = req.body;

          try {
            await assertListenStatsAllowed(jwtUser.id);
            const result = await StatsOpenController.statsOpenWriteService.recordOpen({
              account_id: jwtUser.id,
              agreement_version: config.popularityTracking.version,
              target: openTarget(body),
            });
            const response = openResponse(result);
            res.status(response.status).json(response.body);
          } catch (error) {
            if (error instanceof ListenStatsOptedOutError) {
              res.status(403).json(POPULARITY_TRACKING_NOT_ALLOWED_BODY);
              return;
            }
            handleGenericErrorResponse(res, error);
          }
        });
      },
      { skipMembershipStatus: false, requiredCapability: ACCOUNT_ENTITLEMENT_CAPABILITY.trackStats }
    );
  }
}
