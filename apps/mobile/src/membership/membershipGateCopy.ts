import type { AccessDenialReason, MembershipTier } from '@podverse/helpers';
import { membershipPurchaseAction, membershipPurchaseMessageKey } from '@podverse/helpers';

export type MembershipGateConfirmDestination = 'login' | 'membership';

export type MembershipGateMessageKeys = {
  bodyKey: string;
  titleKey: string;
};

type PurchaseLabelMembership = {
  isLoggedIn: boolean;
  tier: MembershipTier | null;
};

/**
 * Reason → modal/notice i18n keys. Every denial has its own pair. There is no default branch.
 * The expired body follows tier: Premium extends, every other tier buys.
 */
export function membershipGateMessageKeys(
  reason: AccessDenialReason,
  tier: MembershipTier | null
): MembershipGateMessageKeys {
  switch (reason) {
    case 'limit_reached':
      return {
        bodyKey: 'membership.gate.body_limit',
        titleKey: 'membership.gate.title_limit',
      };
    case 'membership_expired':
      return {
        bodyKey:
          tier === 'premium'
            ? 'membership.gate.body_expired_premium'
            : 'membership.gate.body_expired_trial',
        titleKey: 'membership.gate.title_expired',
      };
    case 'needs_account':
      return {
        bodyKey: 'membership.gate.body_needs_account',
        titleKey: 'membership.gate.title_needs_account',
      };
    case 'needs_membership':
      return {
        bodyKey: 'membership.gate.body_premium',
        titleKey: 'membership.gate.title_premium',
      };
  }
}

function purchaseLabelKey(membership: PurchaseLabelMembership): string {
  return `membership.${membershipPurchaseMessageKey(membershipPurchaseAction(membership))}`;
}

/**
 * Confirm control on the shared gate modal. `needs_account` is Login and does not use the
 * purchase helper. Every other reason is Sign Up, Buy Membership, or Extend Membership from tier.
 */
export function membershipGateConfirmLabelKey(
  reason: AccessDenialReason,
  membership: PurchaseLabelMembership
): string {
  switch (reason) {
    case 'needs_account':
      return 'authentication.login';
    case 'limit_reached':
    case 'membership_expired':
    case 'needs_membership':
      return purchaseLabelKey(membership);
  }
}

export function membershipGateConfirmTestID(reason: AccessDenialReason): string {
  switch (reason) {
    case 'needs_account':
      return 'premium-gate-login';
    case 'limit_reached':
    case 'membership_expired':
    case 'needs_membership':
      return 'premium-gate-renew';
  }
}

export function membershipGateConfirmDestination(
  reason: AccessDenialReason
): MembershipGateConfirmDestination {
  switch (reason) {
    case 'needs_account':
      return 'login';
    case 'limit_reached':
    case 'membership_expired':
    case 'needs_membership':
      return 'membership';
  }
}

/**
 * Primary action on the inline notice. Same destinations and labels as the modal.
 */
export function membershipGateNoticeActionKey(
  reason: AccessDenialReason,
  membership: PurchaseLabelMembership
): string {
  return membershipGateConfirmLabelKey(reason, membership);
}
