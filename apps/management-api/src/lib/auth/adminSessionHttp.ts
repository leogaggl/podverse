import {
  endAdminSession,
  endAdminSessions,
  listAdminSessions,
} from '@management-api/lib/auth/adminSessionStore.js';
import { clearAuthCookie } from '@management-api/lib/auth/index.js';
import { getParamRequired } from '@management-api/lib/params.js';
import type { AdminSessionRow } from '@management-api/orm/services/adminSession.js';
import type { Request, Response } from 'express';

import type { DTOAccountSession } from '@podverse/helpers';
import { isValidNanoIdV2IdText } from '@podverse/orm';

const sessionNotFound = { message: 'Session not found' };

/** The signed-in admin, or a 401 when the request has none. */
function signedInAdmin(req: Request, res: Response): Express.User | undefined {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return undefined;
  }
  return user;
}

function toAdminSessionDto(row: AdminSessionRow, currentSessionIdText: string): DTOAccountSession {
  return {
    id_text: row.id_text,
    client_type: row.client_type,
    device_label: row.device_label,
    created_at: row.created_at.toISOString(),
    last_seen_at: row.last_seen_at.toISOString(),
    is_current: row.id_text === currentSessionIdText,
  };
}

export async function listAdminSessionsHttp(req: Request, res: Response): Promise<void> {
  const user = signedInAdmin(req, res);
  if (!user) {
    return;
  }
  const rows = await listAdminSessions(user.id);
  res.status(200).json({
    rows: rows.map((row) => toAdminSessionDto(row, user.session_id_text)),
  });
}

export async function revokeAdminSessionHttp(req: Request, res: Response): Promise<void> {
  const user = signedInAdmin(req, res);
  if (!user) {
    return;
  }
  const sessionIdText = getParamRequired(req, 'session_id_text');
  if (!isValidNanoIdV2IdText(sessionIdText)) {
    res.status(404).json(sessionNotFound);
    return;
  }

  if (sessionIdText === user.session_id_text) {
    await endAdminSession({
      adminAccountId: user.id,
      sessionIdText,
      reason: 'signed_out',
    });
    clearAuthCookie(res);
    res.status(200).json({ message: 'Logged out successfully' });
    return;
  }

  const ended = await endAdminSession({
    adminAccountId: user.id,
    sessionIdText,
    reason: 'signed_out_elsewhere',
  });
  if (!ended) {
    res.status(404).json(sessionNotFound);
    return;
  }
  res.status(200).json({ message: 'Session ended' });
}

export async function revokeOtherAdminSessionsHttp(req: Request, res: Response): Promise<void> {
  const user = signedInAdmin(req, res);
  if (!user) {
    return;
  }
  const revokedCount = await endAdminSessions({
    adminAccountId: user.id,
    reason: 'signed_out_elsewhere',
    exceptSessionIdText: user.session_id_text,
  });
  res.status(200).json({ revoked_count: revokedCount });
}
