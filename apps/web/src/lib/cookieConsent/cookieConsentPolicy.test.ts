import { describe, expect, it } from 'vitest';

import {
  COOKIE_CONSENT_MODEL_VERSION,
  cookieConsentAllowsAnonymousFeatureStorage,
  cookieConsentAllowsWebAnalytics,
  normalizeCookieConsentState,
} from './cookieConsentPolicy';

describe('normalizeCookieConsentState', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('keeps a v2 state unchanged', () => {
    expect(
      normalizeCookieConsentState({ choice: 'all', at, v: COOKIE_CONSENT_MODEL_VERSION })
    ).toEqual({ choice: 'all', at, v: COOKIE_CONSENT_MODEL_VERSION });
    expect(
      normalizeCookieConsentState({ choice: 'essential', at, v: COOKIE_CONSENT_MODEL_VERSION })
    ).toEqual({ choice: 'essential', at, v: COOKIE_CONSENT_MODEL_VERSION });
    expect(
      normalizeCookieConsentState({ choice: 'none', at, v: COOKIE_CONSENT_MODEL_VERSION })
    ).toEqual({ choice: 'none', at, v: COOKIE_CONSENT_MODEL_VERSION });
  });

  it('returns undefined for older consent shapes', () => {
    expect(normalizeCookieConsentState({ choice: 'features', at })).toBeUndefined();
    expect(normalizeCookieConsentState({ choice: 'essential', at })).toBeUndefined();
    expect(normalizeCookieConsentState({ choice: 'all', at })).toBeUndefined();
    expect(normalizeCookieConsentState({ choice: 'essential', at, v: 1 })).toBeUndefined();
  });
});

describe('cookieConsentAllowsWebAnalytics', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('allows analytics when the banner is disabled', () => {
    expect(cookieConsentAllowsWebAnalytics(false, undefined)).toBe(true);
    expect(
      cookieConsentAllowsWebAnalytics(false, {
        choice: 'essential',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(true);
  });

  it('allows analytics only for accept all when the banner is enabled', () => {
    expect(cookieConsentAllowsWebAnalytics(true, undefined)).toBe(false);
    expect(
      cookieConsentAllowsWebAnalytics(true, {
        choice: 'all',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(true);
    expect(
      cookieConsentAllowsWebAnalytics(true, {
        choice: 'essential',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(false);
    expect(
      cookieConsentAllowsWebAnalytics(true, {
        choice: 'none',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(false);
  });
});

describe('cookieConsentAllowsAnonymousFeatureStorage', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('allows anonymous feature storage when the banner is disabled', () => {
    expect(cookieConsentAllowsAnonymousFeatureStorage(false, undefined)).toBe(true);
  });

  it('blocks anonymous feature storage until a choice is made when the banner is enabled', () => {
    expect(cookieConsentAllowsAnonymousFeatureStorage(true, undefined)).toBe(false);
  });

  it('allows storage for all and essential when the banner is enabled', () => {
    expect(
      cookieConsentAllowsAnonymousFeatureStorage(true, {
        choice: 'all',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(true);
    expect(
      cookieConsentAllowsAnonymousFeatureStorage(true, {
        choice: 'essential',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(true);
  });

  it('blocks storage for none when the banner is enabled', () => {
    expect(
      cookieConsentAllowsAnonymousFeatureStorage(true, {
        choice: 'none',
        at,
        v: COOKIE_CONSENT_MODEL_VERSION,
      })
    ).toBe(false);
  });
});
