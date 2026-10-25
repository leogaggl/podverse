import { describe, expect, it } from 'vitest';

import { parsePlaybackApiError } from './playback.js';

function errorWith(status: number, data: unknown): unknown {
  return Object.assign(new Error('Request failed'), { response: { status, data } });
}

describe('parsePlaybackApiError', () => {
  it('reads a 409 not-active-device body with the active session id', () => {
    const parsed = parsePlaybackApiError(
      errorWith(409, {
        message: 'This device is not the active playback device.',
        code: 'playback_not_active_device',
        active_session_id_text: 'session-b',
      })
    );

    expect(parsed).toEqual({
      code: 'playback_not_active_device',
      activeSessionIdText: 'session-b',
    });
  });

  it('reads a 409 not-active-device body whose active session id is null', () => {
    const parsed = parsePlaybackApiError(
      errorWith(409, { code: 'playback_not_active_device', active_session_id_text: null })
    );

    expect(parsed).toEqual({ code: 'playback_not_active_device', activeSessionIdText: null });
  });

  it('reads a 503 playback-unavailable body', () => {
    const parsed = parsePlaybackApiError(
      errorWith(503, { message: 'Playback is unavailable.', code: 'playback_unavailable' })
    );

    expect(parsed).toEqual({ code: 'playback_unavailable' });
  });

  it('returns null for a 403 membership body', () => {
    const parsed = parsePlaybackApiError(
      errorWith(403, {
        message: 'Your membership has expired. Renew to use this feature.',
        code: 'membership_expired',
        i18nKey: 'membership.membership_expired',
        renewPath: '/membership/renew',
      })
    );

    expect(parsed).toBeNull();
  });

  it('returns null for a 409 with a code it does not know', () => {
    expect(parsePlaybackApiError(errorWith(409, { code: 'something_else' }))).toBeNull();
  });

  it('returns null for a value that is not an object', () => {
    expect(parsePlaybackApiError('Request failed')).toBeNull();
    expect(parsePlaybackApiError(null)).toBeNull();
  });
});
