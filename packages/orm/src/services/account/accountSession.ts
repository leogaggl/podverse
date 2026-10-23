import { randomBytes, timingSafeEqual } from 'node:crypto';

import { AppDataSourceReadWrite } from '@orm/db/index.js';
import { generateRandomIdText } from '@orm/lib/nanoid.js';

import type { AccountSessionClientType, AccountSessionRevokeReason } from '@podverse/helpers';
import {
  DATABASE_CONSTANTS,
  isAccountSessionClientType,
  isAccountSessionRevokeReason,
  sha256Hex,
} from '@podverse/helpers';

/** Raw SQL. Call sites narrow the rows; the signature does not invent a row type. */
type SessionQuery = {
  query: (sql: string, parameters?: readonly unknown[]) => Promise<unknown>;
};

const REFRESH_TOKEN_ID_BYTES = 32;

export type AccountSessionRow = {
  id: string;
  id_text: string;
  account_id: number;
  client_type: AccountSessionClientType;
  device_label: string | null;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
};

export type AccountSessionStatus =
  | { status: 'active'; session: AccountSessionRow }
  | { status: 'revoked'; reason: AccountSessionRevokeReason }
  | { status: 'expired' }
  | { status: 'missing' };

export type AccountSessionRotateResult =
  | { outcome: 'rotated'; refreshTokenId: string; session: AccountSessionRow }
  | { outcome: 'reused' }
  | { outcome: 'revoked'; reason: AccountSessionRevokeReason }
  | { outcome: 'expired' }
  | { outcome: 'missing' };

const SESSION_COLUMNS = `id,
       id_text,
       account_id,
       client_type,
       device_label,
       created_at,
       last_seen_at,
       idle_expires_at`;

const SESSION_STATE_COLUMNS = `${SESSION_COLUMNS},
       refresh_token_hash,
       previous_refresh_token_hash,
       revoked_reason`;

/**
 * Inserts a session for one login. With `withRefreshToken`, mints the first refresh token id and
 * stores only its hash; the raw id is returned once and never stored.
 */
export async function createAccountSession(input: {
  accountId: number;
  clientType: AccountSessionClientType;
  deviceLabel: string | null;
  idleExpiresAt: Date;
  withRefreshToken: boolean;
}): Promise<{ session: AccountSessionRow; refreshTokenId: string | null }> {
  const refreshTokenId = input.withRefreshToken ? mintRefreshTokenId() : null;
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `INSERT INTO account_session (
       id_text,
       account_id,
       client_type,
       device_label,
       idle_expires_at,
       refresh_token_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SESSION_COLUMNS}`,
    [
      generateRandomIdText(),
      input.accountId,
      input.clientType,
      normalizeDeviceLabel(input.deviceLabel),
      input.idleExpiresAt,
      refreshTokenId === null ? null : sha256Hex(refreshTokenId),
    ]
  );
  const row = returnedRows(result)[0];
  if (row === undefined) {
    throw new Error('Account session insert returned no row');
  }
  return { session: readSessionRow(row), refreshTokenId };
}

/**
 * The per-request session check. A row on another account is `missing`. A revoked row reports
 * its reason even past `idle_expires_at`, so a device that returns late still learns why.
 */
export async function getAccountSessionStatus(input: {
  sessionIdText: string;
  accountId: number;
  now: Date;
}): Promise<AccountSessionStatus> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `SELECT ${SESSION_STATE_COLUMNS}
       FROM account_session
      WHERE id_text = $1`,
    [input.sessionIdText]
  );
  const row = returnedRows(result)[0];
  if (row === undefined) {
    return { status: 'missing' };
  }
  const state = readSessionState(row);
  if (state.session.account_id !== input.accountId) {
    return { status: 'missing' };
  }
  if (state.revokedReason !== null) {
    return { status: 'revoked', reason: state.revokedReason };
  }
  if (state.session.idle_expires_at.getTime() <= input.now.getTime()) {
    return { status: 'expired' };
  }
  return { status: 'active', session: state.session };
}

/**
 * Renews a session's last use and idle expiry. False when the row is revoked or already past its
 * idle expiry at `lastSeenAt`, so a renewal never revives an ended session.
 */
export async function touchAccountSession(input: {
  sessionId: string;
  lastSeenAt: Date;
  idleExpiresAt: Date;
}): Promise<boolean> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `UPDATE account_session
        SET last_seen_at = $2,
            idle_expires_at = $3,
            updated_at = now()
      WHERE id = $1::bigint
        AND revoked_at IS NULL
        AND idle_expires_at > $2`,
    [input.sessionId, input.lastSeenAt, input.idleExpiresAt]
  );
  return statementRowCount(result) > 0;
}

/**
 * Exchanges a presented refresh token id for a new one under a row lock.
 *
 * The row keeps two hashes: current (the id last handed out) and previous (the id last presented
 * successfully). Presenting current moves it to previous; presenting previous replaces current
 * and keeps previous, so a client that never received the last response recovers at any delay.
 * Any other id is read as a shared token and revokes the session with `refresh_reuse`.
 */
export async function rotateAccountSessionRefreshToken(input: {
  sessionIdText: string;
  accountId: number;
  presentedTokenId: string;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  now: Date;
}): Promise<AccountSessionRotateResult> {
  return AppDataSourceReadWrite.transaction((manager) => rotateWithinTransaction(manager, input));
}

async function rotateWithinTransaction(
  manager: SessionQuery,
  input: {
    sessionIdText: string;
    accountId: number;
    presentedTokenId: string;
    lastSeenAt: Date;
    idleExpiresAt: Date;
    now: Date;
  }
): Promise<AccountSessionRotateResult> {
  const locked: unknown = await manager.query(
    `SELECT ${SESSION_STATE_COLUMNS}
       FROM account_session
      WHERE id_text = $1
      FOR UPDATE`,
    [input.sessionIdText]
  );
  const row = returnedRows(locked)[0];
  if (row === undefined) {
    return { outcome: 'missing' };
  }
  const state = readSessionState(row);
  if (state.session.account_id !== input.accountId) {
    return { outcome: 'missing' };
  }
  if (state.revokedReason !== null) {
    return { outcome: 'revoked', reason: state.revokedReason };
  }
  if (state.session.idle_expires_at.getTime() <= input.now.getTime()) {
    return { outcome: 'expired' };
  }

  const presentedHash = sha256Hex(input.presentedTokenId);
  const matchesCurrent = hashesEqual(presentedHash, state.refreshTokenHash);
  const matchesPrevious =
    !matchesCurrent && hashesEqual(presentedHash, state.previousRefreshTokenHash);

  if (!matchesCurrent && !matchesPrevious) {
    await manager.query(
      `UPDATE account_session
          SET revoked_at = $2,
              revoked_reason = 'refresh_reuse',
              updated_at = now()
        WHERE id = $1::bigint
          AND revoked_at IS NULL`,
      [state.session.id, input.now]
    );
    return { outcome: 'reused' };
  }

  const refreshTokenId = mintRefreshTokenId();
  const previousHash = matchesCurrent ? state.refreshTokenHash : state.previousRefreshTokenHash;
  const updated: unknown = await manager.query(
    `UPDATE account_session
        SET refresh_token_hash = $2,
            previous_refresh_token_hash = $3,
            last_seen_at = $4,
            idle_expires_at = $5,
            updated_at = now()
      WHERE id = $1::bigint
      RETURNING ${SESSION_COLUMNS}`,
    [
      state.session.id,
      sha256Hex(refreshTokenId),
      previousHash,
      input.lastSeenAt,
      input.idleExpiresAt,
    ]
  );
  const updatedRow = returnedRows(updated)[0];
  if (updatedRow === undefined) {
    throw new Error('Account session rotation updated no row');
  }
  return { outcome: 'rotated', refreshTokenId, session: readSessionRow(updatedRow) };
}

/**
 * Ends one of the account's own sessions. True only when an active row changed; a row that is
 * already revoked keeps its first reason.
 */
export async function revokeAccountSession(input: {
  accountId: number;
  sessionIdText: string;
  reason: AccountSessionRevokeReason;
  now: Date;
}): Promise<boolean> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `UPDATE account_session
        SET revoked_at = $4,
            revoked_reason = $3,
            updated_at = now()
      WHERE id_text = $1
        AND account_id = $2
        AND revoked_at IS NULL
        AND idle_expires_at > $4`,
    [input.sessionIdText, input.accountId, input.reason, input.now]
  );
  return statementRowCount(result) > 0;
}

/**
 * Ends every active session on the account. `exceptSessionIdText` keeps the caller's own session;
 * null ends all of them. Returns the number of rows changed.
 */
export async function revokeAccountSessions(input: {
  accountId: number;
  reason: AccountSessionRevokeReason;
  exceptSessionIdText: string | null;
  now: Date;
}): Promise<number> {
  const baseSql = `UPDATE account_session
        SET revoked_at = $3,
            revoked_reason = $2,
            updated_at = now()
      WHERE account_id = $1
        AND revoked_at IS NULL
        AND idle_expires_at > $3`;
  const result: unknown =
    input.exceptSessionIdText === null
      ? await AppDataSourceReadWrite.manager.query(baseSql, [
          input.accountId,
          input.reason,
          input.now,
        ])
      : await AppDataSourceReadWrite.manager.query(`${baseSql}\n        AND id_text <> $4`, [
          input.accountId,
          input.reason,
          input.now,
          input.exceptSessionIdText,
        ]);
  return statementRowCount(result);
}

/** Sessions that are neither revoked nor idle-expired, most recently used first. */
export async function listActiveAccountSessions(input: {
  accountId: number;
  now: Date;
}): Promise<AccountSessionRow[]> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `SELECT ${SESSION_COLUMNS}
       FROM account_session
      WHERE account_id = $1
        AND revoked_at IS NULL
        AND idle_expires_at > $2
      ORDER BY last_seen_at DESC, id DESC`,
    [input.accountId, input.now]
  );
  return returnedRows(result).map(readSessionRow);
}

/** Deletes every row, revoked or not, whose idle expiry is before `cutoff`. */
export async function deleteAccountSessionsIdleExpiredBefore(cutoff: Date): Promise<number> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `DELETE FROM account_session WHERE idle_expires_at < $1`,
    [cutoff]
  );
  return statementRowCount(result);
}

function mintRefreshTokenId(): string {
  return randomBytes(REFRESH_TOKEN_ID_BYTES).toString('base64url');
}

function hashesEqual(presentedHash: string, storedHash: string | null): boolean {
  if (storedHash === null || storedHash.length !== presentedHash.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(presentedHash), Buffer.from(storedHash));
}

function normalizeDeviceLabel(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim().slice(0, DATABASE_CONSTANTS.varchar_normal).trim();
  return trimmed === '' ? null : trimmed;
}

/** SELECT and INSERT return the rows; UPDATE and DELETE return `[rows, rowCount]`. */
function returnedRows(result: unknown): unknown[] {
  if (!Array.isArray(result)) {
    return [];
  }
  if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0];
  }
  return result;
}

function statementRowCount(result: unknown): number {
  if (Array.isArray(result)) {
    const count = result[1];
    if (typeof count === 'number' && Number.isFinite(count)) {
      return count;
    }
  }
  if (typeof result === 'object' && result !== null) {
    const rowCount = Reflect.get(result, 'rowCount');
    if (typeof rowCount === 'number' && Number.isFinite(rowCount)) {
      return rowCount;
    }
  }
  return 0;
}

function readSessionState(value: unknown): {
  session: AccountSessionRow;
  refreshTokenHash: string | null;
  previousRefreshTokenHash: string | null;
  revokedReason: AccountSessionRevokeReason | null;
} {
  const session = readSessionRow(value);
  if (typeof value !== 'object' || value === null) {
    throw new Error('Account session row is not an object');
  }
  return {
    session,
    refreshTokenHash: nullableText(Reflect.get(value, 'refresh_token_hash'), 'refresh_token_hash'),
    previousRefreshTokenHash: nullableText(
      Reflect.get(value, 'previous_refresh_token_hash'),
      'previous_refresh_token_hash'
    ),
    revokedReason: sessionRevokedReason(Reflect.get(value, 'revoked_reason')),
  };
}

function readSessionRow(value: unknown): AccountSessionRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Account session row is not an object');
  }
  const idText = Reflect.get(value, 'id_text');
  if (typeof idText !== 'string' || idText === '') {
    throw new Error('Account session id_text is missing');
  }
  const clientType = Reflect.get(value, 'client_type');
  if (!isAccountSessionClientType(clientType)) {
    throw new Error('Account session client_type is not a known value');
  }
  return {
    id: sessionId(Reflect.get(value, 'id')),
    id_text: idText,
    account_id: sessionAccountId(Reflect.get(value, 'account_id')),
    client_type: clientType,
    device_label: nullableText(Reflect.get(value, 'device_label'), 'device_label'),
    created_at: sessionTimestamp(Reflect.get(value, 'created_at'), 'created_at'),
    last_seen_at: sessionTimestamp(Reflect.get(value, 'last_seen_at'), 'last_seen_at'),
    idle_expires_at: sessionTimestamp(Reflect.get(value, 'idle_expires_at'), 'idle_expires_at'),
  };
}

function sessionId(value: unknown): string {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  throw new Error('Account session id is missing');
}

function sessionAccountId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error('Account session account_id is not an integer');
}

function nullableText(value: unknown, column: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Account session ${column} is not text`);
}

function sessionRevokedReason(value: unknown): AccountSessionRevokeReason | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (isAccountSessionRevokeReason(value)) {
    return value;
  }
  throw new Error('Account session revoked_reason is not a known value');
}

function sessionTimestamp(value: unknown, column: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new Error(`Account session ${column} is not a timestamp`);
}
