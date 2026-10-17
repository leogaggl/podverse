/**
 * Pure deep-link scheme + prefix helpers shared by the React Native bundle and `app.config.ts`.
 * This file is JavaScript because the Expo config loader compiles `app.config.ts` and then Node
 * requires the result. A sibling `.ts` import does not resolve there.
 * See the `mobile-deep-links-and-prod-cutover` rule.
 */

const { UNIVERSAL_LINK_PATH_PREFIXES } = require('@podverse/helpers');

/**
 * Custom URL schemes the app registers, most-specific first. `podverse-next` is the beta scheme;
 * `podverse` is kept as a legacy alias so an eventual in-place v4 → v5 upgrade (same bundle id /
 * package) still resolves existing `podverse://` links out in the wild. Forks / white-labels override
 * the whole list via `EXPO_PUBLIC_MOBILE_DEEP_LINK_SCHEMES` (comma- or space-delimited).
 */
const DEFAULT_MOBILE_DEEP_LINK_SCHEMES = ['podverse-next', 'podverse'];

const stripSchemeSuffix = (value) => {
  return value.replace(/:\/\/$/, '').replace(/:$/, '');
};

/**
 * Parse a comma/space-delimited scheme list env value into bare scheme names (no `://`). Falls back
 * to `DEFAULT_MOBILE_DEEP_LINK_SCHEMES` when unset or empty so builds always register at least the
 * app's own scheme.
 */
const parseMobileDeepLinkSchemes = (raw) => {
  const parsed = (raw ?? '')
    .split(/[\s,]+/)
    .map((entry) => stripSchemeSuffix(entry.trim()))
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_MOBILE_DEEP_LINK_SCHEMES];
};

const normalizeBaseUrl = (value) => {
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

/**
 * Build the React Navigation `prefixes` list: each custom scheme as `scheme://`, then the public
 * web base URL when this build has one. An empty origin is omitted so the app does not claim an
 * https host it was not given.
 */
const buildMobileLinkPrefixes = (schemes, webBaseUrl) => {
  const schemePrefixes = schemes.map((scheme) => `${scheme}://`);
  if (webBaseUrl === null || webBaseUrl.trim() === '') {
    return schemePrefixes;
  }
  return [...schemePrefixes, normalizeBaseUrl(webBaseUrl)];
};

/** Path prefixes registered for iOS universal links / Android app links (must match web routes). */
const MOBILE_UNIVERSAL_LINK_PATH_PREFIXES = UNIVERSAL_LINK_PATH_PREFIXES;

module.exports = {
  DEFAULT_MOBILE_DEEP_LINK_SCHEMES,
  MOBILE_UNIVERSAL_LINK_PATH_PREFIXES,
  buildMobileLinkPrefixes,
  parseMobileDeepLinkSchemes,
};
