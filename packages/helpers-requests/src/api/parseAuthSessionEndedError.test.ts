import { describe, expect, it } from 'vitest';

import { AUTH_SESSION_ENDED_NOTICES } from '@podverse/helpers/authSessionNotice';

import { parseAuthSessionEndedError } from './parseAuthSessionEndedError.js';

function errorWith(status: number, data: unknown): unknown {
  return { response: { status, data } };
}

describe('parseAuthSessionEndedError', () => {
  it('returns the notice from a 401 whose body is session_ended', () => {
    for (const notice of AUTH_SESSION_ENDED_NOTICES) {
      expect(parseAuthSessionEndedError(errorWith(401, { code: 'session_ended', notice }))).toBe(
        notice
      );
    }
  });

  it('returns null for an unknown notice, a bodyless 401, a non-401, and a non-object error', () => {
    expect(
      parseAuthSessionEndedError(errorWith(401, { code: 'session_ended', notice: 'refresh_reuse' }))
    ).toBeNull();
    expect(parseAuthSessionEndedError({ response: { status: 401 } })).toBeNull();
    expect(
      parseAuthSessionEndedError(
        errorWith(403, { code: 'session_ended', notice: 'signed_out_elsewhere' })
      )
    ).toBeNull();
    expect(parseAuthSessionEndedError(new Error('boom'))).toBeNull();
    expect(parseAuthSessionEndedError(null)).toBeNull();
  });
});
