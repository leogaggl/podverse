import { randomBytes } from 'node:crypto';

import { AppDataSourceReadWrite } from '@orm/db/index.js';
import { generateRandomIdText } from '@orm/lib/nanoid.js';

import type { ApiKeyPermissions } from '@podverse/helpers';
import {
  API_KEY_SECRET_BYTES,
  API_KEY_TOKEN_HINT_LENGTH,
  API_KEY_TOKEN_PREFIX,
  isApiKeyExpired,
  isApiKeyTokenFormat,
  normalizeApiKeyPermissions,
  sha256Hex,
} from '@podverse/helpers';

export type AccountApiKeyRow = {
  id: string;
  id_text: string;
  account_id: number;
  name: string;
  token_hint: string;
  permissions: ApiKeyPermissions;
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
};

export type AccountApiKeyStatus =
  { status: 'active'; apiKey: AccountApiKeyRow } | { status: 'expired' } | { status: 'missing' };

const API_KEY_COLUMNS = `id,
       id_text,
       account_id,
       name,
       token_hint,
       permissions,
       created_at,
       expires_at,
       last_used_at`;

/** Mints the token, stores its hash and hint, and returns the raw token once. */
export async function createAccountApiKey(input: {
  accountId: number;
  name: string;
  permissions: ApiKeyPermissions;
  expiresAt: Date | null;
}): Promise<{ apiKey: AccountApiKeyRow; token: string }> {
  const token = mintApiKeyToken();
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `INSERT INTO account_api_key (
       id_text,
       account_id,
       name,
       token_hash,
       token_hint,
       permissions,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING ${API_KEY_COLUMNS}`,
    [
      generateRandomIdText(),
      input.accountId,
      input.name.trim(),
      sha256Hex(token),
      token.slice(-API_KEY_TOKEN_HINT_LENGTH),
      JSON.stringify(normalizeApiKeyPermissions(input.permissions)),
      input.expiresAt,
    ]
  );
  const row = returnedRows(result)[0];
  if (row === undefined) {
    throw new Error('Account API key insert returned no row');
  }
  return { apiKey: readApiKeyRow(row), token };
}

/** The per-request check. A malformed token is `missing` without a query. */
export async function getAccountApiKeyStatus(input: {
  token: string;
  now: Date;
}): Promise<AccountApiKeyStatus> {
  if (!isApiKeyTokenFormat(input.token)) {
    return { status: 'missing' };
  }
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `SELECT ${API_KEY_COLUMNS}
       FROM account_api_key
      WHERE token_hash = $1`,
    [sha256Hex(input.token)]
  );
  const row = returnedRows(result)[0];
  if (row === undefined) {
    return { status: 'missing' };
  }
  const apiKey = readApiKeyRow(row);
  if (isApiKeyExpired(apiKey.expires_at, input.now)) {
    return { status: 'expired' };
  }
  return { status: 'active', apiKey };
}

/**
 * Sets last_used_at unless a later value is already stored. False when no row changed.
 * Does not change updated_at. That column tracks edits to the key, and a key has no edit path.
 */
export async function touchAccountApiKeyLastUsed(input: {
  apiKeyId: string;
  lastUsedAt: Date;
}): Promise<boolean> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `UPDATE account_api_key
        SET last_used_at = $2
      WHERE id = $1::bigint
        AND (last_used_at IS NULL OR last_used_at < $2)`,
    [input.apiKeyId, input.lastUsedAt]
  );
  return statementRowCount(result) > 0;
}

/** Every key of the account, expired ones included, newest first. */
export async function listAccountApiKeys(input: {
  accountId: number;
}): Promise<AccountApiKeyRow[]> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `SELECT ${API_KEY_COLUMNS}
       FROM account_api_key
      WHERE account_id = $1
      ORDER BY created_at DESC, id DESC`,
    [input.accountId]
  );
  return returnedRows(result).map(readApiKeyRow);
}

/** How many keys the account holds, expired ones included. */
export async function countAccountApiKeys(input: { accountId: number }): Promise<number> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `SELECT count(*)::int AS count
       FROM account_api_key
      WHERE account_id = $1`,
    [input.accountId]
  );
  return readCount(result);
}

/** Deletes one of the account's own keys. False when the account has no key with that id_text. */
export async function deleteAccountApiKey(input: {
  accountId: number;
  apiKeyIdText: string;
}): Promise<boolean> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `DELETE FROM account_api_key
      WHERE account_id = $1
        AND id_text = $2`,
    [input.accountId, input.apiKeyIdText]
  );
  return statementRowCount(result) > 0;
}

function mintApiKeyToken(): string {
  return `${API_KEY_TOKEN_PREFIX}${randomBytes(API_KEY_SECRET_BYTES).toString('base64url')}`;
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

function readCount(result: unknown): number {
  const row = returnedRows(result)[0];
  if (typeof row !== 'object' || row === null) {
    throw new Error('Account API key count is missing');
  }
  const count = Reflect.get(row, 'count');
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('Account API key count is not an integer');
  }
  return count;
}

function readApiKeyRow(value: unknown): AccountApiKeyRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Account API key row is not an object');
  }
  return {
    id: apiKeyId(Reflect.get(value, 'id')),
    id_text: requiredText(Reflect.get(value, 'id_text'), 'id_text'),
    account_id: apiKeyAccountId(Reflect.get(value, 'account_id')),
    name: requiredText(Reflect.get(value, 'name'), 'name'),
    token_hint: requiredText(Reflect.get(value, 'token_hint'), 'token_hint'),
    permissions: readPermissions(Reflect.get(value, 'permissions')),
    created_at: apiKeyTimestamp(Reflect.get(value, 'created_at'), 'created_at'),
    expires_at: nullableTimestamp(Reflect.get(value, 'expires_at'), 'expires_at'),
    last_used_at: nullableTimestamp(Reflect.get(value, 'last_used_at'), 'last_used_at'),
  };
}

function readPermissions(value: unknown): ApiKeyPermissions {
  if (value === undefined || value === null) {
    throw new Error('Account API key permissions are missing');
  }
  return normalizeApiKeyPermissions(jsonValue(value));
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    throw new Error('Account API key permissions are not JSON');
  }
}

function apiKeyId(value: unknown): string {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  throw new Error('Account API key id is missing');
}

function apiKeyAccountId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error('Account API key account_id is not an integer');
}

function requiredText(value: unknown, column: string): string {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  throw new Error(`Account API key ${column} is missing`);
}

function nullableTimestamp(value: unknown, column: string): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return apiKeyTimestamp(value, column);
}

function apiKeyTimestamp(value: unknown, column: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new Error(`Account API key ${column} is not a timestamp`);
}
