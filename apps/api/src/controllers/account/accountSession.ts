import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import {
  endAccountSession,
  endAccountSessions,
  listAccountSessions,
} from '@api/lib/auth/accountSessionStore.js';
import { clearAuthCookie, ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { getParamRequired } from '@api/lib/params.js';
import type { Request, Response } from 'express';

import type { DTOAccountSession } from '@podverse/helpers';
import type { AccountSessionRow } from '@podverse/orm';
import { isValidNanoIdV2IdText } from '@podverse/orm';

const sessionNotFound = { message: 'Session not found' };

function toAccountSessionDto(
  row: AccountSessionRow,
  currentSessionIdText: string
): DTOAccountSession {
  return {
    id_text: row.id_text,
    client_type: row.client_type,
    device_label: row.device_label,
    created_at: row.created_at.toISOString(),
    last_seen_at: row.last_seen_at.toISOString(),
    is_current: row.id_text === currentSessionIdText,
  };
}

export class AccountSessionController {
  static async list(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const user = getAuthenticatedUser(req);
          const rows = await listAccountSessions(user.id);
          res.status(200).json({
            rows: rows.map((row) => toAccountSessionDto(row, user.session_id_text)),
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      { skipMembershipStatus: true, skipTermsAcceptance: true }
    );
  }

  static async revoke(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const user = getAuthenticatedUser(req);
          const sessionIdText = getParamRequired(req, 'session_id_text');
          if (!isValidNanoIdV2IdText(sessionIdText)) {
            res.status(404).json(sessionNotFound);
            return;
          }

          if (sessionIdText === user.session_id_text) {
            await endAccountSession({
              accountId: user.id,
              sessionIdText,
              reason: 'signed_out',
            });
            clearAuthCookie(res);
            res.status(200).json({ message: 'Signed out' });
            return;
          }

          const ended = await endAccountSession({
            accountId: user.id,
            sessionIdText,
            reason: 'signed_out_elsewhere',
          });
          if (!ended) {
            res.status(404).json(sessionNotFound);
            return;
          }
          res.status(200).json({ message: 'Session ended' });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      { skipMembershipStatus: true, skipTermsAcceptance: true }
    );
  }

  static async revokeOthers(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const user = getAuthenticatedUser(req);
          const revokedCount = await endAccountSessions({
            accountId: user.id,
            reason: 'signed_out_elsewhere',
            exceptSessionIdText: user.session_id_text,
          });
          res.status(200).json({ revoked_count: revokedCount });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      { skipMembershipStatus: true, skipTermsAcceptance: true }
    );
  }
}
