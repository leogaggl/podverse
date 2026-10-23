import { getEmailErrorKey } from './email.js';
import { getPasswordErrorKey } from './password.js';

export type SignUpValidationResult = {
  emailErrorKey?: string;
  password1ErrorKey?: string;
  isValid: boolean;
};

export function validateSignUpFields(email: string, password1: string): SignUpValidationResult {
  const emailErrorKey = getEmailErrorKey(email);
  const password1ErrorKey = getPasswordErrorKey(password1);
  const isValid = !emailErrorKey && !password1ErrorKey && !!email && !!password1;
  return {
    ...(emailErrorKey !== undefined ? { emailErrorKey } : {}),
    ...(password1ErrorKey !== undefined ? { password1ErrorKey } : {}),
    isValid,
  };
}
