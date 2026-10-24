import { describe, expect, it } from 'vitest';

import type { ApiKeyPermissions, ApiKeyResource, CrudAction } from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  apiKeyPermissionsForPreset,
  apiKeyResourceSupportsAction,
  CRUD_ACTIONS,
  crudMaskWith,
  emptyApiKeyPermissions,
  formatApiKeyTokenHint,
} from '@podverse/helpers';
import type { DTOAccountApiKey } from '@podverse/helpers/dto';

import type { ApiKeyListRow } from './accountApiKeyRows';
import {
  API_KEY_EXPIRATION_CHOICES,
  apiKeyCreateAccess,
  apiKeyPermissionCellKind,
  apiKeyPermissionChecked,
  expirationChoiceFromDays,
  expirationDaysFromChoice,
  summarizeApiKeyPermissions,
  toApiKeyCreateBody,
  toApiKeyListRows,
  toggleApiKeyPermission,
  withoutApiKey,
} from './accountApiKeyRows';

const NOW = new Date('2026-06-01T00:00:00.000Z');

const key = (overrides: Partial<DTOAccountApiKey> = {}): DTOAccountApiKey => ({
  created_at: '2026-05-01T00:00:00.000Z',
  expires_at: '2026-08-01T00:00:00.000Z',
  id_text: 'key-a',
  last_used_at: null,
  name: 'CI',
  permissions: apiKeyPermissionsForPreset('read_only'),
  token_hint: 'abcd',
  ...overrides,
});

const withActions = (
  resource: ApiKeyResource,
  actions: readonly CrudAction[]
): ApiKeyPermissions => {
  const permissions = emptyApiKeyPermissions();
  for (const action of actions) {
    permissions[resource] = crudMaskWith(permissions[resource], action, true);
  }
  return permissions;
};

describe('toApiKeyListRows', () => {
  it('keeps server order, formats the hint, and marks expiry against the caller clock', () => {
    const rows = toApiKeyListRows(
      [
        key({ expires_at: '2026-05-01T00:00:00.000Z', id_text: 'expired', token_hint: 'abcd' }),
        key({ expires_at: '2026-07-01T00:00:00.000Z', id_text: 'later', token_hint: 'wxyz' }),
        key({ expires_at: null, id_text: 'never', token_hint: 'mnop' }),
      ],
      NOW
    );

    expect(rows.map((row) => row.idText)).toEqual(['expired', 'later', 'never']);
    expect(rows[0]?.hintLabel).toBe(formatApiKeyTokenHint('abcd'));
    expect(rows[0]?.summary).toEqual({ kind: 'preset', presetId: 'read_only' });
    expect(rows[0]?.isExpired).toBe(true);
    expect(rows[1]?.isExpired).toBe(false);
    expect(rows[2]?.isExpired).toBe(false);
    expect(rows[0]?.name).toBe('CI');
    expect(rows[0]?.createdAt).toBe('2026-05-01T00:00:00.000Z');
    expect(rows[0]?.expiresAt).toBe('2026-05-01T00:00:00.000Z');
    expect(rows[0]?.lastUsedAt).toBeNull();
  });
});

describe('summarizeApiKeyPermissions', () => {
  it('names a preset when the whole mask matches, including bits no route checks', () => {
    expect(summarizeApiKeyPermissions(apiKeyPermissionsForPreset('read_only'))).toEqual({
      kind: 'preset',
      presetId: 'read_only',
    });
    expect(summarizeApiKeyPermissions(apiKeyPermissionsForPreset('full_access'))).toEqual({
      kind: 'preset',
      presetId: 'full_access',
    });
  });

  it('lists supported actions on a custom mask and drops unsupported bits', () => {
    expect(summarizeApiKeyPermissions(withActions('playlists', ['read', 'update']))).toEqual({
      kind: 'custom',
      lines: [{ actions: ['read', 'update'], resource: 'playlists' }],
    });
    expect(summarizeApiKeyPermissions(emptyApiKeyPermissions())).toEqual({
      kind: 'custom',
      lines: [],
    });
    expect(summarizeApiKeyPermissions(withActions('account', ['create']))).toEqual({
      kind: 'custom',
      lines: [],
    });

    const mixed = withActions('playlists', ['read']);
    mixed.account = crudMaskWith(mixed.account, 'create', true);
    expect(summarizeApiKeyPermissions(mixed)).toEqual({
      kind: 'custom',
      lines: [{ actions: ['read'], resource: 'playlists' }],
    });
  });

  it('stays custom when every supported cell is on and unsupported bits stay off', () => {
    const permissions = emptyApiKeyPermissions();
    for (const resource of API_KEY_RESOURCES) {
      for (const action of CRUD_ACTIONS) {
        if (apiKeyResourceSupportsAction(resource, action)) {
          permissions[resource] = crudMaskWith(permissions[resource], action, true);
        }
      }
    }

    const summary = summarizeApiKeyPermissions(permissions);
    expect(summary.kind).toBe('custom');
  });
});

describe('withoutApiKey', () => {
  it('drops one id and keeps the rest', () => {
    const rows: ApiKeyListRow[] = [
      {
        createdAt: '2026-05-01T00:00:00.000Z',
        expiresAt: null,
        hintLabel: 'pvk_…abcd',
        idText: 'keep',
        isExpired: false,
        lastUsedAt: null,
        name: 'Keep',
        summary: { kind: 'preset', presetId: 'read_only' },
      },
      {
        createdAt: '2026-05-02T00:00:00.000Z',
        expiresAt: null,
        hintLabel: 'pvk_…wxyz',
        idText: 'drop',
        isExpired: false,
        lastUsedAt: null,
        name: 'Drop',
        summary: { kind: 'custom', lines: [] },
      },
    ];

    expect(withoutApiKey(rows, 'drop').map((row) => row.idText)).toEqual(['keep']);
  });
});

describe('expiration choices', () => {
  it('round-trips 30, 90, 365, and null', () => {
    const days = [30, 90, 365, null] as const;
    for (const day of days) {
      expect(expirationDaysFromChoice(expirationChoiceFromDays(day))).toBe(day);
    }
    for (const choice of API_KEY_EXPIRATION_CHOICES) {
      expect(expirationChoiceFromDays(expirationDaysFromChoice(choice))).toBe(choice);
    }
  });
});

describe('permission edits', () => {
  it('turns playlists read off on a read-only preset and leaves queue read on', () => {
    const readOnly = apiKeyPermissionsForPreset('read_only');
    const toggled = toggleApiKeyPermission(readOnly, 'playlists', 'read');

    expect(apiKeyPermissionChecked(toggled, 'playlists', 'read')).toBe(false);
    expect(apiKeyPermissionChecked(toggled, 'queue', 'read')).toBe(true);
    expect(apiKeyPermissionChecked(readOnly, 'playlists', 'read')).toBe(true);
  });

  it('marks the eight unsupported pairs and leaves the other 28 as checkboxes', () => {
    const unsupported: readonly (readonly [ApiKeyResource, CrudAction])[] = [
      ['account', 'create'],
      ['account', 'delete'],
      ['settings', 'create'],
      ['settings', 'read'],
      ['settings', 'delete'],
      ['add_by_rss', 'update'],
      ['history', 'create'],
      ['history', 'delete'],
    ];

    let checkboxCount = 0;
    let unsupportedCount = 0;
    for (const resource of API_KEY_RESOURCES) {
      for (const action of CRUD_ACTIONS) {
        const named = unsupported.some(
          ([unsupportedResource, unsupportedAction]) =>
            unsupportedResource === resource && unsupportedAction === action
        );
        if (named) {
          expect(apiKeyPermissionCellKind(resource, action)).toBe('unsupported');
          unsupportedCount += 1;
        } else {
          expect(apiKeyPermissionCellKind(resource, action)).toBe('checkbox');
          checkboxCount += 1;
        }
      }
    }

    expect(unsupportedCount).toBe(8);
    expect(checkboxCount).toBe(28);
  });
});

describe('apiKeyCreateAccess', () => {
  it('stays unknown until the tier is known, even when the other flags are false', () => {
    expect(apiKeyCreateAccess({ isExpired: false, isMember: false, isTierKnown: false })).toBe(
      'unknown'
    );
  });

  it('reports an expired membership before a missing one, including when the member flag is set', () => {
    expect(apiKeyCreateAccess({ isExpired: true, isMember: true, isTierKnown: true })).toBe(
      'membership_expired'
    );
    expect(apiKeyCreateAccess({ isExpired: true, isMember: false, isTierKnown: true })).toBe(
      'membership_expired'
    );
  });

  it('allows a current member and asks for a membership when the account never had one', () => {
    expect(apiKeyCreateAccess({ isExpired: false, isMember: true, isTierKnown: true })).toBe(
      'allowed'
    );
    expect(apiKeyCreateAccess({ isExpired: false, isMember: false, isTierKnown: true })).toBe(
      'needs_membership'
    );
  });
});

describe('toApiKeyCreateBody', () => {
  it('trims the name and sends a null expiry for none', () => {
    const permissions = apiKeyPermissionsForPreset('read_only');
    expect(toApiKeyCreateBody({ expiresIn: 'none', name: '  CI key  ', permissions })).toEqual({
      expires_in_days: null,
      name: 'CI key',
      permissions,
    });
  });
});
