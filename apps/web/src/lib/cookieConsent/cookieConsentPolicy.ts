import type {
  CookieConsentChoice,
  CookieConsentState,
} from '../../utils/localSettings/localSettings';

export const COOKIE_CONSENT_MODEL_VERSION = 2 as const;

function isCurrentCookieConsentChoice(choice: unknown): choice is CookieConsentChoice {
  return choice === 'all' || choice === 'essential' || choice === 'none';
}

export function normalizeCookieConsentState(cc: {
  choice: unknown;
  at: unknown;
  v?: unknown;
}): CookieConsentState | undefined {
  if (typeof cc.at !== 'string' || cc.at.length === 0) {
    return undefined;
  }

  if (cc.v === COOKIE_CONSENT_MODEL_VERSION && isCurrentCookieConsentChoice(cc.choice)) {
    return { choice: cc.choice, at: cc.at, v: COOKIE_CONSENT_MODEL_VERSION };
  }

  return undefined;
}

export function cookieConsentAllowsWebAnalytics(
  bannerEnabled: boolean,
  consent: CookieConsentState | undefined
): boolean {
  if (!bannerEnabled) {
    return true;
  }
  return consent?.choice === 'all';
}

export function cookieConsentAllowsAnonymousFeatureStorage(
  bannerEnabled: boolean,
  consent: CookieConsentState | undefined
): boolean {
  if (!bannerEnabled) {
    return true;
  }
  if (consent === undefined) {
    return false;
  }
  return consent.choice === 'all' || consent.choice === 'essential';
}
