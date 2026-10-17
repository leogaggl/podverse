import { getMobileConfig } from '../config';

/**
 * Pure (RN-free) URL building for the membership purchase hand-off. Kept separate from
 * `checkoutEntry` (which imports `react-native`) so the path constants and URL logic are node-testable
 * and live in one place.
 */
export type CheckoutMode = 'sign_up' | 'extend';

/** Web routes for the hand-off. */
const CHECKOUT_WEB_PATHS: Record<CheckoutMode, string> = {
  extend: '/checkout',
  sign_up: '/sign-up',
};

const webOrigin = (): string | null => {
  const webBaseUrl = getMobileConfig().webBaseUrl;
  if (webBaseUrl === null || webBaseUrl.trim() === '') {
    return null;
  }
  return webBaseUrl.replace(/\/+$/, '');
};

/** Absolute web URL for a checkout mode, or null when this build has no web host. */
export const buildCheckoutUrl = (mode: CheckoutMode): string | null => {
  const origin = webOrigin();
  if (origin === null) {
    return null;
  }
  return `${origin}${CHECKOUT_WEB_PATHS[mode]}`;
};

/** Absolute URL for a path on the public web origin, or null when this build has no web host. */
export const buildWebPathUrl = (path: string): string | null => {
  const origin = webOrigin();
  if (origin === null) {
    return null;
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
};
