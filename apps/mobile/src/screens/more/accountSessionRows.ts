import type { AccountSessionClientType, DTOAccountSession } from '@podverse/helpers';

export type AccountSessionRow = {
  idText: string;
  isCurrent: boolean;
  /** Device label, or null when the session has none (caller shows the client fallback). */
  deviceLabel: string | null;
  clientType: AccountSessionClientType;
  lastSeenAt: string;
};

const toRow = (session: DTOAccountSession): AccountSessionRow => ({
  clientType: session.client_type,
  deviceLabel:
    session.device_label === null || session.device_label === '' ? null : session.device_label,
  idText: session.id_text,
  isCurrent: session.is_current,
  lastSeenAt: session.last_seen_at,
});

/** The current session first, then the rest in server order (most recently used first). */
export const toAccountSessionRows = (
  sessions: readonly DTOAccountSession[]
): AccountSessionRow[] => {
  const rows = sessions.map(toRow);
  const currentIndex = rows.findIndex((row) => row.isCurrent);
  if (currentIndex <= 0) {
    return rows;
  }
  const current = rows[currentIndex];
  if (current === undefined) {
    return rows;
  }
  return [current, ...rows.slice(0, currentIndex), ...rows.slice(currentIndex + 1)];
};

export const withoutAccountSession = (
  rows: readonly AccountSessionRow[],
  idText: string
): AccountSessionRow[] => rows.filter((row) => row.idText !== idText);

export const onlyCurrentAccountSession = (
  rows: readonly AccountSessionRow[]
): AccountSessionRow[] => rows.filter((row) => row.isCurrent);
