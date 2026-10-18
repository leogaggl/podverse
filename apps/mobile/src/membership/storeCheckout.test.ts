import { describe, expect, it } from 'vitest';

import {
  availableCadences,
  cadenceAfterGrantedCheckout,
  checkoutOptionsRequest,
  checkoutPlanProcessorId,
  checkoutProduct,
  isClientUpdateRequired,
  mapCheckoutProcessors,
  offersProcessor,
  PLAY_PACKAGE_NAME,
  resolveStoreCheckoutMode,
  showsStrikeInvoice,
  showsStrikeWebLink,
  storeListingUrl,
  storeProcessorId,
} from './storeCheckout';

const options = mapCheckoutProcessors({
  processors: [
    {
      processor_id: 'test',
      products: [
        {
          cadence: 'monthly',
          external_base_plan_id: null,
          external_product_id: 'e2e-test-monthly',
          id: 1,
        },
        {
          cadence: 'monthly',
          external_base_plan_id: 'prepaid-monthly',
          external_product_id: 'e2e-test-monthly-extra',
          id: 3,
        },
        {
          cadence: 'weekly',
          external_base_plan_id: null,
          external_product_id: 'ignored',
          id: 4,
        },
        {
          cadence: 'annual',
          external_base_plan_id: 'prepaid-annual',
          external_product_id: 'premium',
          id: 5,
        },
      ],
    },
    {
      processor_id: 'paypal',
      products: [],
    },
  ],
});

describe('store checkout selection', () => {
  it('maps the fake client onto the test processor and keeps the first product for a cadence', () => {
    expect(storeProcessorId('fake')).toBe('test');
    expect(storeProcessorId('unavailable')).toBeNull();
    expect(options[0]?.products).toHaveLength(3);
    expect(checkoutProduct(options, 'test', 'monthly')).toMatchObject({
      externalProductId: 'e2e-test-monthly',
    });
    expect(checkoutProduct(options, 'test', 'annual')).toMatchObject({
      basePlanId: 'prepaid-annual',
      externalProductId: 'premium',
    });
    expect(availableCadences(options, 'test')).toEqual(['monthly', 'annual']);
  });

  it('shows PayPal only when checkout options include that processor', () => {
    expect(offersProcessor(options, 'paypal')).toBe(true);
    expect(offersProcessor(options, 'apple')).toBe(false);
  });

  it('uses contact mode only when this platform has no store processor, PayPal, or Strike', () => {
    const none = mapCheckoutProcessors({ processors: [] });
    const storeOnly = mapCheckoutProcessors({
      processors: [{ processor_id: 'test', products: [] }],
    });
    const paypalOnly = mapCheckoutProcessors({
      processors: [{ processor_id: 'paypal', products: [] }],
    });
    const strikeOnly = mapCheckoutProcessors({
      processors: [{ processor_id: 'strike', products: [] }],
    });
    const both = mapCheckoutProcessors({
      processors: [
        { processor_id: 'test', products: [] },
        { processor_id: 'paypal', products: [] },
      ],
    });

    expect(resolveStoreCheckoutMode({ backend: 'fake', processors: none })).toBe('contact');
    expect(resolveStoreCheckoutMode({ backend: 'unavailable', processors: none })).toBe('contact');
    expect(resolveStoreCheckoutMode({ backend: 'fake', processors: storeOnly })).toBe('purchase');
    expect(resolveStoreCheckoutMode({ backend: 'fake', processors: paypalOnly })).toBe('purchase');
    expect(resolveStoreCheckoutMode({ backend: 'fake', processors: both })).toBe('purchase');
    expect(resolveStoreCheckoutMode({ backend: 'unavailable', processors: strikeOnly })).toBe(
      'purchase'
    );
    expect(resolveStoreCheckoutMode({ backend: 'storekit', processors: strikeOnly })).toBe(
      'purchase'
    );
  });

  it('requests foss checkout options only for the unavailable backend', () => {
    expect(
      checkoutOptionsRequest({
        backend: 'unavailable',
        devicePlatform: 'ios',
        storefront: 'US',
      })
    ).toEqual({ platform: 'foss', storefront: null });
    expect(
      checkoutOptionsRequest({
        backend: 'fake',
        devicePlatform: 'ios',
        storefront: 'US',
      })
    ).toEqual({ platform: 'ios', storefront: 'US' });
    expect(
      checkoutOptionsRequest({
        backend: 'storekit',
        devicePlatform: 'ios',
        storefront: 'US',
      })
    ).toEqual({ platform: 'ios', storefront: 'US' });
    expect(
      checkoutOptionsRequest({
        backend: 'play',
        devicePlatform: 'android',
        storefront: null,
      })
    ).toEqual({ platform: 'android', storefront: null });
    expect(
      checkoutOptionsRequest({
        backend: 'play',
        devicePlatform: null,
        storefront: 'US',
      })
    ).toBeNull();
  });

  it('keeps the store link separate from the in-app invoice', () => {
    expect(showsStrikeInvoice({ backend: 'unavailable', strikeOffered: true })).toBe(true);
    expect(showsStrikeInvoice({ backend: 'fake', strikeOffered: true })).toBe(false);
    expect(showsStrikeInvoice({ backend: 'storekit', strikeOffered: true })).toBe(false);
    expect(showsStrikeInvoice({ backend: 'unavailable', strikeOffered: false })).toBe(false);

    expect(showsStrikeWebLink({ backend: 'storekit', strikeOffered: true })).toBe(true);
    expect(showsStrikeWebLink({ backend: 'play', strikeOffered: true })).toBe(true);
    expect(showsStrikeWebLink({ backend: 'fake', strikeOffered: true })).toBe(true);
    expect(showsStrikeWebLink({ backend: 'unavailable', strikeOffered: true })).toBe(false);
    expect(showsStrikeWebLink({ backend: 'play', strikeOffered: false })).toBe(false);

    const strike = mapCheckoutProcessors({
      processors: [{ processor_id: 'strike', products: [] }],
    });
    expect(checkoutPlanProcessorId('test', strike)).toBe('test');
    expect(checkoutPlanProcessorId(null, strike)).toBe('strike');
    expect(checkoutPlanProcessorId(null, [])).toBeNull();
  });

  it('picks the success-screen cadence from the purchase or the restored account', () => {
    expect(cadenceAfterGrantedCheckout('purchase', 'annual', 'monthly')).toBe('annual');
    expect(cadenceAfterGrantedCheckout('purchase', null, 'monthly')).toBeNull();
    expect(cadenceAfterGrantedCheckout('restore', 'annual', 'monthly')).toBe('monthly');
    expect(cadenceAfterGrantedCheckout('restore', 'monthly', null)).toBeNull();
    expect(cadenceAfterGrantedCheckout('restore', null, 'weekly')).toBeNull();
  });

  it('treats the update-required code as the store-update prompt', () => {
    expect(isClientUpdateRequired('billing.client_update_required')).toBe(true);
    expect(isClientUpdateRequired('billing.purchase_failed')).toBe(false);
    expect(isClientUpdateRequired(null)).toBe(false);
  });

  it('points update links at the store for that platform', () => {
    expect(storeListingUrl('ios')).toContain('apps.apple.com');
    expect(storeListingUrl('android')).toContain(PLAY_PACKAGE_NAME);
  });
});
