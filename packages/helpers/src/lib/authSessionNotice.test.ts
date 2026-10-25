import { describe, expect, it } from 'vitest';

import type { AccountSessionRevokeReason } from './accountSession.js';
import { ACCOUNT_SESSION_REVOKE_REASONS } from './accountSession.js';
import type { AuthSessionEndedNotice } from './authSessionNotice.js';
import {
  AUTH_SESSION_ENDED_CODE,
  AUTH_SESSION_ENDED_NOTICES,
  getAuthSessionEndedNotice,
  isAuthSessionEndedNotice,
  parseAuthSessionEndedNotice,
} from './authSessionNotice.js';

describe('isAuthSessionEndedNotice', () => {
  it('accepts each notice and rejects a revoke reason, an empty string, and a number', () => {
    for (const notice of AUTH_SESSION_ENDED_NOTICES) {
      expect(isAuthSessionEndedNotice(notice)).toBe(true);
    }
    expect(isAuthSessionEndedNotice('signed_out')).toBe(false);
    expect(isAuthSessionEndedNotice('')).toBe(false);
    expect(isAuthSessionEndedNotice(401)).toBe(false);
  });
});

describe('getAuthSessionEndedNotice', () => {
  it('maps every revoke reason to the notice the signed-out device shows', () => {
    const expected: Record<AccountSessionRevokeReason, AuthSessionEndedNotice | null> = {
      signed_out: null,
      signed_out_elsewhere: 'signed_out_elsewhere',
      password_changed: 'password_changed',
      admin_password_set: 'password_changed',
      admin_force_logout: 'admin_force_logout',
      refresh_reuse: 'security',
    };
    for (const reason of ACCOUNT_SESSION_REVOKE_REASONS) {
      expect(getAuthSessionEndedNotice(reason)).toBe(expected[reason]);
    }
  });
});

describe('parseAuthSessionEndedNotice', () => {
  it('reads the notice from a session-ended 401 body', () => {
    expect(
      parseAuthSessionEndedNotice({
        message: 'Unauthorized',
        code: AUTH_SESSION_ENDED_CODE,
        notice: 'signed_out_elsewhere',
      })
    ).toBe('signed_out_elsewhere');
    expect(
      parseAuthSessionEndedNotice({
        message: 'Invalid refresh token',
        code: 'session_ended',
        notice: 'security',
      })
    ).toBe('security');
  });

  it('returns null for a plain 401, another code, or an unknown notice', () => {
    expect(parseAuthSessionEndedNotice({ message: 'Unauthorized' })).toBeNull();
    expect(
      parseAuthSessionEndedNotice({
        message: 'Forbidden',
        code: 'membership_expired',
        notice: 'security',
      })
    ).toBeNull();
    expect(
      parseAuthSessionEndedNotice({ code: AUTH_SESSION_ENDED_CODE, notice: 'refresh_reuse' })
    ).toBeNull();
    expect(parseAuthSessionEndedNotice({ code: AUTH_SESSION_ENDED_CODE })).toBeNull();
  });

  it('returns null for bodies that are not objects', () => {
    expect(parseAuthSessionEndedNotice(null)).toBeNull();
    expect(parseAuthSessionEndedNotice(undefined)).toBeNull();
    expect(parseAuthSessionEndedNotice('session_ended')).toBeNull();
    expect(parseAuthSessionEndedNotice(401)).toBeNull();
  });
});
