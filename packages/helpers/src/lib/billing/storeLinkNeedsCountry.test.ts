import { describe, expect, it } from 'vitest';

import { storeLinkNeedsCountry } from './storeLinkNeedsCountry.js';

describe('storeLinkNeedsCountry', () => {
  it('requires a country before a PayPal or Strike store listing is enabled', () => {
    expect(
      storeLinkNeedsCountry({
        processorId: 'paypal',
        platform: 'ios',
        enabled: true,
        storefrontAllowlist: [],
      })
    ).toBe(true);
    expect(
      storeLinkNeedsCountry({
        processorId: 'strike',
        platform: 'android',
        enabled: true,
        storefrontAllowlist: [],
      })
    ).toBe(true);
  });

  it('allows the listing once a storefront is set, and ignores a disabled channel', () => {
    expect(
      storeLinkNeedsCountry({
        processorId: 'paypal',
        platform: 'ios',
        enabled: true,
        storefrontAllowlist: ['US'],
      })
    ).toBe(false);
    expect(
      storeLinkNeedsCountry({
        processorId: 'strike',
        platform: 'android',
        enabled: false,
        storefrontAllowlist: [],
      })
    ).toBe(false);
  });

  it('does not apply to in-app stores or to web checkout', () => {
    expect(
      storeLinkNeedsCountry({
        processorId: 'apple',
        platform: 'ios',
        enabled: true,
        storefrontAllowlist: [],
      })
    ).toBe(false);
    expect(
      storeLinkNeedsCountry({
        processorId: 'paypal',
        platform: 'web',
        enabled: true,
        storefrontAllowlist: [],
      })
    ).toBe(false);
  });
});
