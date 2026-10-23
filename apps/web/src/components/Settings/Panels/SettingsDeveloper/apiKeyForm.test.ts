import { describe, expect, it } from 'vitest';

import type { ApiKeyResource, CrudAction } from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  apiKeyPermissionsForPreset,
  CRUD_ACTIONS,
  CRUD_BITS,
  crudMaskHas,
} from '@podverse/helpers';

import {
  apiKeyCreateBody,
  apiKeyExpirationFromDropdownValue,
  apiKeyExpirationToDropdownValue,
  apiKeyPermissionCellKind,
  toggleApiKeyPermission,
} from './apiKeyForm';

describe('apiKeyExpirationToDropdownValue', () => {
  it('uses the day count, and none for a key that does not expire', () => {
    expect(apiKeyExpirationToDropdownValue(90)).toBe('90');
    expect(apiKeyExpirationToDropdownValue(null)).toBe('none');
  });
});

describe('apiKeyExpirationFromDropdownValue', () => {
  it('reads none as null, a listed day count as that count, and anything else as 90 days', () => {
    expect(apiKeyExpirationFromDropdownValue('none')).toBeNull();
    expect(apiKeyExpirationFromDropdownValue('30')).toBe(30);
    expect(apiKeyExpirationFromDropdownValue('60')).toBe(90);
  });
});

describe('toggleApiKeyPermission', () => {
  it('turns read off on account for a read-only preset and leaves the other resources unchanged', () => {
    const preset = apiKeyPermissionsForPreset('read_only');
    const next = toggleApiKeyPermission(preset, 'account', 'read', false);

    expect(crudMaskHas(next.account, 'read')).toBe(false);
    expect(preset.account).toBe(CRUD_BITS.read);
    for (const resource of API_KEY_RESOURCES) {
      if (resource === 'account') {
        continue;
      }
      expect(next[resource]).toBe(preset[resource]);
    }
  });
});

describe('apiKeyCreateBody', () => {
  it('trims the name and sends a null expiry when the input days are null', () => {
    const permissions = apiKeyPermissionsForPreset('read_only');

    expect(
      apiKeyCreateBody({
        name: '  Agent Key  ',
        permissions,
        expiresInDays: null,
      })
    ).toEqual({
      name: 'Agent Key',
      permissions,
      expires_in_days: null,
    });
  });
});

describe('apiKeyPermissionCellKind', () => {
  it('marks the eight cells no route checks as unsupported and the other twenty-eight as checkboxes', () => {
    const unsupported: string[] = [];
    let checkboxCount = 0;

    for (const resource of API_KEY_RESOURCES) {
      for (const action of CRUD_ACTIONS) {
        const kind = apiKeyPermissionCellKind(resource, action);
        if (kind === 'unsupported') {
          unsupported.push(permissionPair(resource, action));
        } else {
          expect(kind).toBe('checkbox');
          checkboxCount += 1;
        }
      }
    }

    expect(unsupported).toEqual([
      'account create',
      'account delete',
      'settings create',
      'settings read',
      'settings delete',
      'add_by_rss update',
      'history create',
      'history delete',
    ]);
    expect(checkboxCount).toBe(28);
  });
});

function permissionPair(resource: ApiKeyResource, action: CrudAction): string {
  return `${resource} ${action}`;
}
