import { describe, expect, it } from 'vitest';

import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { AUTH_SESSION_ENDED_NOTICES } from '@podverse/helpers/authSessionNotice';

import type { ForcedLogoutReasonKey } from './forcedLogoutNoticeCopy';
import { forcedLogoutReasonKey } from './forcedLogoutNoticeCopy';

const expected: { [K in AuthSessionEndedNotice]: ForcedLogoutReasonKey } = {
  signed_out_elsewhere: 'authentication.session_ended.signed_out_elsewhere',
  password_changed: 'authentication.session_ended.password_changed',
  admin_force_logout: 'authentication.session_ended.admin_force_logout',
  security: 'authentication.session_ended.security',
};

describe('forcedLogoutReasonKey', () => {
  it('maps a missing notice to the expired sentence', () => {
    expect(forcedLogoutReasonKey(null)).toBe('authentication.session_ended.expired');
  });

  it.each(AUTH_SESSION_ENDED_NOTICES)('maps %s to its sentence', (notice) => {
    expect(forcedLogoutReasonKey(notice)).toBe(expected[notice]);
  });
});
