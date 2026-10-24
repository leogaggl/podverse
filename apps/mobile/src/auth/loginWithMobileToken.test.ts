import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_MESSAGES } from '@podverse/helpers/error';

const reqAuthMobileToken = vi.fn();
const createMobileApiRequestService = vi.fn();
const readMobileSessionDeviceLabel = vi.fn<() => string | null>();

vi.mock('./mobileApi', () => ({
  createMobileApiRequestService: () => createMobileApiRequestService(),
}));

vi.mock('./mobileSessionDeviceLabel.read', () => ({
  readMobileSessionDeviceLabel: () => readMobileSessionDeviceLabel(),
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
    readMobileSessionDeviceLabel.mockReset();
    readMobileSessionDeviceLabel.mockReturnValue('iPhone · iOS');
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

  it('sends the device label when this device has one', async () => {
    reqAuthMobileToken.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens })
    ).resolves.toEqual({
      accessToken: 'access-token',
      ok: true,
      refreshToken: 'refresh-token',
    });
    expect(reqAuthMobileToken).toHaveBeenCalledWith({
      device_label: 'iPhone · iOS',
      email: 'person@example.com',
      password: 'correct',
    });
  });

  it('omits device_label when this device has no label', async () => {
    readMobileSessionDeviceLabel.mockReturnValue(null);
    reqAuthMobileToken.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });

    await loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens });

    expect(reqAuthMobileToken).toHaveBeenCalledWith({
      device_label: undefined,
      email: 'person@example.com',
      password: 'correct',
    });
  });

  it('rethrows a 429 so the screen can show the rate-limit message', async () => {
    const error = httpError(429, 'Too many requests');
    reqAuthMobileToken.mockRejectedValue(error);

    await expect(
      loginWithMobileToken({ email: 'person@example.com', password: 'correct', setTokens })
    ).rejects.toBe(error);
  });
});
