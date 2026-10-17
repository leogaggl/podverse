import { describe, expect, it } from 'vitest';

import { ACCOUNT_RESPONSE_CODES } from '@podverse/helpers/error';

import { signupCompletionKind, signupSuccessCopy } from './signupVerificationEmailNotice';

describe('signupVerificationEmailNotice', () => {
  it('maps a failed verification send onto the not-sent screen', () => {
    const kind = signupCompletionKind(ACCOUNT_RESPONSE_CODES.VERIFICATION_EMAIL_NOT_SENT);

    expect(kind).toBe('verification_email_not_sent');
    expect(signupSuccessCopy(kind, 'support@example.com')).toEqual({
      kind: 'verification_email_not_sent',
      showContactLink: true,
    });
    expect(signupSuccessCopy(kind, '')).toEqual({
      kind: 'verification_email_not_sent',
      showContactLink: false,
    });
  });

  it('keeps the created screen when the response has no failure code', () => {
    expect(signupCompletionKind(undefined)).toBe('created');
    expect(signupCompletionKind('something_else')).toBe('created');
    expect(signupSuccessCopy('created', 'support@example.com')).toEqual({ kind: 'created' });
  });
});
