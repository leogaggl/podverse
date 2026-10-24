import { describe, expect, it } from 'vitest';

import { apiKeyPermissionsForPreset, CRUD_BITS, emptyApiKeyPermissions } from '@podverse/helpers';

import { apiDocsUrl, apiDocsYamlUrl, summarizeApiKeyPermissions } from './apiKeyDisplay';

describe('summarizeApiKeyPermissions', () => {
  it('summarizes a read-only preset mask as that preset', () => {
    expect(summarizeApiKeyPermissions(apiKeyPermissionsForPreset('read_only'))).toEqual({
      kind: 'preset',
      presetId: 'read_only',
    });
  });

  it('summarizes a full-access preset mask as that preset, including unsupported bits', () => {
    expect(summarizeApiKeyPermissions(apiKeyPermissionsForPreset('full_access'))).toEqual({
      kind: 'preset',
      presetId: 'full_access',
    });
  });

  it('summarizes playlists read and update as one custom line in that action order', () => {
    const permissions = emptyApiKeyPermissions();
    permissions.playlists = CRUD_BITS.read | CRUD_BITS.update;

    expect(summarizeApiKeyPermissions(permissions)).toEqual({
      kind: 'custom',
      lines: [{ resource: 'playlists', actions: ['read', 'update'] }],
    });
  });

  it('summarizes an empty mask as custom with no lines', () => {
    expect(summarizeApiKeyPermissions(emptyApiKeyPermissions())).toEqual({
      kind: 'custom',
      lines: [],
    });
  });

  it('drops an account create bit because that action is not a supported cell', () => {
    const permissions = emptyApiKeyPermissions();
    permissions.account = CRUD_BITS.create;

    expect(summarizeApiKeyPermissions(permissions)).toEqual({
      kind: 'custom',
      lines: [],
    });
  });

  it('keeps playlists read and omits an unsupported account create bit', () => {
    const permissions = emptyApiKeyPermissions();
    permissions.playlists = CRUD_BITS.read;
    permissions.account = CRUD_BITS.create;

    expect(summarizeApiKeyPermissions(permissions)).toEqual({
      kind: 'custom',
      lines: [{ resource: 'playlists', actions: ['read'] }],
    });
  });
});

describe('api docs urls', () => {
  it('appends /docs after removing one trailing slash from the API base', () => {
    expect(apiDocsUrl('http://localhost:4030/api/v2/')).toBe('http://localhost:4030/api/v2/docs');
    expect(apiDocsUrl('http://localhost:4030/api/v2')).toBe('http://localhost:4030/api/v2/docs');
  });

  it('appends /docs.yaml after removing one trailing slash from the API base', () => {
    expect(apiDocsYamlUrl('http://localhost:4030/api/v2/')).toBe(
      'http://localhost:4030/api/v2/docs.yaml'
    );
    expect(apiDocsYamlUrl('http://localhost:4030/api/v2')).toBe(
      'http://localhost:4030/api/v2/docs.yaml'
    );
  });
});
