import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestService } from './_request.js';

vi.mock('../_request.js', () => ({
  request: vi.fn(),
  requestWithHeaders: vi.fn(),
}));

import { request, requestWithHeaders } from '../_request.js';

const requestMock = vi.mocked(request);
const requestWithHeadersMock = vi.mocked(requestWithHeaders);

type Method = 'apiRequest' | 'apiRequestWithHeaders';

function createService(onRequestError?: (error: unknown) => void): ApiRequestService {
  return new ApiRequestService({
    protocol: 'http',
    host: 'localhost',
    prefix: '',
    version: '/v1',
    ...(onRequestError !== undefined ? { onRequestError } : {}),
  });
}

function rejectRequest(method: Method, service: ApiRequestService, error: Error): Promise<unknown> {
  if (method === 'apiRequest') {
    requestMock.mockRejectedValueOnce(error);
    return service.apiRequest({ path: '/auth/sessions' });
  }
  requestWithHeadersMock.mockRejectedValueOnce(error);
  return service.apiRequestWithHeaders({ path: '/auth/sessions' });
}

function resolveRequest(method: Method, service: ApiRequestService): Promise<unknown> {
  if (method === 'apiRequest') {
    requestMock.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    return service.apiRequest({ path: '/auth/sessions' });
  }
  requestWithHeadersMock.mockResolvedValueOnce({
    status: 200,
    data: { ok: true },
    headers: {},
  });
  return service.apiRequestWithHeaders({ path: '/auth/sessions' });
}

describe.each(['apiRequest', 'apiRequestWithHeaders'] as const)('%s onRequestError', (method) => {
  let consoleError: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    requestMock.mockReset();
    requestWithHeadersMock.mockReset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError?.mockRestore();
  });

  it('rejects with the same error and reports it once', async () => {
    const error = new Error('refused');
    const onRequestError = vi.fn();
    const service = createService(onRequestError);

    await expect(rejectRequest(method, service, error)).rejects.toBe(error);
    expect(onRequestError).toHaveBeenCalledTimes(1);
    expect(onRequestError).toHaveBeenCalledWith(error);
  });

  it('still rejects with the original error when the listener throws', async () => {
    const error = new Error('refused');
    const onRequestError = vi.fn(() => {
      throw new Error('listener failed');
    });
    const service = createService(onRequestError);

    await expect(rejectRequest(method, service, error)).rejects.toBe(error);
    expect(onRequestError).toHaveBeenCalledTimes(1);
    expect(onRequestError).toHaveBeenCalledWith(error);
  });

  it('does not report a resolved request', async () => {
    const onRequestError = vi.fn();
    const service = createService(onRequestError);

    await expect(resolveRequest(method, service)).resolves.toEqual(
      method === 'apiRequest' ? { ok: true } : { status: 200, data: { ok: true }, headers: {} }
    );
    expect(onRequestError).not.toHaveBeenCalled();
  });

  it('rejects normally when built without the option', async () => {
    const error = new Error('refused');
    const service = createService();

    await expect(rejectRequest(method, service, error)).rejects.toBe(error);
  });
});
