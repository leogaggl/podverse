export const ERROR_MESSAGES = {
  ACCOUNT: {
    ALREADY_EXISTS: 'Cannot create account. Account already exists.',
    NOT_VERIFIED: 'Account not verified.',
  },
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please contact support for assistance.',
};

export const ACCOUNT_RESPONSE_CODES = {
  VERIFICATION_EMAIL_NOT_SENT: 'verification_email_not_sent',
} as const;

export type AccountCreateResponseCode =
  (typeof ACCOUNT_RESPONSE_CODES)[keyof typeof ACCOUNT_RESPONSE_CODES];

export const ACCOUNT_CHANGE_PASSWORD_ERROR_CODES = {
  CURRENT_PASSWORD_INCORRECT: 'current_password_incorrect',
  INVALID_NEW_PASSWORD: 'invalid_new_password',
} as const;

export type AccountChangePasswordErrorCode =
  (typeof ACCOUNT_CHANGE_PASSWORD_ERROR_CODES)[keyof typeof ACCOUNT_CHANGE_PASSWORD_ERROR_CODES];
