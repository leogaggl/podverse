import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadOrNotFound } from './loadOrNotFound';

const { notFoundMock, NOT_FOUND_SIGNAL } = vi.hoisted(() => {
  const signal = new Error('NEXT_NOT_FOUND_TEST');
  return {
    NOT_FOUND_SIGNAL: signal,
    notFoundMock: vi.fn((): never => {
      throw signal;
    }),
  };
});

vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

function axiosErrorWithStatus(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
    data: { message: 'Not found' },
    status,
    statusText: '',
    headers: {},
    config,
  });
}

describe('loadOrNotFound', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
  });

  it('A load that resolves returns its value, and notFound is not called.', async () => {
    const value = { id: 'channel-1' };
    await expect(loadOrNotFound(() => Promise.resolve(value))).resolves.toBe(value);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('A load that rejects with an axios 404 rejects with the not-found signal, and notFound is called once.', async () => {
    await expect(loadOrNotFound(() => Promise.reject(axiosErrorWithStatus(404)))).rejects.toBe(
      NOT_FOUND_SIGNAL
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 410, 500, 503])(
    'A load that rejects with axios status %i rejects with the same error, and notFound is not called.',
    async (status) => {
      const error = axiosErrorWithStatus(status);
      await expect(loadOrNotFound(() => Promise.reject(error))).rejects.toBe(error);
      expect(notFoundMock).not.toHaveBeenCalled();
    }
  );

  it('A network failure is rethrown unchanged, and notFound is not called.', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    await expect(loadOrNotFound(() => Promise.reject(error))).rejects.toBe(error);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('A Next.js navigation signal thrown inside load is rethrown unchanged, and notFound is not called.', async () => {
    const navigationSignal = new Error('NEXT_REDIRECT');
    Object.assign(navigationSignal, { digest: 'NEXT_REDIRECT;replace;/somewhere;307;' });
    await expect(
      loadOrNotFound(() => {
        throw navigationSignal;
      })
    ).rejects.toBe(navigationSignal);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
