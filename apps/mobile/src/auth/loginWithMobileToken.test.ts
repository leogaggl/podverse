import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_MESSAGES } from '@podverse/helpers/error';

const reqAuthMobileToken = vi.fn();
const createMobileApiRequestService = vi.fn();

vi.mock('./mobileApi', () => ({
  createMobileApiRequestService: () => createMobileApiRequestService(),
}));

import { loginWithMobileToken } from './loginWithMobileToken';

const httpError = (status: number, message?: string): Error => {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, {
    response: {
      data: message === undefined ? {} : { message },
      status,
    },
  });
  return error;
};

describe('loginWithMobileToken', () => {
  const setTokens = vi.fn(async () => undefined);

  beforeEach(() => {
    reqAuthMobileToken.mockReset();
    setTokens.mockReset();
    createMobileApiRequestService.mockReset();
    createMobileApiRequestService.mockReturnValue({ reqAuthMobileToken });
  });

  it('maps a 401 to invalid_credentials', async () => {
    reqAuthMobileToken.mockRejectedValue(httpError(401, 'Unauthorized'));

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'wrong', setTokens })
    ).resolves.toEqual({ error: 'invalid_credentials', ok: false });
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('maps a 403 Account not verified body to account_not_verified', async () => {
    reqAuthMobileToken.mockRejectedValue(httpError(403, ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED));

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens })
    ).resolves.toEqual({ error: 'account_not_verified', ok: false });
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('rethrows a 403 whose message is not the unverified account message', async () => {
    const error = httpError(403, 'Forbidden');
    reqAuthMobileToken.mockRejectedValue(error);

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens })
    ).rejects.toBe(error);
  });

  it('rethrows a 429 so the screen can show the rate-limit message', async () => {
    const error = httpError(429, 'Too many requests');
    reqAuthMobileToken.mockRejectedValue(error);

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens })
    ).rejects.toBe(error);
  });
});
