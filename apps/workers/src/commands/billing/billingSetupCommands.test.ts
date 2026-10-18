import { describe, expect, it } from 'vitest';

import { PAYPAL_ONE_TIME_PRODUCT_IDS, STRIKE_ONE_TIME_PRODUCT_IDS } from '@podverse/helpers';

import { parseCheckoutChannelEnableArgs } from './checkoutChannelEnableLib.js';
import { parseProcessorProductAddArgs } from './processorProductAddLib.js';

describe('parseProcessorProductAddArgs', () => {
  it('adds one Apple product', () => {
    const parsed = parseProcessorProductAddArgs({
      processor: 'apple',
      cadence: 'monthly',
      'product-id': ' com.example.monthly ',
    });
    expect(parsed).toEqual({
      ok: true,
      request: {
        kind: 'apply',
        mappings: [
          {
            processor: 'apple',
            cadence: 'monthly',
            externalProductId: 'com.example.monthly',
            externalBasePlanId: null,
          },
        ],
      },
    });
  });

  it('requires a Google Play base plan and rejects one on Apple', () => {
    expect(
      parseProcessorProductAddArgs({
        processor: 'google_play',
        cadence: 'annual',
        'product-id': 'premium',
      }).ok
    ).toBe(false);
    expect(
      parseProcessorProductAddArgs({
        processor: 'apple',
        cadence: 'annual',
        'product-id': 'com.example.annual',
        'base-plan-id': 'prepaid',
      }).ok
    ).toBe(false);

    const parsed = parseProcessorProductAddArgs({
      processor: 'google_play',
      cadence: 'monthly',
      'product-id': 'premium',
      'base-plan-id': 'prepaid-monthly',
      'dry-run': '',
    });
    expect(parsed).toEqual({
      ok: true,
      request: {
        kind: 'dry-run',
        mappings: [
          {
            processor: 'google_play',
            cadence: 'monthly',
            externalProductId: 'premium',
            externalBasePlanId: 'prepaid-monthly',
          },
        ],
      },
    });
  });

  it('adds the fixed PayPal and Strike ids with --defaults', () => {
    const paypal = parseProcessorProductAddArgs({ processor: 'paypal', defaults: '' });
    expect(paypal.ok).toBe(true);
    if (!paypal.ok || paypal.request.kind === 'help') {
      return;
    }
    expect(paypal.request.mappings.map((mapping) => mapping.externalProductId)).toEqual([
      PAYPAL_ONE_TIME_PRODUCT_IDS.monthly,
      PAYPAL_ONE_TIME_PRODUCT_IDS.annual,
    ]);

    const strike = parseProcessorProductAddArgs({ processor: 'strike', defaults: '' });
    expect(strike.ok).toBe(true);
    if (!strike.ok || strike.request.kind === 'help') {
      return;
    }
    expect(strike.request.mappings.map((mapping) => mapping.externalProductId)).toEqual([
      STRIKE_ONE_TIME_PRODUCT_IDS.monthly,
      STRIKE_ONE_TIME_PRODUCT_IDS.annual,
    ]);
  });

  it('rejects --defaults for other processors and mixed flags', () => {
    expect(parseProcessorProductAddArgs({ processor: 'apple', defaults: '' }).ok).toBe(false);
    expect(
      parseProcessorProductAddArgs({
        processor: 'paypal',
        defaults: '',
        'product-id': 'other',
      }).ok
    ).toBe(false);
  });
});

describe('parseCheckoutChannelEnableArgs', () => {
  it('enables one channel', () => {
    expect(
      parseCheckoutChannelEnableArgs({
        processor: 'apple',
        platform: 'ios',
        'dry-run': '',
      })
    ).toEqual({
      ok: true,
      request: { kind: 'dry-run', processorId: 'apple', platform: 'ios' },
    });
  });

  it('rejects an unknown platform', () => {
    expect(parseCheckoutChannelEnableArgs({ processor: 'apple', platform: 'desktop' }).ok).toBe(
      false
    );
  });
});
