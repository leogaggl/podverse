import type {
  ApiKeyExpirationDays,
  ApiKeyPermissions,
  ApiKeyPresetId,
  ApiKeyResource,
  CrudAction,
} from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  apiKeyResourceSupportsAction,
  crudMaskHas,
  crudMaskToActions,
  crudMaskWith,
  emptyApiKeyPermissions,
  findApiKeyPresetId,
  formatApiKeyTokenHint,
  isApiKeyExpired,
} from '@podverse/helpers';
import type { AccountApiKeyCreateBody, DTOAccountApiKey } from '@podverse/helpers/dto';

export type ApiKeyPermissionSummary =
  | { kind: 'preset'; presetId: ApiKeyPresetId }
  | { kind: 'custom'; lines: { resource: ApiKeyResource; actions: CrudAction[] }[] };

/**
 * Preset when the whole mask matches, including bits no route checks.
 * Otherwise one line per resource that still has a supported action.
 */
export const summarizeApiKeyPermissions = (
  permissions: ApiKeyPermissions
): ApiKeyPermissionSummary => {
  const presetId = findApiKeyPresetId(permissions);
  if (presetId !== null) {
    return { kind: 'preset', presetId };
  }
  const lines: { resource: ApiKeyResource; actions: CrudAction[] }[] = [];
  for (const resource of API_KEY_RESOURCES) {
    const actions = crudMaskToActions(permissions[resource]).filter((action) =>
      apiKeyResourceSupportsAction(resource, action)
    );
    if (actions.length > 0) {
      lines.push({ resource, actions });
    }
  }
  return { kind: 'custom', lines };
};

export type ApiKeyListRow = {
  idText: string;
  name: string;
  /** Display form from formatApiKeyTokenHint, such as pvk_…abcd. */
  hintLabel: string;
  summary: ApiKeyPermissionSummary;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isExpired: boolean;
};

/** Server order, newest first. `now` is the clock the caller passes in. */
export const toApiKeyListRows = (keys: readonly DTOAccountApiKey[], now: Date): ApiKeyListRow[] =>
  keys.map((key) => ({
    idText: key.id_text,
    name: key.name,
    hintLabel: formatApiKeyTokenHint(key.token_hint),
    summary: summarizeApiKeyPermissions(key.permissions),
    createdAt: key.created_at,
    expiresAt: key.expires_at,
    lastUsedAt: key.last_used_at,
    isExpired: isApiKeyExpired(key.expires_at, now),
  }));

export const withoutApiKey = (rows: readonly ApiKeyListRow[], idText: string): ApiKeyListRow[] =>
  rows.filter((row) => row.idText !== idText);

/** Expiration list values. `none` never expires. The screen chooses the default. */
export const API_KEY_EXPIRATION_CHOICES = ['30', '90', '365', 'none'] as const;
export type ApiKeyExpirationChoice = (typeof API_KEY_EXPIRATION_CHOICES)[number];

export const expirationChoiceFromDays = (days: ApiKeyExpirationDays): ApiKeyExpirationChoice => {
  switch (days) {
    case 30:
      return '30';
    case 90:
      return '90';
    case 365:
      return '365';
    case null:
      return 'none';
  }
};

export const expirationDaysFromChoice = (choice: ApiKeyExpirationChoice): ApiKeyExpirationDays => {
  switch (choice) {
    case '30':
      return 30;
    case '90':
      return 90;
    case '365':
      return 365;
    case 'none':
      return null;
  }
};

/** A new permissions object. Callers only pass a cell the resource supports. */
export const toggleApiKeyPermission = (
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction
): ApiKeyPermissions => {
  const next = emptyApiKeyPermissions();
  for (const item of API_KEY_RESOURCES) {
    next[item] =
      item === resource
        ? crudMaskWith(permissions[item], action, !crudMaskHas(permissions[item], action))
        : permissions[item];
  }
  return next;
};

export const apiKeyPermissionChecked = (
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction
): boolean => crudMaskHas(permissions[resource], action);

export const apiKeyPermissionCellKind = (
  resource: ApiKeyResource,
  action: CrudAction
): 'checkbox' | 'unsupported' =>
  apiKeyResourceSupportsAction(resource, action) ? 'checkbox' : 'unsupported';

/**
 * Whether create is offered. An unknown tier stays unknown until the account snapshot arrives.
 * An expired membership is reported before a missing membership.
 */
export type ApiKeyCreateAccess = 'allowed' | 'membership_expired' | 'needs_membership' | 'unknown';

export const apiKeyCreateAccess = (input: {
  isTierKnown: boolean;
  isMember: boolean;
  isExpired: boolean;
}): ApiKeyCreateAccess => {
  if (!input.isTierKnown) {
    return 'unknown';
  }
  if (input.isExpired) {
    return 'membership_expired';
  }
  if (input.isMember) {
    return 'allowed';
  }
  return 'needs_membership';
};

export const toApiKeyCreateBody = (input: {
  name: string;
  permissions: ApiKeyPermissions;
  expiresIn: ApiKeyExpirationChoice;
}): AccountApiKeyCreateBody => ({
  name: input.name.trim(),
  permissions: input.permissions,
  expires_in_days: expirationDaysFromChoice(input.expiresIn),
});
