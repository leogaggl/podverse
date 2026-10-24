import { describe, expect, it } from 'vitest';

import type {
  PredefinedManagementAdminRole,
  PredefinedManagementAdminRoleId,
} from './constants.js';
import { getPredefinedManagementAdminRoleById } from './constants.js';

type CrudField = {
  [K in keyof PredefinedManagementAdminRole]: PredefinedManagementAdminRole[K] extends number
    ? K
    : never;
}[keyof PredefinedManagementAdminRole];

function roleById(id: PredefinedManagementAdminRoleId): PredefinedManagementAdminRole {
  const role = getPredefinedManagementAdminRoleById(id);
  if (role === undefined) {
    throw new Error(`Missing predefined management admin role ${id}`);
  }
  return role;
}

function crudMasks(role: PredefinedManagementAdminRole): Record<CrudField, number> {
  return {
    feedsCrud: role.feedsCrud,
    feedTakedownReasonsCrud: role.feedTakedownReasonsCrud,
    adminsCrud: role.adminsCrud,
    statsCrud: role.statsCrud,
    billingPricesCrud: role.billingPricesCrud,
    bucketCrud: role.bucketCrud,
    embedDemoCrud: role.embedDemoCrud,
    notificationsCrud: role.notificationsCrud,
    billingChannelsCrud: role.billingChannelsCrud,
    billingProcessorProductsCrud: role.billingProcessorProductsCrud,
    billingAccountCrud: role.billingAccountCrud,
    billingWebhookEventsCrud: role.billingWebhookEventsCrud,
  };
}

describe('PREDEFINED_MANAGEMENT_ADMIN_ROLES', () => {
  it('gives everything every action on every resource', () => {
    expect(crudMasks(roleById('everything'))).toEqual({
      feedsCrud: 15,
      feedTakedownReasonsCrud: 15,
      adminsCrud: 15,
      statsCrud: 15,
      billingPricesCrud: 15,
      bucketCrud: 15,
      embedDemoCrud: 15,
      notificationsCrud: 15,
      billingChannelsCrud: 15,
      billingProcessorProductsCrud: 15,
      billingAccountCrud: 15,
      billingWebhookEventsCrud: 15,
    });
  });

  it('gives read_everything read on every resource', () => {
    expect(crudMasks(roleById('read_everything'))).toEqual({
      feedsCrud: 2,
      feedTakedownReasonsCrud: 2,
      adminsCrud: 2,
      statsCrud: 2,
      billingPricesCrud: 2,
      bucketCrud: 2,
      embedDemoCrud: 2,
      notificationsCrud: 2,
      billingChannelsCrud: 2,
      billingProcessorProductsCrud: 2,
      billingAccountCrud: 2,
      billingWebhookEventsCrud: 2,
    });
  });

  it('gives storage_full every action on bucket and none elsewhere', () => {
    expect(crudMasks(roleById('storage_full'))).toEqual({
      feedsCrud: 0,
      feedTakedownReasonsCrud: 0,
      adminsCrud: 0,
      statsCrud: 0,
      billingPricesCrud: 0,
      bucketCrud: 15,
      embedDemoCrud: 0,
      notificationsCrud: 0,
      billingChannelsCrud: 0,
      billingProcessorProductsCrud: 0,
      billingAccountCrud: 0,
      billingWebhookEventsCrud: 0,
    });
  });

  it('gives admins_stats_read every action on admins and stats, and read elsewhere', () => {
    expect(crudMasks(roleById('admins_stats_read'))).toEqual({
      feedsCrud: 2,
      feedTakedownReasonsCrud: 2,
      adminsCrud: 15,
      statsCrud: 15,
      billingPricesCrud: 2,
      bucketCrud: 2,
      embedDemoCrud: 2,
      notificationsCrud: 2,
      billingChannelsCrud: 2,
      billingProcessorProductsCrud: 2,
      billingAccountCrud: 2,
      billingWebhookEventsCrud: 2,
    });
  });
});
