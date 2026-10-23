import type {
  ApiKeyPermissions,
  ApiKeyPresetId,
  ApiKeyResource,
  CrudAction,
} from '@podverse/helpers';
import {
  API_KEY_RESOURCES,
  apiKeyResourceSupportsAction,
  crudMaskToActions,
  findApiKeyPresetId,
} from '@podverse/helpers';

export type ApiKeyPermissionSummary =
  | { kind: 'preset'; presetId: ApiKeyPresetId }
  | { kind: 'custom'; lines: { resource: ApiKeyResource; actions: CrudAction[] }[] };

export type ApiKeyPresetLabelKey = 'preset_read_only' | 'preset_full_access';

export type ApiKeyResourceLabelKey =
  | 'resources.account'
  | 'resources.settings'
  | 'resources.subscriptions'
  | 'resources.add_by_rss'
  | 'resources.playlists'
  | 'resources.queue'
  | 'resources.history'
  | 'resources.clips'
  | 'resources.notifications';

export type ApiKeyActionLabelKey =
  'actions.create' | 'actions.read' | 'actions.update' | 'actions.delete';

/**
 * Preset when the mask matches one exactly, including bits no route checks. Otherwise one line
 * per resource that still has a supported action.
 */
export function summarizeApiKeyPermissions(
  permissions: ApiKeyPermissions
): ApiKeyPermissionSummary {
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
}

export function apiKeyPresetLabelKey(presetId: ApiKeyPresetId): ApiKeyPresetLabelKey {
  switch (presetId) {
    case 'read_only':
      return 'preset_read_only';
    case 'full_access':
      return 'preset_full_access';
    default: {
      const unexpected: never = presetId;
      throw new Error(`Unknown API key preset: ${String(unexpected)}`);
    }
  }
}

export function apiKeyResourceLabelKey(resource: ApiKeyResource): ApiKeyResourceLabelKey {
  switch (resource) {
    case 'account':
      return 'resources.account';
    case 'settings':
      return 'resources.settings';
    case 'subscriptions':
      return 'resources.subscriptions';
    case 'add_by_rss':
      return 'resources.add_by_rss';
    case 'playlists':
      return 'resources.playlists';
    case 'queue':
      return 'resources.queue';
    case 'history':
      return 'resources.history';
    case 'clips':
      return 'resources.clips';
    case 'notifications':
      return 'resources.notifications';
    default: {
      const unexpected: never = resource;
      throw new Error(`Unknown API key resource: ${String(unexpected)}`);
    }
  }
}

export function apiKeyActionLabelKey(action: CrudAction): ApiKeyActionLabelKey {
  switch (action) {
    case 'create':
      return 'actions.create';
    case 'read':
      return 'actions.read';
    case 'update':
      return 'actions.update';
    case 'delete':
      return 'actions.delete';
    default: {
      const unexpected: never = action;
      throw new Error(`Unknown API key action: ${String(unexpected)}`);
    }
  }
}

/** Interactive API reference. One trailing slash on the base is removed before `/docs`. */
export function apiDocsUrl(apiBaseUrl: string): string {
  return `${withoutOneTrailingSlash(apiBaseUrl)}/docs`;
}

/** Raw OpenAPI document. One trailing slash on the base is removed before `/docs.yaml`. */
export function apiDocsYamlUrl(apiBaseUrl: string): string {
  return `${withoutOneTrailingSlash(apiBaseUrl)}/docs.yaml`;
}

function withoutOneTrailingSlash(apiBaseUrl: string): string {
  if (apiBaseUrl.endsWith('/')) {
    return apiBaseUrl.slice(0, -1);
  }
  return apiBaseUrl;
}
