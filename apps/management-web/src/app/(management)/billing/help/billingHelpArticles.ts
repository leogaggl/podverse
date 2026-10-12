export const BILLING_HELP_SLUGS = [
  'gifting',
  'apple-refunds',
  'strike-refunds',
  'resync',
  'wrong-account',
] as const;

export type BillingHelpSlug = (typeof BILLING_HELP_SLUGS)[number];

const TITLE_KEYS = {
  gifting: 'giftingTitle',
  'apple-refunds': 'appleRefundsTitle',
  'strike-refunds': 'strikeRefundsTitle',
  resync: 'resyncTitle',
  'wrong-account': 'wrongAccountTitle',
} as const;

const BODY_KEYS = {
  gifting: 'giftingBody',
  'apple-refunds': 'appleRefundsBody',
  'strike-refunds': 'strikeRefundsBody',
  resync: 'resyncBody',
  'wrong-account': 'wrongAccountBody',
} as const;

export function isBillingHelpSlug(value: string): value is BillingHelpSlug {
  return BILLING_HELP_SLUGS.some((slug) => slug === value);
}

export function billingHelpTitleKey(slug: BillingHelpSlug): (typeof TITLE_KEYS)[BillingHelpSlug] {
  return TITLE_KEYS[slug];
}

export function billingHelpBodyKey(slug: BillingHelpSlug): (typeof BODY_KEYS)[BillingHelpSlug] {
  return BODY_KEYS[slug];
}
