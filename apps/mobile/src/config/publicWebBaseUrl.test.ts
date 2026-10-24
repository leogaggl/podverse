import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  return { Platform: { OS: 'ios' } };
});

import { getMobilePublicWebBaseUrlFromEnv } from './env';

const PUBLIC_WEB_BASE_URL = 'EXPO_PUBLIC_MOBILE_WEB_BASE_URL';
const WEB_BASE_URL = 'WEB_BASE_URL';

const previousPublicWebBaseUrl = process.env[PUBLIC_WEB_BASE_URL];
const previousWebBaseUrl = process.env[WEB_BASE_URL];

const setEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

describe('getMobilePublicWebBaseUrlFromEnv', () => {
  afterEach(() => {
    setEnv(PUBLIC_WEB_BASE_URL, previousPublicWebBaseUrl);
    setEnv(WEB_BASE_URL, previousWebBaseUrl);
  });

  it('returns the public web origin without a trailing slash', () => {
    setEnv(PUBLIC_WEB_BASE_URL, 'https://example.com/');
    setEnv(WEB_BASE_URL, undefined);
    expect(getMobilePublicWebBaseUrlFromEnv()).toBe('https://example.com');
  });

  it('ignores WEB_BASE_URL when the public web origin is unset', () => {
    setEnv(PUBLIC_WEB_BASE_URL, undefined);
    setEnv(WEB_BASE_URL, 'https://example.com');
    expect(getMobilePublicWebBaseUrlFromEnv()).toBeNull();
  });

  it('returns null when both keys are unset', () => {
    setEnv(PUBLIC_WEB_BASE_URL, undefined);
    setEnv(WEB_BASE_URL, undefined);
    expect(getMobilePublicWebBaseUrlFromEnv()).toBeNull();
  });
});
