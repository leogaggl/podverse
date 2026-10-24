import type {
  AccountApiKeyCreateBody,
  ApiKeyExpirationDays,
  ApiKeyPermissions,
  ApiKeyResource,
  CrudAction,
} from '@podverse/helpers';
import {
  API_KEY_DEFAULT_EXPIRATION_DAYS,
  apiKeyResourceSupportsAction,
  crudMaskWith,
  isApiKeyExpirationDays,
} from '@podverse/helpers';

/** Dropdown value for a key that does not expire. `FormDropdown` options are strings. */
export const API_KEY_EXPIRATION_NONE_VALUE = 'none';

export function apiKeyExpirationToDropdownValue(days: ApiKeyExpirationDays): string {
  if (days === null) {
    return API_KEY_EXPIRATION_NONE_VALUE;
  }
  return String(days);
}

export function apiKeyExpirationFromDropdownValue(value: string): ApiKeyExpirationDays {
  if (value === API_KEY_EXPIRATION_NONE_VALUE) {
    return null;
  }
  const days = Number(value);
  if (isApiKeyExpirationDays(days)) {
    return days;
  }
  return API_KEY_DEFAULT_EXPIRATION_DAYS;
}

export function toggleApiKeyPermission(
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction,
  enabled: boolean
): ApiKeyPermissions {
  return {
    ...permissions,
    [resource]: crudMaskWith(permissions[resource], action, enabled),
  };
}

export function apiKeyCreateBody(input: {
  name: string;
  permissions: ApiKeyPermissions;
  expiresInDays: ApiKeyExpirationDays;
}): AccountApiKeyCreateBody {
  return {
    name: input.name.trim(),
    permissions: input.permissions,
    expires_in_days: input.expiresInDays,
  };
}

export function apiKeyPermissionCellKind(
  resource: ApiKeyResource,
  action: CrudAction
): 'checkbox' | 'unsupported' {
  if (apiKeyResourceSupportsAction(resource, action)) {
    return 'checkbox';
  }
  return 'unsupported';
}
