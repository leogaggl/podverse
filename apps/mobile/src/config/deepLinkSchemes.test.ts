import { describe, expect, it } from 'vitest';

import { UNIVERSAL_LINK_PATH_PREFIXES } from '@podverse/helpers';

import {
  buildMobileLinkPrefixes,
  DEFAULT_MOBILE_DEEP_LINK_SCHEMES,
  MOBILE_UNIVERSAL_LINK_PATH_PREFIXES,
  parseMobileDeepLinkSchemes,
} from './deepLinkSchemes';

describe('MOBILE_UNIVERSAL_LINK_PATH_PREFIXES', () => {
  it('is the shared https path prefix list', () => {
    expect(MOBILE_UNIVERSAL_LINK_PATH_PREFIXES).toBe(UNIVERSAL_LINK_PATH_PREFIXES);
  });
});

describe('parseMobileDeepLinkSchemes', () => {
  it('falls back to the default list when unset or empty', () => {
    expect(parseMobileDeepLinkSchemes(undefined)).toEqual(DEFAULT_MOBILE_DEEP_LINK_SCHEMES);
    expect(parseMobileDeepLinkSchemes('')).toEqual(DEFAULT_MOBILE_DEEP_LINK_SCHEMES);
    expect(parseMobileDeepLinkSchemes('   ')).toEqual(DEFAULT_MOBILE_DEEP_LINK_SCHEMES);
  });

  it('splits on commas and whitespace and trims entries', () => {
    expect(parseMobileDeepLinkSchemes('myapp, myapp-next')).toEqual(['myapp', 'myapp-next']);
    expect(parseMobileDeepLinkSchemes('myapp myapp-next')).toEqual(['myapp', 'myapp-next']);
  });

  it('strips a trailing :// or : so pasted URL schemes normalize to bare names', () => {
    expect(parseMobileDeepLinkSchemes('podverse://, podverse-next://')).toEqual([
      'podverse',
      'podverse-next',
    ]);
    expect(parseMobileDeepLinkSchemes('podverse:')).toEqual(['podverse']);
  });
});

describe('buildMobileLinkPrefixes', () => {
  it('appends :// to each scheme and normalizes the web base URL', () => {
    expect(
      buildMobileLinkPrefixes(DEFAULT_MOBILE_DEEP_LINK_SCHEMES, 'https://example.com')
    ).toEqual(['podverse-next://', 'podverse://', 'https://example.com']);
  });

  it('omits an https prefix when the build has no web host', () => {
    expect(buildMobileLinkPrefixes(['myapp'], null)).toEqual(['myapp://']);
    expect(buildMobileLinkPrefixes(['myapp'], '   ')).toEqual(['myapp://']);
  });

  it('trims a trailing slash from the web base URL', () => {
    expect(buildMobileLinkPrefixes(['myapp'], 'https://example.com/')).toEqual([
      'myapp://',
      'https://example.com',
    ]);
  });
});
