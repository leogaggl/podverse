import { describe, expect, it } from 'vitest';

import { resolveNotificationsBellPress } from './notificationsBellPress';

describe('resolveNotificationsBellPress', () => {
  it('asks a signed-out user to sign in', () => {
    expect(
      resolveNotificationsBellPress({
        access: { allowed: true },
        isTierKnown: true,
        status: 'anonymous',
      })
    ).toEqual({ kind: 'gate', reason: 'needs_account' });
    expect(
      resolveNotificationsBellPress({
        access: { allowed: true },
        isTierKnown: true,
        status: 'unknown',
      })
    ).toEqual({ kind: 'gate', reason: 'needs_account' });
  });

  it('opens the inbox while a signed-in account snapshot is still loading', () => {
    expect(
      resolveNotificationsBellPress({
        access: { allowed: false, reason: 'needs_account', requiredTier: 'membership' },
        isTierKnown: false,
        status: 'authenticated',
      })
    ).toEqual({ kind: 'open' });
  });

  it('opens the inbox when notifications access is allowed', () => {
    expect(
      resolveNotificationsBellPress({
        access: { allowed: true },
        isTierKnown: true,
        status: 'authenticated',
      })
    ).toEqual({ kind: 'open' });
  });

  it('opens the membership gate when a known tier is denied', () => {
    expect(
      resolveNotificationsBellPress({
        access: { allowed: false, reason: 'needs_membership', requiredTier: 'membership' },
        isTierKnown: true,
        status: 'authenticated',
      })
    ).toEqual({ kind: 'gate', reason: 'needs_membership' });
    expect(
      resolveNotificationsBellPress({
        access: { allowed: false, reason: 'membership_expired', requiredTier: 'membership' },
        isTierKnown: true,
        status: 'authenticated',
      })
    ).toEqual({ kind: 'gate', reason: 'membership_expired' });
  });
});
