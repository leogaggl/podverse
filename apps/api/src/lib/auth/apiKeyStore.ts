import { loggerService } from '@api/factories/loggerService.js';

import type { ApiKeyExpirationDays, ApiKeyPermissions } from '@podverse/helpers';
import {
  API_KEY_ERROR_CODES,
  API_KEY_LAST_USED_INTERVAL_MS,
  apiKeyExpiresAt,
} from '@podverse/helpers';
import type { AccountApiKeyRow } from '@podverse/orm';
import {
  countAccountApiKeys,
  createAccountApiKey,
  deleteAccountApiKey,
  getAccountApiKeyStatus,
  listAccountApiKeys,
  touchAccountApiKeyLastUsed,
} from '@podverse/orm';

/**
 * Every API path that checks an API key, records its use, or creates, lists, or revokes one goes
 * through this module. It owns the clock and the last-used interval, so a key's use is written at
 * most once per API_KEY_LAST_USED_INTERVAL_MS rather than on every request.
 */

export type ApiKeyCheck =
  | { kind: 'active'; apiKey: AccountApiKeyRow; lastUsedDue: boolean }
  | {
      kind: 'rejected';
      code: typeof API_KEY_ERROR_CODES.invalid | typeof API_KEY_ERROR_CODES.expired;
    };

/** Unknown, malformed, and revoked keys are `invalid`; a key past its expiry is `expired`. */
export async function checkApiKey(token: string): Promise<ApiKeyCheck> {
  const now = new Date();
  const status = await getAccountApiKeyStatus({ token, now });
  switch (status.status) {
    case 'active': {
      const lastUsedAt = status.apiKey.last_used_at;
      return {
        kind: 'active',
        apiKey: status.apiKey,
        lastUsedDue:
          lastUsedAt === null ||
          now.getTime() - lastUsedAt.getTime() >= API_KEY_LAST_USED_INTERVAL_MS,
      };
    }
    case 'expired':
      return { kind: 'rejected', code: API_KEY_ERROR_CODES.expired };
    case 'missing':
      return { kind: 'rejected', code: API_KEY_ERROR_CODES.invalid };
  }
}

/** Never throws; a failed write is logged with the key's id_text. */
export async function recordApiKeyUse(apiKey: AccountApiKeyRow): Promise<void> {
  try {
    await touchAccountApiKeyLastUsed({ apiKeyId: apiKey.id, lastUsedAt: new Date() });
  } catch (error) {
    loggerService.logError(`Failed to record use of API key ${apiKey.id_text}`, error);
  }
}

/** Mints a key for the account. `expiresInDays` null means the key does not expire. */
export async function createApiKey(input: {
  accountId: number;
  name: string;
  permissions: ApiKeyPermissions;
  expiresInDays: ApiKeyExpirationDays;
}): Promise<{ apiKey: AccountApiKeyRow; token: string }> {
  return createAccountApiKey({
    accountId: input.accountId,
    name: input.name,
    permissions: input.permissions,
    expiresAt: apiKeyExpiresAt(new Date(), input.expiresInDays),
  });
}

/** Every key of the account, expired ones included, newest first. */
export async function listApiKeys(accountId: number): Promise<AccountApiKeyRow[]> {
  return listAccountApiKeys({ accountId });
}

/** How many keys the account holds, expired ones included. */
export async function countApiKeys(accountId: number): Promise<number> {
  return countAccountApiKeys({ accountId });
}

/** Deletes one of the account's keys. False when this account has no such key. */
export async function revokeApiKey(input: {
  accountId: number;
  apiKeyIdText: string;
}): Promise<boolean> {
  return deleteAccountApiKey(input);
}
