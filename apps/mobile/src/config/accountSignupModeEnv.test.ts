import { describe, expect, it } from 'vitest';

import { getMobileAccountSignupModeFromEnv } from './accountSignupModeEnv';

const ENV_KEY = 'EXPO_PUBLIC_ACCOUNT_SIGNUP_MODE';

function withMode(value: string | undefined, run: () => void): void {
  const previous = process.env[ENV_KEY];
  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  }
}

describe('getMobileAccountSignupModeFromEnv', () => {
  it('uses user_signup_email when the variable is unset', () => {
    withMode(undefined, () => {
      expect(getMobileAccountSignupModeFromEnv()).toBe('user_signup_email');
    });
  });

  it('reads a known mode', () => {
    withMode('admin_only_username', () => {
      expect(getMobileAccountSignupModeFromEnv()).toBe('admin_only_username');
    });
    withMode('admin_only_email', () => {
      expect(getMobileAccountSignupModeFromEnv()).toBe('admin_only_email');
    });
  });

  it('uses user_signup_email when the value is unknown', () => {
    withMode('not-a-mode', () => {
      expect(getMobileAccountSignupModeFromEnv()).toBe('user_signup_email');
    });
  });
});
