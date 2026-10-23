import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import {
  closeAccountEventStream,
  getAccountEventStreamAdmission,
  openAccountEventStream,
} from '@api/lib/accountEventStream/accountEventStreamHub.js';
import { parseSseLastEventId } from '@api/lib/accountEventStream/sseWire.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import type { Request, Response } from 'express';

import { ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM } from '@podverse/helpers';
import { AccountService } from '@podverse/orm';

/** The `Last-Event-ID` header wins; the query param covers clients that cannot set headers. */
const getLastEventId = (req: Request): number | null => {
  const header = req.get('Last-Event-ID');
  if (header !== undefined && header !== '') {
    return parseSseLastEventId(header);
  }
  return parseSseLastEventId(req.query[ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM]);
};

/**
 * The account's one event stream. Auth, terms, and stream-limit failures answer with JSON before
 * any stream bytes; clients treat 401 and 403 as final and stop reconnecting. Membership is not
 * required, so an expired account still gets live read sync across its devices.
 */
export class AccountEventStreamController {
  private static accountService = new AccountService();

  static async stream(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const account_id = jwtUser.id;
          const lastEventId = getLastEventId(req);

          const account = await AccountEventStreamController.accountService.get(account_id);
          if (!account) {
            res.status(404).json({ message: 'Account not found' });
            return;
          }

          const admission = getAccountEventStreamAdmission(account_id);
          if (admission === 'limit') {
            res.status(429).json({
              message: 'Too many open account event streams.',
              code: 'account_event_stream_limit',
            });
            return;
          }
          if (admission === 'closed') {
            res.status(503).json({ message: 'The server is shutting down.' });
            return;
          }

          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders();
          req.socket.setNoDelay(true);
          req.socket.setKeepAlive(true);

          const stream = openAccountEventStream({
            account_id,
            response: res,
            cutoff: account.notifications_last_read_at ?? null,
            lastEventId,
            tokenExpiresAt: jwtUser.token_expires_at,
          });
          req.on('close', () => {
            closeAccountEventStream(stream);
          });
        } catch (error) {
          if (res.headersSent) {
            res.end();
            return;
          }
          handleGenericErrorResponse(res, error);
        }
      },
      { skipMembershipStatus: true }
    );
  }
}
