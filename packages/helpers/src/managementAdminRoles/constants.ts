import { CRUD_BITS, CRUD_MASK_ALL, CRUD_MASK_NONE } from '../lib/crudBitmask.js';

/**
 * Predefined Podverse management-admin roles (templates). Custom roles are stored in
 * `management_admin_role` (management DB).
 * CRUD masks use `CRUD_BITS` in `lib/crudBitmask.ts`.
 * Billing actions reuse those bits: account resync and webhook replay need update; a manual
 * membership grant needs `billingAccountCrud` create.
 */
export const PREDEFINED_MANAGEMENT_ADMIN_ROLE_IDS = [
  'everything',
  'read_everything',
  'feeds_moderation',
  'admins_stats_read',
  'storage_full',
] as const;

export type PredefinedManagementAdminRoleId = (typeof PREDEFINED_MANAGEMENT_ADMIN_ROLE_IDS)[number];

export type PredefinedManagementAdminRole = {
  id: PredefinedManagementAdminRoleId;
  nameKey: string;
  feedsCrud: number;
  feedTakedownReasonsCrud: number;
  adminsCrud: number;
  statsCrud: number;
  billingPricesCrud: number;
  bucketCrud: number;
  embedDemoCrud: number;
  notificationsCrud: number;
  billingChannelsCrud: number;
  billingProcessorProductsCrud: number;
  billingAccountCrud: number;
  billingWebhookEventsCrud: number;
};

export const PREDEFINED_MANAGEMENT_ADMIN_ROLES: PredefinedManagementAdminRole[] = [
  {
    id: 'everything',
    nameKey: 'managementAdminRoles.everything',
    feedsCrud: CRUD_MASK_ALL,
    feedTakedownReasonsCrud: CRUD_MASK_ALL,
    adminsCrud: CRUD_MASK_ALL,
    statsCrud: CRUD_MASK_ALL,
    billingPricesCrud: CRUD_MASK_ALL,
    bucketCrud: CRUD_MASK_ALL,
    embedDemoCrud: CRUD_MASK_ALL,
    notificationsCrud: CRUD_MASK_ALL,
    billingChannelsCrud: CRUD_MASK_ALL,
    billingProcessorProductsCrud: CRUD_MASK_ALL,
    billingAccountCrud: CRUD_MASK_ALL,
    billingWebhookEventsCrud: CRUD_MASK_ALL,
  },
  {
    id: 'read_everything',
    nameKey: 'managementAdminRoles.readEverything',
    feedsCrud: CRUD_BITS.read,
    feedTakedownReasonsCrud: CRUD_BITS.read,
    adminsCrud: CRUD_BITS.read,
    statsCrud: CRUD_BITS.read,
    billingPricesCrud: CRUD_BITS.read,
    bucketCrud: CRUD_BITS.read,
    embedDemoCrud: CRUD_BITS.read,
    notificationsCrud: CRUD_BITS.read,
    billingChannelsCrud: CRUD_BITS.read,
    billingProcessorProductsCrud: CRUD_BITS.read,
    billingAccountCrud: CRUD_BITS.read,
    billingWebhookEventsCrud: CRUD_BITS.read,
  },
  {
    id: 'feeds_moderation',
    nameKey: 'managementAdminRoles.feedsModeration',
    feedsCrud: CRUD_MASK_ALL,
    feedTakedownReasonsCrud: CRUD_MASK_ALL,
    adminsCrud: CRUD_MASK_NONE,
    statsCrud: CRUD_MASK_NONE,
    billingPricesCrud: CRUD_MASK_NONE,
    bucketCrud: CRUD_MASK_NONE,
    embedDemoCrud: CRUD_MASK_NONE,
    notificationsCrud: CRUD_MASK_NONE,
    billingChannelsCrud: CRUD_MASK_NONE,
    billingProcessorProductsCrud: CRUD_MASK_NONE,
    billingAccountCrud: CRUD_MASK_NONE,
    billingWebhookEventsCrud: CRUD_MASK_NONE,
  },
  {
    id: 'admins_stats_read',
    nameKey: 'managementAdminRoles.adminsStatsRead',
    feedsCrud: CRUD_BITS.read,
    feedTakedownReasonsCrud: CRUD_BITS.read,
    adminsCrud: CRUD_MASK_ALL,
    statsCrud: CRUD_MASK_ALL,
    billingPricesCrud: CRUD_BITS.read,
    bucketCrud: CRUD_BITS.read,
    embedDemoCrud: CRUD_BITS.read,
    notificationsCrud: CRUD_BITS.read,
    billingChannelsCrud: CRUD_BITS.read,
    billingProcessorProductsCrud: CRUD_BITS.read,
    billingAccountCrud: CRUD_BITS.read,
    billingWebhookEventsCrud: CRUD_BITS.read,
  },
  {
    id: 'storage_full',
    nameKey: 'managementAdminRoles.storageFull',
    feedsCrud: CRUD_MASK_NONE,
    feedTakedownReasonsCrud: CRUD_MASK_NONE,
    adminsCrud: CRUD_MASK_NONE,
    statsCrud: CRUD_MASK_NONE,
    billingPricesCrud: CRUD_MASK_NONE,
    bucketCrud: CRUD_MASK_ALL,
    embedDemoCrud: CRUD_MASK_NONE,
    notificationsCrud: CRUD_MASK_NONE,
    billingChannelsCrud: CRUD_MASK_NONE,
    billingProcessorProductsCrud: CRUD_MASK_NONE,
    billingAccountCrud: CRUD_MASK_NONE,
    billingWebhookEventsCrud: CRUD_MASK_NONE,
  },
];

export function getPredefinedManagementAdminRoleById(
  id: string
): PredefinedManagementAdminRole | undefined {
  return PREDEFINED_MANAGEMENT_ADMIN_ROLES.find((role) => role.id === id);
}

export function isPredefinedManagementAdminRoleId(id: string): boolean {
  return getPredefinedManagementAdminRoleById(id) !== undefined;
}
