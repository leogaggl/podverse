import { describe, expect, it } from 'vitest';

import type { DTOAccount } from '@podverse/helpers';
import { SharableStatusEnum } from '@podverse/helpers';

import {
  applyAccountProfileUpdate,
  buildAccountProfileUpdatePayload,
  toSharableStatus,
} from './profileUpdate';

function makeAccount(): DTOAccount {
  return {
    account_credentials: {
      account_id: 7,
      email: 'old@example.com',
      id: 1,
      password: '',
    },
    account_membership_status: {
      account_id: 7,
      account_membership_id: 4,
      allow_directory_add_by_rss: null,
      allow_notifications: null,
      billing_cadence: null,
      id: 9,
      last_extension_idempotency_key: null,
      max_add_by_rss_feeds: null,
      max_manual_refreshes_per_hour: null,
      membership_expires_at: '2030-01-01T00:00:00.000Z',
      track_stats: null,
    },
    account_profile: {
      account_id: 7,
      bio: 'Old bio',
      display_name: 'Old',
      id: 3,
    },
    id: 7,
    id_text: 'accttext',
    sharable_status_id: SharableStatusEnum.Private,
    verified: true,
  };
}

describe('buildAccountProfileUpdatePayload', () => {
  it('turns a blank display name and bio into null and keeps the locale', () => {
    expect(
      buildAccountProfileUpdatePayload({
        bio: '   ',
        displayName: '  ',
        locale: 'fr',
        sharableStatus: SharableStatusEnum.Public,
      }),
    ).toEqual({
      bio: null,
      display_name: null,
      locale: 'fr',
      sharable_status: SharableStatusEnum.Public,
    });
  });

  it('trims a display name and bio', () => {
    expect(
      buildAccountProfileUpdatePayload({
        bio: '  About me  ',
        displayName: '  Ada  ',
        locale: 'en-US',
        sharableStatus: SharableStatusEnum.Unlisted,
      }),
    ).toEqual({
      bio: 'About me',
      display_name: 'Ada',
      locale: 'en-US',
      sharable_status: SharableStatusEnum.Unlisted,
    });
  });
});

describe('toSharableStatus', () => {
  it('keeps a known status and treats anything else as private', () => {
    expect(toSharableStatus(SharableStatusEnum.Public)).toBe(SharableStatusEnum.Public);
    expect(toSharableStatus(SharableStatusEnum.Unlisted)).toBe(SharableStatusEnum.Unlisted);
    expect(toSharableStatus(undefined)).toBe(SharableStatusEnum.Private);
    expect(toSharableStatus(99)).toBe(SharableStatusEnum.Private);
  });
});

describe('applyAccountProfileUpdate', () => {
  it('updates the profile and keeps membership and credentials', () => {
    const account = makeAccount();
    const payload = buildAccountProfileUpdatePayload({
      bio: '',
      displayName: '  ',
      locale: 'fr',
      sharableStatus: SharableStatusEnum.Public,
    });

    const next = applyAccountProfileUpdate(account, payload);

    expect(next.account_credentials).toBe(account.account_credentials);
    expect(next.account_membership_status).toBe(account.account_membership_status);
    expect(next.id_text).toBe('accttext');
    expect(next.verified).toBe(true);
    expect(next.sharable_status_id).toBe(SharableStatusEnum.Public);
    expect(next.account_profile).toEqual({
      account_id: 7,
      bio: null,
      display_name: null,
      id: 3,
    });
  });

  it('fills profile ids from the account when the loaded profile is missing', () => {
    const account = makeAccount();
    const withoutProfile: DTOAccount = {
      ...account,
      account_profile: undefined,
    };
    const payload = buildAccountProfileUpdatePayload({
      bio: 'Hello',
      displayName: 'Ada',
      locale: 'en-US',
      sharableStatus: SharableStatusEnum.Private,
    });

    const next = applyAccountProfileUpdate(withoutProfile, payload);

    expect(next.account_profile).toEqual({
      account_id: 7,
      bio: 'Hello',
      display_name: 'Ada',
      id: 7,
    });
  });
});
