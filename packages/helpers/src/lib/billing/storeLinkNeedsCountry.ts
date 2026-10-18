/**
 * PayPal and Strike on iOS or Android open a store listing. Enabling that listing requires at
 * least one storefront country. Other processor and platform pairs sell in the app or on the web
 * and may stay enabled with an empty list, which means every storefront.
 */
export function storeLinkNeedsCountry(params: {
  processorId: string;
  platform: string;
  enabled: boolean;
  storefrontAllowlist: readonly string[];
}): boolean {
  const isStoreLink =
    (params.processorId === 'paypal' || params.processorId === 'strike') &&
    (params.platform === 'ios' || params.platform === 'android');
  return isStoreLink && params.enabled && params.storefrontAllowlist.length === 0;
}
