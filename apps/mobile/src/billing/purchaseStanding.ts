import type { DTOAccount, DTOBillingEventOutcome, DTOBillingStatus } from '@podverse/helpers';
import { AccountMembershipEnum } from '@podverse/helpers';

import type { BillingPurchaseOutcome } from './BillingClient';

/**
 * Whether this post extended membership. A processed event did. A sandbox charge that was
 * recorded and not applied did not. A duplicate, or a post that omitted outcomes, does not say.
 */
export const membershipGrantedFromOutcomes = (
  outcomes: readonly DTOBillingEventOutcome[] | undefined
): boolean | null => {
  if (outcomes === undefined) {
    return null;
  }
  let granted = false;
  let ignored = false;
  for (const outcome of outcomes) {
    if (outcome.status === 'processed') {
      granted = true;
    } else if (outcome.status === 'ignored_sandbox') {
      ignored = true;
    }
  }
  if (granted) {
    return true;
  }
  if (ignored) {
    return false;
  }
  return null;
};

export const isBillingOutcomeStatus = (
  status: string
): status is DTOBillingEventOutcome['status'] =>
  status === 'processed' ||
  status === 'duplicate' ||
  status === 'ignored_sandbox' ||
  status === 'failed';

const membershipIdForTier = (tier: DTOBillingStatus['tier']): number | null => {
  if (tier === 'premium') {
    return AccountMembershipEnum.Premium;
  }
  if (tier === 'trial') {
    return AccountMembershipEnum.Trial;
  }
  return null;
};

/**
 * Copies primary billing standing onto the account snapshot. Limit fields already on the
 * snapshot stay. A tier the status does not name drops the membership row.
 */
export const accountWithBillingStatus = (
  account: DTOAccount,
  status: DTOBillingStatus
): DTOAccount => {
  const membershipId = membershipIdForTier(status.tier);
  const existing = account.account_membership_status;
  if (membershipId === null) {
    if (existing === undefined) {
      return account;
    }
    return { ...account, account_membership_status: undefined };
  }
  return {
    ...account,
    account_membership_status: {
      account_id: existing?.account_id ?? account.id,
      account_membership_id: membershipId,
      allow_directory_add_by_rss: existing?.allow_directory_add_by_rss ?? null,
      allow_notifications: existing?.allow_notifications ?? null,
      billing_cadence: status.billing_cadence,
      id: existing?.id ?? 0,
      last_extension_idempotency_key: existing?.last_extension_idempotency_key ?? null,
      max_add_by_rss_feeds: existing?.max_add_by_rss_feeds ?? null,
      max_manual_refreshes_per_hour: existing?.max_manual_refreshes_per_hour ?? null,
      membership_expires_at: status.membership_expires_at,
      track_stats: existing?.track_stats ?? null,
    },
  };
};

/**
 * Keeps the latest confirmed purchase when every settle confirmed, and keeps a worse phase
 * once one appears. A later confirmed settle replaces an earlier one so its standing is kept.
 */
export const preferPurchaseOutcome = (
  current: BillingPurchaseOutcome | null,
  next: BillingPurchaseOutcome
): BillingPurchaseOutcome => {
  if (current === null) {
    return next;
  }
  if (next.phase !== 'confirmed') {
    return next;
  }
  if (current.phase === 'confirmed') {
    return next;
  }
  return current;
};
