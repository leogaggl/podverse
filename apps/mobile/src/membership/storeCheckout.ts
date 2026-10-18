import type { BillingCadence, BillingPlatform, DTOBillingCheckoutOptions } from '@podverse/helpers';

import type { BillingBackend } from '../billing/BillingClient';

/** `billing.client_update_required` from a 426 purchase response. */
export const BILLING_CLIENT_UPDATE_REQUIRED = 'billing.client_update_required';

/** Published Podverse App Store listing. */
export const APP_STORE_LISTING_URL = 'https://apps.apple.com/us/app/podverse/id1390888454?mt=8';

/** This app's Play package. */
export const PLAY_PACKAGE_NAME = 'com.podverse.app.next';

export const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_NAME}`;

export type StoreCheckoutCadence = BillingCadence;

export type CheckoutProductOffer = {
  id: number;
  cadence: StoreCheckoutCadence;
  externalProductId: string;
  /** Google Play base plan id; null for other processors. */
  basePlanId: string | null;
};

export type CheckoutProcessorOffer = {
  processorId: string;
  products: readonly CheckoutProductOffer[];
};

export type CheckoutOptionsShape = {
  processors: readonly {
    processor_id: string;
    products: readonly {
      id: number;
      cadence: string;
      external_product_id: string;
      external_base_plan_id?: string | null;
    }[];
  }[];
};

const isCadence = (value: string): value is StoreCheckoutCadence =>
  value === 'monthly' || value === 'annual';

const CADENCE_ORDER: readonly StoreCheckoutCadence[] = ['monthly', 'annual'];

/** Store processor for this billing backend. PayPal is offered separately. */
export const storeProcessorId = (
  backend: BillingBackend
): 'apple' | 'google_play' | 'test' | null => {
  switch (backend) {
    case 'storekit':
      return 'apple';
    case 'play':
      return 'google_play';
    case 'fake':
      return 'test';
    case 'unavailable':
      return null;
  }
};

export const mapCheckoutProcessors = (
  options: CheckoutOptionsShape | DTOBillingCheckoutOptions
): CheckoutProcessorOffer[] =>
  options.processors.map((processor) => ({
    processorId: processor.processor_id,
    products: processor.products.flatMap((product) => {
      if (!isCadence(product.cadence)) {
        return [];
      }
      return [
        {
          basePlanId: product.external_base_plan_id ?? null,
          cadence: product.cadence,
          externalProductId: product.external_product_id,
          id: product.id,
        },
      ];
    }),
  }));

export const offersProcessor = (
  processors: readonly CheckoutProcessorOffer[],
  processorId: string
): boolean => processors.some((processor) => processor.processorId === processorId);

export type StoreCheckoutMode = 'purchase' | 'contact';

/**
 * Purchase when this platform's store, PayPal, or Strike is offered. Otherwise ask the member
 * to contact the team.
 */
export const resolveStoreCheckoutMode = (params: {
  processors: readonly CheckoutProcessorOffer[];
  backend: BillingBackend;
}): StoreCheckoutMode => {
  const storeId = storeProcessorId(params.backend);
  const storeOffered = storeId !== null && offersProcessor(params.processors, storeId);
  if (
    storeOffered ||
    offersProcessor(params.processors, 'paypal') ||
    offersProcessor(params.processors, 'strike')
  ) {
    return 'purchase';
  }
  return 'contact';
};

export type CheckoutOptionsRequest = {
  platform: BillingPlatform;
  storefront: string | null;
};

/**
 * Unavailable billing reads the `foss` channel and ignores the device storefront. StoreKit, Play,
 * and the E2E fake client keep the device platform and the storefront the store returns.
 */
export const checkoutOptionsRequest = (params: {
  backend: BillingBackend;
  devicePlatform: 'android' | 'ios' | null;
  storefront: string | null;
}): CheckoutOptionsRequest | null => {
  if (params.backend === 'unavailable') {
    return { platform: 'foss', storefront: null };
  }
  if (params.devicePlatform === null) {
    return null;
  }
  return { platform: params.devicePlatform, storefront: params.storefront };
};

/**
 * The store processor when this backend has one. Otherwise Strike, so the unavailable build can
 * choose a monthly or annual invoice.
 */
export const checkoutPlanProcessorId = (
  storeId: 'apple' | 'google_play' | 'test' | null,
  processors: readonly CheckoutProcessorOffer[]
): string | null => {
  if (storeId !== null) {
    return storeId;
  }
  if (offersProcessor(processors, 'strike')) {
    return 'strike';
  }
  return null;
};

/** In-app Lightning invoice. Only the unavailable-billing build. */
export const showsStrikeInvoice = (params: {
  backend: BillingBackend;
  strikeOffered: boolean;
}): boolean => params.strikeOffered && params.backend === 'unavailable';

/** Link that opens web checkout. Store backends only, and only when Strike is offered. */
export const showsStrikeWebLink = (params: {
  backend: BillingBackend;
  strikeOffered: boolean;
}): boolean => params.strikeOffered && params.backend !== 'unavailable';

/** The product checkout buys for this processor and cadence. When several match, the first one is used. */
export const checkoutProduct = (
  processors: readonly CheckoutProcessorOffer[],
  processorId: string,
  cadence: StoreCheckoutCadence
): CheckoutProductOffer | null => {
  const processor = processors.find((item) => item.processorId === processorId);
  if (processor === undefined) {
    return null;
  }
  return processor.products.find((product) => product.cadence === cadence) ?? null;
};

export const availableCadences = (
  processors: readonly CheckoutProcessorOffer[],
  processorId: string
): StoreCheckoutCadence[] =>
  CADENCE_ORDER.filter((cadence) => checkoutProduct(processors, processorId, cadence) !== null);

export const isClientUpdateRequired = (errorCode: string | null): boolean =>
  errorCode === BILLING_CLIENT_UPDATE_REQUIRED;

/**
 * Cadence for the success screen after a grant. A purchase uses the plan just bought. A restore
 * uses the cadence now on the account, which is the plan the store applied.
 */
export const cadenceAfterGrantedCheckout = (
  source: 'purchase' | 'restore',
  selectedCadence: StoreCheckoutCadence | null,
  accountCadence: string | null
): StoreCheckoutCadence | null => {
  if (source === 'purchase') {
    return selectedCadence;
  }
  if (accountCadence === 'monthly' || accountCadence === 'annual') {
    return accountCadence;
  }
  return null;
};

export const storeListingUrl = (platform: 'android' | 'ios'): string =>
  platform === 'ios' ? APP_STORE_LISTING_URL : PLAY_LISTING_URL;
