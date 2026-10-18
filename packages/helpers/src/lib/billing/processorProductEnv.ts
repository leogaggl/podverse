import type { BillingCadence } from '../billingDomain.js';

/**
 * PayPal Orders v2 has no product catalog, so Podverse names the one-time products itself.
 * Each order invoice id starts with one of these ids. The adapter reports that id as the
 * event's `externalProductId`, which maps the capture to its cadence.
 */
export const PAYPAL_ONE_TIME_PRODUCT_IDS = {
  monthly: 'podverse_premium_one_time_monthly',
  annual: 'podverse_premium_one_time_annual',
} as const satisfies Record<BillingCadence, string>;

/**
 * Strike receive requests also have no product catalog, so Podverse maps each cadence to a fixed
 * checkout product id.
 */
export const STRIKE_ONE_TIME_PRODUCT_IDS = {
  monthly: 'podverse-premium-monthly',
  annual: 'podverse-premium-annual',
} as const satisfies Record<BillingCadence, string>;
