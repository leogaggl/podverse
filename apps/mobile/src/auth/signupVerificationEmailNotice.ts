import { ACCOUNT_RESPONSE_CODES } from '@podverse/helpers/error';

export type SignupCompletionKind = 'created' | 'verification_email_not_sent';

export type SignupSuccessCopy =
  { kind: 'created' } | { kind: 'verification_email_not_sent'; showContactLink: boolean };

export const signupCompletionKind = (code: string | undefined): SignupCompletionKind => {
  if (code === ACCOUNT_RESPONSE_CODES.VERIFICATION_EMAIL_NOT_SENT) {
    return 'verification_email_not_sent';
  }
  return 'created';
};

export const signupSuccessCopy = (
  kind: SignupCompletionKind,
  contactEmail: string
): SignupSuccessCopy => {
  if (kind === 'verification_email_not_sent') {
    return { kind, showContactLink: contactEmail !== '' };
  }
  return { kind: 'created' };
};
