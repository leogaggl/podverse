import { config } from '@api/config/index.js';

import type { ApiKeyPermissionRequirement, ApiKeyPermissions } from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  apiKeyPermissionsForPreset,
  crudMaskWith,
  emptyApiKeyPermissions,
} from '@podverse/helpers';

const TEST_PASSWORD = 'IntegrationTest1!';

let accountCounter = 0;

/** A verified account with the current terms accepted. Fresh accounts are valid trials. */
export async function createApiKeyTestAccount(
  emailPrefix: string
): Promise<{ id: number; email: string; password: string }> {
  const { AccountService } = await import('@podverse/orm');
  accountCounter += 1;
  const email = `${emailPrefix}${Date.now()}-${accountCounter}@example.com`;
  const accountService = new AccountService();
  await accountService.create({
    email,
    password: TEST_PASSWORD,
    locale: 'en-US',
    terms_version: config.terms.version,
  });
  const account = await accountService.getByEmail(email);
  if (!account) {
    throw new Error('Failed to load account after create');
  }
  await accountService.verifyEmail(account.id);
  return { id: account.id, email, password: TEST_PASSWORD };
}

/** Inserts a key through `createAccountApiKey` (no expiry) and returns the raw token. */
export async function createTestApiKey(
  accountId: number,
  permissions: ApiKeyPermissions
): Promise<string> {
  const { createAccountApiKey } = await import('@podverse/orm');
  const created = await createAccountApiKey({
    accountId,
    name: 'test key',
    permissions,
    expiresAt: null,
  });
  return created.token;
}

/** Full access with exactly one bit cleared. */
export function permissionsWithout(requirement: ApiKeyPermissionRequirement): ApiKeyPermissions {
  const fullAccess = apiKeyPermissionsForPreset('full_access');
  const permissions = emptyApiKeyPermissions();
  for (const resource of API_KEY_RESOURCES) {
    permissions[resource] = fullAccess[resource];
  }
  permissions[requirement.resource] = crudMaskWith(
    permissions[requirement.resource],
    requirement.action,
    false
  );
  return permissions;
}

/** No access except the listed bits. */
export function permissionsWithOnly(
  requirements: ApiKeyPermissionRequirement[]
): ApiKeyPermissions {
  const permissions = emptyApiKeyPermissions();
  for (const requirement of requirements) {
    permissions[requirement.resource] = crudMaskWith(
      permissions[requirement.resource],
      requirement.action,
      true
    );
  }
  return permissions;
}

export function apiKeyHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
