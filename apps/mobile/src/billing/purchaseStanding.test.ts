import { describe, expect, it } from 'vitest';

import type { DTOAccount, DTOBillingStatus } from '@podverse/helpers';
import { AccountMembershipEnum } from '@podverse/helpers';

import { billingPurchaseOutcome } from './BillingClient';
import {
  accountWithBillingStatus,
  membershipGrantedFromOutcomes,
  preferPurchaseOutcome,
} from './purchaseStanding';

const standing = (
  tier: DTOBillingStatus['tier'],
  membershipExpiresAt: string | null
): DTOBillingStatus => ({
  billing_cadence: 'monthly',
  billing_customer_ref: 'ref',
  in_grace_period: false,
  is_entitled: tier !== null,
  membership_expires_at: membershipExpiresAt,
  tier,
});

const account = (membership?: DTOAccount['account_membership_status']): DTOAccount => ({
  id: 7,
  id_text: 'acct',
  verified: true,
  ...(membership !== undefined ? { account_membership_status: membership } : {}),
});

describe('membershipGrantedFromOutcomes', () => {
  it('treats a processed event as a grant and a sandbox ignore as not applied', () => {
    expect(membershipGrantedFromOutcomes(undefined)).toBeNull();
    expect(membershipGrantedFromOutcomes([])).toBeNull();
    expect(membershipGrantedFromOutcomes([{ error_code: null, status: 'duplicate' }])).toBeNull();
    expect(membershipGrantedFromOutcomes([{ error_code: null, status: 'processed' }])).toBe(true);
    expect(membershipGrantedFromOutcomes([{ error_code: null, status: 'ignored_sandbox' }])).toBe(
      false
    );
    expect(
      membershipGrantedFromOutcomes([
        { error_code: null, status: 'ignored_sandbox' },
        { error_code: null, status: 'processed' },
      ])
    ).toBe(true);
  });
});

describe('accountWithBillingStatus', () => {
  it('writes the primary tier and expiry over the snapshot', () => {
    const next = accountWithBillingStatus(
      account({
        account_id: 7,
        account_membership_id: AccountMembershipEnum.Trial,
        allow_directory_add_by_rss: true,
        allow_notifications: null,
        billing_cadence: null,
        id: 3,
        last_extension_idempotency_key: 'key',
        max_add_by_rss_feeds: 4,
        max_manual_refreshes_per_hour: 2,
        membership_expires_at: '2026-01-01T00:00:00.000Z',
        track_stats: null,
      }),
      standing('premium', '2026-02-01T00:00:00.000Z')
    );
    expect(next.account_membership_status).toMatchObject({
      account_membership_id: AccountMembershipEnum.Premium,
      allow_directory_add_by_rss: true,
      id: 3,
      last_extension_idempotency_key: 'key',
      max_add_by_rss_feeds: 4,
      membership_expires_at: '2026-02-01T00:00:00.000Z',
    });
  });

  it('leaves an account with no membership row unchanged when the status names no tier', () => {
    const current = account();
    expect(accountWithBillingStatus(current, standing(null, null))).toBe(current);
  });

  it('drops a membership row when the primary status names no tier', () => {
    const next = accountWithBillingStatus(
      account({
        account_id: 7,
        account_membership_id: AccountMembershipEnum.Trial,
        allow_directory_add_by_rss: null,
        allow_notifications: null,
        billing_cadence: null,
        id: 3,
        last_extension_idempotency_key: null,
        max_add_by_rss_feeds: null,
        max_manual_refreshes_per_hour: null,
        membership_expires_at: '2026-01-01T00:00:00.000Z',
        track_stats: null,
      }),
      standing(null, null)
    );
    expect(next.account_membership_status).toBeUndefined();
  });
});

describe('preferPurchaseOutcome', () => {
  it('keeps a later confirmed settle and a worse phase', () => {
    const first = billingPurchaseOutcome('confirmed', 'monthly', 'tx-1');
    const granted = billingPurchaseOutcome('confirmed', 'monthly', 'tx-1', null, {
      billingStatus: standing('premium', '2026-02-01T00:00:00.000Z'),
      membershipGranted: true,
    });
    expect(preferPurchaseOutcome(null, first)).toBe(first);
    expect(preferPurchaseOutcome(first, granted)).toBe(granted);
    const failed = billingPurchaseOutcome('failed', 'monthly', 'tx-2', 'billing.failed');
    expect(preferPurchaseOutcome(granted, failed)).toBe(failed);
    expect(preferPurchaseOutcome(failed, granted)).toBe(failed);
  });
});
