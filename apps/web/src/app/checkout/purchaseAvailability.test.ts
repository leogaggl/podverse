import { describe, expect, it } from 'vitest';

import { hasWebPurchasableProcessor, webCheckoutMethods } from './purchaseAvailability';

describe('hasWebPurchasableProcessor', () => {
  it('is false when no processor is listed', () => {
    expect(hasWebPurchasableProcessor({ paypalClientId: 'client', processorIds: [] })).toBe(false);
  });

  it('is false when PayPal is listed and the client id is empty', () => {
    expect(hasWebPurchasableProcessor({ paypalClientId: '', processorIds: ['paypal'] })).toBe(
      false
    );
  });

  it('is true when PayPal is listed and a client id is set', () => {
    expect(hasWebPurchasableProcessor({ paypalClientId: 'client', processorIds: ['paypal'] })).toBe(
      true
    );
  });

  it('is true when only the test processor is listed', () => {
    expect(hasWebPurchasableProcessor({ paypalClientId: '', processorIds: ['test'] })).toBe(true);
  });

  it('is true when only Strike is listed', () => {
    expect(hasWebPurchasableProcessor({ paypalClientId: '', processorIds: ['strike'] })).toBe(true);
  });

  it('is false when only unknown processor ids are listed', () => {
    expect(
      hasWebPurchasableProcessor({
        paypalClientId: 'client',
        processorIds: ['apple', 'google_play'],
      })
    ).toBe(false);
  });
});

describe('webCheckoutMethods', () => {
  it('lists PayPal and Lightning when both can be used', () => {
    expect(webCheckoutMethods({ paypalPurchasable: true, strikeOffered: true })).toEqual([
      'paypal',
      'strike',
    ]);
  });

  it('lists the one method that can be used', () => {
    expect(webCheckoutMethods({ paypalPurchasable: true, strikeOffered: false })).toEqual([
      'paypal',
    ]);
    expect(webCheckoutMethods({ paypalPurchasable: false, strikeOffered: true })).toEqual([
      'strike',
    ]);
  });

  it('lists nothing when neither PayPal nor Lightning can be used', () => {
    expect(webCheckoutMethods({ paypalPurchasable: false, strikeOffered: false })).toEqual([]);
  });
});
