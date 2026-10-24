/**
 * Legal-consent E2E constants. Keep in sync with `tools/web/seed-e2e.mjs` and
 * `apps/web/playwright.e2e-server-env.ts` (`E2E_TERMS_OF_SERVICE_VERSION`).
 */

export const E2E_CONFIGURED_TERMS_VERSION = '2026-10-15';

export const E2E_OUTDATED_TERMS_VERSION = '2025-01-01';

export const E2E_STALE_TERMS_EMAIL = 'e2e-stale-terms@example.com';

export const E2E_STALE_TERMS_PASSWORD = 'Test!1Aa';

/** Outdated terms and no Taste Profile consent decision. Sync with tools/web/seed-e2e.mjs. */
export const E2E_CONSENT_ORDER_EMAIL = 'e2e-consent-order@example.com';

export const E2E_CONSENT_ORDER_PASSWORD = 'Test!1Aa';

/** Current Taste Profile consent with a seeded Taste Profile. Sync with tools/web/seed-e2e.mjs. */
export const E2E_TASTE_PROFILE_EMAIL = 'e2e-taste-profile@example.com';

export const E2E_TASTE_PROFILE_PASSWORD = 'Test!1Aa';

/** No Taste Profile consent decision yet. Sync with tools/web/seed-e2e.mjs. */
export const E2E_TASTE_PROFILE_CONSENT_UNDECIDED_EMAIL = 'e2e-taste-consent-undecided@example.com';

/** Taste Profile consent accepted on an older version. Sync with tools/web/seed-e2e.mjs. */
export const E2E_TASTE_PROFILE_CONSENT_STALE_EMAIL = 'e2e-taste-consent-stale@example.com';

export const E2E_TASTE_PROFILE_CONSENT_STALE_PASSWORD = 'Test!1Aa';

export const E2E_SIGNUP_TEST_PASSWORD = 'Test!1Aa';
