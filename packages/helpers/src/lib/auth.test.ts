import { describe, expect, it } from 'vitest';

import { isSessionAccessJwtPayload, isSessionRefreshJwtPayload } from './auth.js';

describe('isSessionAccessJwtPayload', () => {
  it('accepts web and mobile access tokens that name a session', () => {
    expect(
      isSessionAccessJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        token_use: 'web',
      })
    ).toBe(true);
    expect(
      isSessionAccessJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        scope: 'podverse_app_mobile',
        token_use: 'access',
      })
    ).toBe(true);
  });

  it('rejects refresh tokens, tokens with no session, and malformed payloads', () => {
    expect(
      isSessionAccessJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        rid: 'refresh-id',
        token_use: 'refresh',
      })
    ).toBe(false);
    expect(isSessionAccessJwtPayload({ id: 12, id_text: 'abcdefghi', token_use: 'web' })).toBe(
      false
    );
    expect(
      isSessionAccessJwtPayload({ id: 12, id_text: 'abcdefghi', sid: '', token_use: 'web' })
    ).toBe(false);
    expect(isSessionAccessJwtPayload({ id: 12, id_text: 'abcdefghi', sid: 'sessid001' })).toBe(
      false
    );
    expect(
      isSessionAccessJwtPayload({
        id: '12',
        id_text: 'abcdefghi',
        sid: 'sessid001',
        token_use: 'web',
      })
    ).toBe(false);
    expect(
      isSessionAccessJwtPayload({ id: 0, id_text: 'abcdefghi', sid: 'sessid001', token_use: 'web' })
    ).toBe(false);
    expect(isSessionAccessJwtPayload({ id: 12, sid: 'sessid001', token_use: 'web' })).toBe(false);
    expect(isSessionAccessJwtPayload(null)).toBe(false);
    expect(isSessionAccessJwtPayload('web')).toBe(false);
  });
});

describe('isSessionRefreshJwtPayload', () => {
  it('accepts a refresh token that names a session and a refresh token id', () => {
    expect(
      isSessionRefreshJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        rid: 'refresh-id',
        scope: 'podverse_app_mobile',
        token_use: 'refresh',
      })
    ).toBe(true);
  });

  it('rejects access tokens and refresh tokens missing the session or refresh id', () => {
    expect(
      isSessionRefreshJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        rid: 'refresh-id',
        token_use: 'access',
      })
    ).toBe(false);
    expect(
      isSessionRefreshJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        rid: 'refresh-id',
        token_use: 'refresh',
      })
    ).toBe(false);
    expect(
      isSessionRefreshJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        token_use: 'refresh',
      })
    ).toBe(false);
    expect(
      isSessionRefreshJwtPayload({
        id: 12,
        id_text: 'abcdefghi',
        sid: 'sessid001',
        rid: '',
        token_use: 'refresh',
      })
    ).toBe(false);
    expect(isSessionRefreshJwtPayload(undefined)).toBe(false);
  });
});
