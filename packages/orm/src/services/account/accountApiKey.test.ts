import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_KEY_TOKEN_HINT_LENGTH,
  CRUD_BITS,
  emptyApiKeyPermissions,
  isApiKeyTokenFormat,
  sha256Hex,
} from '@podverse/helpers';

const { query } = vi.hoisted(() => ({
  query: vi.fn(async (_sql: string, _parameters?: readonly unknown[]): Promise<unknown> => []),
}));

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceReadWrite: {
    manager: { query },
  },
}));

import {
  countAccountApiKeys,
  createAccountApiKey,
  deleteAccountApiKey,
  getAccountApiKeyStatus,
  listAccountApiKeys,
  touchAccountApiKeyLastUsed,
} from './accountApiKey.js';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const LATER = new Date('2027-10-22T12:00:00.000Z');
const EARLIER = new Date('2026-10-01T12:00:00.000Z');
const TOKEN = `pvk_${'A'.repeat(43)}`;

function apiKeyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '41',
    id_text: 'key1234567',
    account_id: 7,
    name: 'CI bot',
    token_hint: 'AAAA',
    permissions: emptyApiKeyPermissions(),
    created_at: EARLIER,
    expires_at: null,
    last_used_at: null,
    ...overrides,
  };
}

function paramsOf(callIndex: number): readonly unknown[] {
  const params = query.mock.calls[callIndex]?.[1];
  return Array.isArray(params) ? params : [];
}

function sqlOf(callIndex: number): string {
  return String(query.mock.calls[callIndex]?.[0]);
}

function expectTokenAbsent(token: string, parameters: readonly unknown[], sql: string) {
  expect(sql.includes(token)).toBe(false);
  for (const parameter of parameters) {
    if (typeof parameter === 'string') {
      expect(parameter.includes(token)).toBe(false);
    }
  }
}

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue([]);
});

describe('createAccountApiKey', () => {
  it('stores the hash and hint, trims the name, and normalizes permissions', async () => {
    query.mockResolvedValue([apiKeyRow()]);
    const permissions = emptyApiKeyPermissions();
    permissions.playlists = CRUD_BITS.read;
    Reflect.deleteProperty(permissions, 'clips');
    Reflect.set(permissions, 'mystery', CRUD_BITS.delete);

    const result = await createAccountApiKey({
      accountId: 7,
      name: '  CI bot  ',
      permissions,
      expiresAt: LATER,
    });

    const parameters = paramsOf(0);
    const storedPermissions = parameters[5];
    expect(isApiKeyTokenFormat(result.token)).toBe(true);
    expect(parameters[2]).toBe('CI bot');
    expect(parameters[3]).toBe(sha256Hex(result.token));
    expect(parameters[4]).toBe(result.token.slice(-API_KEY_TOKEN_HINT_LENGTH));
    expectTokenAbsent(result.token, parameters, sqlOf(0));
    expect(sqlOf(0)).toContain('$6::jsonb');
    expect(typeof storedPermissions).toBe('string');
    if (typeof storedPermissions !== 'string') {
      return;
    }
    const parsed: unknown = JSON.parse(storedPermissions);
    expect(parsed).toEqual({
      ...emptyApiKeyPermissions(),
      playlists: CRUD_BITS.read,
    });
  });
});

describe('getAccountApiKeyStatus', () => {
  it('returns missing for a malformed token without querying', async () => {
    const status = await getAccountApiKeyStatus({ token: 'not-a-key', now: NOW });

    expect(status).toEqual({ status: 'missing' });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns missing when no row matches, and looks the key up by its hash', async () => {
    query.mockResolvedValue([]);

    const status = await getAccountApiKeyStatus({ token: TOKEN, now: NOW });

    expect(status).toEqual({ status: 'missing' });
    expect(paramsOf(0)).toEqual([sha256Hex(TOKEN)]);
    expectTokenAbsent(TOKEN, paramsOf(0), sqlOf(0));
  });

  it('returns expired when the expiry is past and active when there is no expiry', async () => {
    query.mockResolvedValueOnce([apiKeyRow({ expires_at: EARLIER })]);
    query.mockResolvedValueOnce([apiKeyRow({ expires_at: null })]);

    const expired = await getAccountApiKeyStatus({ token: TOKEN, now: NOW });
    const active = await getAccountApiKeyStatus({ token: TOKEN, now: NOW });

    expect(expired).toEqual({ status: 'expired' });
    expect(active).toEqual({
      status: 'active',
      apiKey: {
        id: '41',
        id_text: 'key1234567',
        account_id: 7,
        name: 'CI bot',
        token_hint: 'AAAA',
        permissions: emptyApiKeyPermissions(),
        created_at: EARLIER,
        expires_at: null,
        last_used_at: null,
      },
    });
    expect(paramsOf(0)).toEqual([sha256Hex(TOKEN)]);
    expect(paramsOf(1)).toEqual([sha256Hex(TOKEN)]);
  });
});

describe('touchAccountApiKeyLastUsed', () => {
  it('returns false when the row count is 0 and does not write updated_at', async () => {
    query.mockResolvedValue([[], 0]);

    const changed = await touchAccountApiKeyLastUsed({ apiKeyId: '41', lastUsedAt: NOW });

    expect(changed).toBe(false);
    expect(sqlOf(0)).toContain('SET last_used_at = $2');
    expect(sqlOf(0)).toContain('id = $1::bigint');
    expect(sqlOf(0)).toContain('last_used_at IS NULL OR last_used_at < $2');
    expect(sqlOf(0)).not.toContain('updated_at');
  });
});

describe('deleteAccountApiKey', () => {
  it('scopes the delete by account_id', async () => {
    query.mockResolvedValueOnce([[], 1]);
    query.mockResolvedValueOnce([[], 0]);

    const deleted = await deleteAccountApiKey({ accountId: 7, apiKeyIdText: 'key1234567' });
    const missing = await deleteAccountApiKey({ accountId: 8, apiKeyIdText: 'key1234567' });

    expect(deleted).toBe(true);
    expect(missing).toBe(false);
    expect(sqlOf(0)).toContain('account_id = $1');
    expect(sqlOf(0)).toContain('id_text = $2');
    expect(paramsOf(0)).toEqual([7, 'key1234567']);
    expect(paramsOf(1)).toEqual([8, 'key1234567']);
  });
});

describe('listAccountApiKeys and countAccountApiKeys', () => {
  it('lists newest first and reads the integer count', async () => {
    query.mockResolvedValueOnce([apiKeyRow(), apiKeyRow({ id: '40', name: 'Older' })]);
    query.mockResolvedValueOnce([{ count: 2 }]);

    const rows = await listAccountApiKeys({ accountId: 7 });
    const count = await countAccountApiKeys({ accountId: 7 });

    expect(sqlOf(0)).toContain('ORDER BY created_at DESC, id DESC');
    expect(rows.map((row) => row.id)).toEqual(['41', '40']);
    expect(paramsOf(1)).toEqual([7]);
    expect(count).toBe(2);
  });
});
