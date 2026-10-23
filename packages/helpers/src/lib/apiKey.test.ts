import { describe, expect, it } from 'vitest';

import type { ApiKeyPermissions, ApiKeyResource } from './apiKey.js';
import {
  API_KEY_MAX_PER_ACCOUNT,
  API_KEY_PRESET_IDS,
  API_KEY_RESOURCES,
  API_KEY_SUPPORTED_ACTIONS,
  API_KEY_TOKEN_PREFIX,
  apiKeyExpiresAt,
  apiKeyPermissionsAllow,
  apiKeyPermissionsForPreset,
  apiKeyPermissionsGrantSupported,
  apiKeyResourceSupportsAction,
  emptyApiKeyPermissions,
  findApiKeyPresetId,
  formatApiKeyTokenHint,
  hasApiKeyTokenPrefix,
  isApiKeyExpired,
  isApiKeyTokenFormat,
  normalizeApiKeyPermissions,
} from './apiKey.js';
import type { CrudAction } from './crudBitmask.js';
import { CRUD_ACTIONS, CRUD_BITS, CRUD_MASK_ALL } from './crudBitmask.js';

/** The eight cells no route checks. Written here, not derived from API_KEY_SUPPORTED_ACTIONS. */
const UNSUPPORTED_API_KEY_CELLS: ReadonlyArray<readonly [ApiKeyResource, CrudAction]> = [
  ['account', 'create'],
  ['account', 'delete'],
  ['settings', 'create'],
  ['settings', 'read'],
  ['settings', 'delete'],
  ['add_by_rss', 'update'],
  ['history', 'create'],
  ['history', 'delete'],
];

const BASE64URL_BODY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcde0123456789_-';

function permissionsWith(
  overrides: ReadonlyArray<readonly [ApiKeyResource, number]>
): ApiKeyPermissions {
  const permissions = emptyApiKeyPermissions();
  for (const [resource, mask] of overrides) {
    permissions[resource] = mask;
  }
  return permissions;
}

function actionsFollowCrudOrder(actions: readonly CrudAction[]): boolean {
  let previous = -1;
  for (const action of actions) {
    const position = CRUD_ACTIONS.indexOf(action);
    if (position <= previous) {
      return false;
    }
    previous = position;
  }
  return actions.length > 0;
}

describe('isApiKeyTokenFormat', () => {
  it('accepts a 43-character base64url token and rejects a JWT, a short token, and a dot', () => {
    expect(BASE64URL_BODY).toHaveLength(43);
    const token = `${API_KEY_TOKEN_PREFIX}${BASE64URL_BODY}`;
    expect(isApiKeyTokenFormat(token)).toBe(true);
    expect(isApiKeyTokenFormat(`${API_KEY_TOKEN_PREFIX}${BASE64URL_BODY.slice(0, 42)}`)).toBe(
      false
    );
    expect(isApiKeyTokenFormat(`${API_KEY_TOKEN_PREFIX}${BASE64URL_BODY}A`)).toBe(false);
    const withDot = `${BASE64URL_BODY.slice(0, 10)}.${BASE64URL_BODY.slice(11)}`;
    expect(withDot).toHaveLength(43);
    expect(isApiKeyTokenFormat(`${API_KEY_TOKEN_PREFIX}${withDot}`)).toBe(false);
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature';
    expect(isApiKeyTokenFormat(jwt)).toBe(false);
    expect(hasApiKeyTokenPrefix('pvk_x')).toBe(true);
    expect(hasApiKeyTokenPrefix(jwt)).toBe(false);
    expect(formatApiKeyTokenHint('abcd')).toBe('pvk_…abcd');
  });
});

describe('normalizeApiKeyPermissions', () => {
  it('fills missing resources with 0, drops unknown keys, and replaces non-masks', () => {
    const normalized = normalizeApiKeyPermissions({
      account: CRUD_BITS.update,
      playlists: 16,
      queue: 2.5,
      clips: '2',
      subscriptions: -1,
      billing: CRUD_MASK_ALL,
    });
    expect(Object.keys(normalized)).toEqual([...API_KEY_RESOURCES]);
    expect(normalized.account).toBe(CRUD_BITS.update);
    expect(normalized.playlists).toBe(0);
    expect(normalized.queue).toBe(0);
    expect(normalized.clips).toBe(0);
    expect(normalized.subscriptions).toBe(0);
    expect(normalized.settings).toBe(0);
    expect(normalized.add_by_rss).toBe(0);
    expect(normalized.history).toBe(0);
    expect(normalized.notifications).toBe(0);
    expect(Object.hasOwn(normalized, 'billing')).toBe(false);
  });

  it('returns all zeros for null, arrays, and strings', () => {
    const zeros = emptyApiKeyPermissions();
    expect(normalizeApiKeyPermissions(null)).toEqual(zeros);
    expect(normalizeApiKeyPermissions(['account'])).toEqual(zeros);
    expect(normalizeApiKeyPermissions('account')).toEqual(zeros);
  });

  it('keeps unsupported bits on settings and history', () => {
    const normalized = normalizeApiKeyPermissions({ settings: 2, history: 15 });
    expect(normalized.settings).toBe(2);
    expect(normalized.history).toBe(15);
    expect(normalized.account).toBe(0);
  });
});

describe('api key presets', () => {
  it('round-trips each preset and returns null for a mixed mask', () => {
    for (const presetId of API_KEY_PRESET_IDS) {
      expect(findApiKeyPresetId(apiKeyPermissionsForPreset(presetId))).toBe(presetId);
    }
    const mixed = permissionsWith([
      ['account', CRUD_BITS.read],
      ['playlists', CRUD_MASK_ALL],
    ]);
    expect(findApiKeyPresetId(mixed)).toBeNull();
  });

  it('stores the full mask on every resource, including settings and history', () => {
    const readOnly = apiKeyPermissionsForPreset('read_only');
    const fullAccess = apiKeyPermissionsForPreset('full_access');
    for (const resource of API_KEY_RESOURCES) {
      expect(readOnly[resource]).toBe(CRUD_BITS.read);
      expect(fullAccess[resource]).toBe(CRUD_MASK_ALL);
    }
    expect(readOnly.settings).toBe(2);
    expect(readOnly.history).toBe(2);
    expect(fullAccess.settings).toBe(15);
    expect(fullAccess.history).toBe(15);
  });
});

describe('API_KEY_SUPPORTED_ACTIONS', () => {
  it('has one entry per resource, in CRUD_ACTIONS order, with no repeats', () => {
    expect(Object.keys(API_KEY_SUPPORTED_ACTIONS).sort()).toEqual([...API_KEY_RESOURCES].sort());
    for (const resource of API_KEY_RESOURCES) {
      expect(actionsFollowCrudOrder(API_KEY_SUPPORTED_ACTIONS[resource])).toBe(true);
    }
  });
});

describe('apiKeyResourceSupportsAction', () => {
  it('is false for the eight unsupported cells and true for the other twenty-eight', () => {
    expect(UNSUPPORTED_API_KEY_CELLS).toHaveLength(8);
    const cellKeys = UNSUPPORTED_API_KEY_CELLS.map(([resource, action]) => `${resource}:${action}`);
    expect(new Set(cellKeys).size).toBe(UNSUPPORTED_API_KEY_CELLS.length);
    let unsupportedCount = 0;
    let supportedCount = 0;
    for (const resource of API_KEY_RESOURCES) {
      for (const action of CRUD_ACTIONS) {
        const listed = UNSUPPORTED_API_KEY_CELLS.some(
          ([listedResource, listedAction]) => listedResource === resource && listedAction === action
        );
        if (listed) {
          expect(apiKeyResourceSupportsAction(resource, action)).toBe(false);
          unsupportedCount += 1;
        } else {
          expect(apiKeyResourceSupportsAction(resource, action)).toBe(true);
          supportedCount += 1;
        }
      }
    }
    expect(unsupportedCount).toBe(8);
    expect(supportedCount).toBe(28);
  });
});

describe('apiKeyPermissionsAllow', () => {
  it('checks the stored mask, including a bit the resource does not list', () => {
    const permissions = permissionsWith([
      ['playlists', CRUD_BITS.read | CRUD_BITS.update],
      ['settings', CRUD_BITS.read],
    ]);
    expect(apiKeyPermissionsAllow(permissions, { resource: 'playlists', action: 'read' })).toBe(
      true
    );
    expect(apiKeyPermissionsAllow(permissions, { resource: 'playlists', action: 'update' })).toBe(
      true
    );
    expect(apiKeyPermissionsAllow(permissions, { resource: 'playlists', action: 'create' })).toBe(
      false
    );
    expect(apiKeyPermissionsAllow(permissions, { resource: 'playlists', action: 'delete' })).toBe(
      false
    );
    expect(apiKeyPermissionsAllow(permissions, { resource: 'queue', action: 'read' })).toBe(false);
    expect(apiKeyPermissionsAllow(permissions, { resource: 'settings', action: 'read' })).toBe(
      true
    );
  });
});

describe('apiKeyPermissionsGrantSupported', () => {
  it('ignores unsupported bits and accepts a supported cell', () => {
    expect(apiKeyPermissionsGrantSupported(emptyApiKeyPermissions())).toBe(false);
    const onlyUnsupported = permissionsWith([
      ['settings', 2],
      ['history', 9],
    ]);
    expect(apiKeyPermissionsGrantSupported(onlyUnsupported)).toBe(false);
    expect(apiKeyPermissionsGrantSupported(apiKeyPermissionsForPreset('read_only'))).toBe(true);
    expect(apiKeyPermissionsGrantSupported(permissionsWith([['account', CRUD_BITS.read]]))).toBe(
      true
    );
  });
});

describe('API_KEY_MAX_PER_ACCOUNT', () => {
  it('is 20', () => {
    expect(API_KEY_MAX_PER_ACCOUNT).toBe(20);
  });
});

describe('api key expiration', () => {
  it('adds 30 days, or returns null when the key never expires', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = apiKeyExpiresAt(createdAt, 30);
    expect(expiresAt).toEqual(new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000));
    expect(apiKeyExpiresAt(createdAt, null)).toBeNull();
  });

  it('is expired at or before now, including an ISO string, and false for null', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const atNow = new Date(now.getTime());
    const beforeNow = new Date(now.getTime() - 1);
    const afterNow = new Date(now.getTime() + 1);
    expect(isApiKeyExpired(atNow, now)).toBe(true);
    expect(isApiKeyExpired(beforeNow, now)).toBe(true);
    expect(isApiKeyExpired(afterNow, now)).toBe(false);
    expect(isApiKeyExpired(null, now)).toBe(false);
    expect(isApiKeyExpired(atNow.toISOString(), now)).toBe(true);
    expect(isApiKeyExpired(afterNow.toISOString(), now)).toBe(false);
  });
});
