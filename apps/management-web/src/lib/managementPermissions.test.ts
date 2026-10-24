import { describe, expect, it } from 'vitest';

import type { CrudAction } from '@podverse/helpers';
import { CRUD_BITS, CRUD_MASK_ALL } from '@podverse/helpers';

import {
  canCreateAdmins,
  canCreateBillingProcessorProducts,
  canCreateNotifications,
  canDeleteAdmins,
  canDeleteStorage,
  canEndBillingMembership,
  canGrantBillingMembership,
  canReadAdmins,
  canReadBillingAccount,
  canReadBillingChannels,
  canReadBillingProcessorProducts,
  canReadBillingWebhookEvents,
  canReadEmbedDemo,
  canReadFeeds,
  canReadNotifications,
  canReadStats,
  canReadStorage,
  canReplayBillingWebhookEvents,
  canResyncBillingAccount,
  canUpdateAdmins,
  canUpdateBillingChannels,
  canUpdateBillingProcessorProducts,
  canUpdateEmbedDemo,
  canUpdateFeeds,
  canUpdateNotifications,
  canUpdateStats,
} from './managementPermissions';
import type { CrudPermissions, CurrentUser } from './requests/auth';

type PermissionField = keyof CrudPermissions;

type PermissionCheck = {
  name: string;
  check: (user: CurrentUser) => boolean;
  field: PermissionField;
  action: CrudAction;
};

const PERMISSION_CHECKS: PermissionCheck[] = [
  { name: 'canReadAdmins', check: canReadAdmins, field: 'admins_crud', action: 'read' },
  { name: 'canCreateAdmins', check: canCreateAdmins, field: 'admins_crud', action: 'create' },
  { name: 'canUpdateAdmins', check: canUpdateAdmins, field: 'admins_crud', action: 'update' },
  { name: 'canDeleteAdmins', check: canDeleteAdmins, field: 'admins_crud', action: 'delete' },
  { name: 'canReadFeeds', check: canReadFeeds, field: 'feeds_crud', action: 'read' },
  { name: 'canUpdateFeeds', check: canUpdateFeeds, field: 'feeds_crud', action: 'update' },
  { name: 'canReadStats', check: canReadStats, field: 'stats_crud', action: 'read' },
  { name: 'canUpdateStats', check: canUpdateStats, field: 'stats_crud', action: 'update' },
  { name: 'canReadStorage', check: canReadStorage, field: 'bucket_crud', action: 'read' },
  { name: 'canDeleteStorage', check: canDeleteStorage, field: 'bucket_crud', action: 'delete' },
  { name: 'canReadEmbedDemo', check: canReadEmbedDemo, field: 'embed_demo_crud', action: 'read' },
  {
    name: 'canUpdateEmbedDemo',
    check: canUpdateEmbedDemo,
    field: 'embed_demo_crud',
    action: 'update',
  },
  {
    name: 'canReadNotifications',
    check: canReadNotifications,
    field: 'notifications_crud',
    action: 'read',
  },
  {
    name: 'canCreateNotifications',
    check: canCreateNotifications,
    field: 'notifications_crud',
    action: 'create',
  },
  {
    name: 'canUpdateNotifications',
    check: canUpdateNotifications,
    field: 'notifications_crud',
    action: 'update',
  },
  {
    name: 'canReadBillingChannels',
    check: canReadBillingChannels,
    field: 'billing_channels_crud',
    action: 'read',
  },
  {
    name: 'canUpdateBillingChannels',
    check: canUpdateBillingChannels,
    field: 'billing_channels_crud',
    action: 'update',
  },
  {
    name: 'canReadBillingProcessorProducts',
    check: canReadBillingProcessorProducts,
    field: 'billing_processor_products_crud',
    action: 'read',
  },
  {
    name: 'canCreateBillingProcessorProducts',
    check: canCreateBillingProcessorProducts,
    field: 'billing_processor_products_crud',
    action: 'create',
  },
  {
    name: 'canUpdateBillingProcessorProducts',
    check: canUpdateBillingProcessorProducts,
    field: 'billing_processor_products_crud',
    action: 'update',
  },
  {
    name: 'canReadBillingAccount',
    check: canReadBillingAccount,
    field: 'billing_account_crud',
    action: 'read',
  },
  {
    name: 'canResyncBillingAccount',
    check: canResyncBillingAccount,
    field: 'billing_account_crud',
    action: 'update',
  },
  {
    name: 'canGrantBillingMembership',
    check: canGrantBillingMembership,
    field: 'billing_account_crud',
    action: 'create',
  },
  {
    name: 'canEndBillingMembership',
    check: canEndBillingMembership,
    field: 'billing_account_crud',
    action: 'delete',
  },
  {
    name: 'canReadBillingWebhookEvents',
    check: canReadBillingWebhookEvents,
    field: 'billing_webhook_events_crud',
    action: 'read',
  },
  {
    name: 'canReplayBillingWebhookEvents',
    check: canReplayBillingWebhookEvents,
    field: 'billing_webhook_events_crud',
    action: 'update',
  },
];

function permissionsWith(field: PermissionField, value: number): CrudPermissions {
  return {
    feeds_crud: field === 'feeds_crud' ? value : 0,
    feed_takedown_reasons_crud: field === 'feed_takedown_reasons_crud' ? value : 0,
    admins_crud: field === 'admins_crud' ? value : 0,
    stats_crud: field === 'stats_crud' ? value : 0,
    billing_prices_crud: field === 'billing_prices_crud' ? value : 0,
    bucket_crud: field === 'bucket_crud' ? value : 0,
    embed_demo_crud: field === 'embed_demo_crud' ? value : 0,
    notifications_crud: field === 'notifications_crud' ? value : 0,
    billing_channels_crud: field === 'billing_channels_crud' ? value : 0,
    billing_processor_products_crud: field === 'billing_processor_products_crud' ? value : 0,
    billing_account_crud: field === 'billing_account_crud' ? value : 0,
    billing_webhook_events_crud: field === 'billing_webhook_events_crud' ? value : 0,
  };
}

function userWith(role: string, permissions: CrudPermissions | null): CurrentUser {
  return {
    id: 1,
    id_text: 'pvMgtAu001',
    email: 'admin@example.com',
    username: null,
    role,
    permissions,
  };
}

describe('management permission checks', () => {
  it.each(PERMISSION_CHECKS)(
    '$name allows its bit, denies every other bit, denies null permissions, and allows a superuser',
    ({ check, field, action }) => {
      const bit = CRUD_BITS[action];
      expect(check(userWith('admin', permissionsWith(field, bit)))).toBe(true);
      expect(check(userWith('admin', permissionsWith(field, CRUD_MASK_ALL - bit)))).toBe(false);
      expect(check(userWith('admin', null))).toBe(false);
      expect(check(userWith('superuser', null))).toBe(true);
    }
  );
});
