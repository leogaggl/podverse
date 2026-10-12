import { describe, expect, it } from 'vitest';

import { PAYPAL_ONE_TIME_PRODUCT_IDS } from '@podverse/helpers';

import { buildPayPalInvoiceId, resolvePayPalProductId } from './payPalInvoiceId.js';

const PRODUCT_IDS = [PAYPAL_ONE_TIME_PRODUCT_IDS.monthly, PAYPAL_ONE_TIME_PRODUCT_IDS.annual];

describe('PayPal invoice ids', () => {
  it('treats a bare product id as that product', () => {
    expect(resolvePayPalProductId(PAYPAL_ONE_TIME_PRODUCT_IDS.monthly, PRODUCT_IDS)).toBe(
      PAYPAL_ONE_TIME_PRODUCT_IDS.monthly
    );
  });

  it('reads the product id from a unique invoice id', () => {
    const invoiceId = buildPayPalInvoiceId(
      PAYPAL_ONE_TIME_PRODUCT_IDS.annual,
      '11111111-1111-4111-8111-111111111111'
    );

    expect(resolvePayPalProductId(invoiceId, PRODUCT_IDS)).toBe(PAYPAL_ONE_TIME_PRODUCT_IDS.annual);
  });

  it('prefers the longer product id when one id prefixes another', () => {
    expect(resolvePayPalProductId('pod-verse-extra', ['pod', 'pod-verse'])).toBe('pod-verse');
  });

  it('returns null when the invoice id is not a sold product', () => {
    expect(resolvePayPalProductId('not-a-product', PRODUCT_IDS)).toBeNull();
    expect(resolvePayPalProductId(null, PRODUCT_IDS)).toBeNull();
  });
});
