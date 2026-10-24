import { describe, expect, it } from 'vitest';

import { AccountMembershipEnum } from './accountMembership.js';
import { membershipCountsTowardPopularity, membershipStoresListens } from './accountTrust.js';

describe('membershipStoresListens', () => {
  it('stores a trial listen whether or not trackStats is on', () => {
    expect(membershipStoresListens(AccountMembershipEnum.Trial, false)).toBe(true);
    expect(membershipStoresListens(AccountMembershipEnum.Trial, true)).toBe(true);
  });

  it('stores a premium listen only while trackStats is on', () => {
    expect(membershipStoresListens(AccountMembershipEnum.Premium, true)).toBe(true);
    expect(membershipStoresListens(AccountMembershipEnum.Premium, false)).toBe(false);
  });
});

describe('membershipCountsTowardPopularity', () => {
  it('leaves every trial listen out of popularity', () => {
    expect(membershipCountsTowardPopularity(AccountMembershipEnum.Trial, false)).toBe(false);
    expect(membershipCountsTowardPopularity(AccountMembershipEnum.Trial, true)).toBe(false);
  });

  it('counts a premium listen only while trackStats is on', () => {
    expect(membershipCountsTowardPopularity(AccountMembershipEnum.Premium, true)).toBe(true);
    expect(membershipCountsTowardPopularity(AccountMembershipEnum.Premium, false)).toBe(false);
  });
});
