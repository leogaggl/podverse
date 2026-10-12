/**
 * Where a checkout starts. Store builds must sell through their store, and `foss` (the F-Droid
 * build) ships without store billing libraries. PayPal or Strike on `ios` or `android` is a
 * link-out to web checkout, not an in-app invoice. Storefront policy checks are enforced when
 * checkout channels are saved.
 */
export const BILLING_PLATFORMS = ['web', 'ios', 'android', 'foss'] as const;

export type BillingPlatform = (typeof BILLING_PLATFORMS)[number];

export function isBillingPlatform(value: string): value is BillingPlatform {
  return BILLING_PLATFORMS.some((platform) => platform === value);
}
