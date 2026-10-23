import { describe, expect, it } from 'vitest';

import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { AUTH_SESSION_ENDED_NOTICES } from '@podverse/helpers/authSessionNotice';

import { isAuthSessionEndedNotice, sessionEndedNoticeMessageKey } from './sessionEndedNotice';

const MESSAGE_KEYS = {
  signed_out_elsewhere: 'signedOutElsewhere',
  password_changed: 'passwordChanged',
  admin_force_logout: 'signedOutByAdministrator',
  security: 'signedOutForSecurity',
} as const satisfies Record<AuthSessionEndedNotice, string>;

describe('sessionEndedNotice', () => {
  it('maps each notice to its auth catalog key', () => {
    for (const notice of AUTH_SESSION_ENDED_NOTICES) {
      expect(isAuthSessionEndedNotice(notice)).toBe(true);
      expect(sessionEndedNoticeMessageKey(notice)).toBe(MESSAGE_KEYS[notice]);
    }
  });

  it('rejects a string outside the four notices', () => {
    expect(isAuthSessionEndedNotice('not-a-notice')).toBe(false);
  });
});
