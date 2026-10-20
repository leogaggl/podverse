import { afterEach, describe, expect, it, vi } from 'vitest';

import { request } from '@podverse/helpers-requests';

vi.mock('@podverse/helpers-requests', () => ({
  request: vi.fn(),
}));

import { clearResolveMediaUrlCache, resolveMediaUrl } from './resolveMediaUrl';

const requestMock = vi.mocked(request);
const INPUT = 'https://cdn.example/start';

describe('resolveMediaUrl', () => {
  afterEach(() => {
    clearResolveMediaUrlCache();
    vi.useRealTimers();
    requestMock.mockReset();
  });

  it('shares one request for the same URL and keeps the result for 10 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    requestMock.mockResolvedValue({
      status: 200,
      data: { url: 'https://cdn.example/final', reason: 'resolved' },
    });

    const [first, second] = await Promise.all([resolveMediaUrl(INPUT), resolveMediaUrl(INPUT)]);

    expect(first).toEqual({ url: 'https://cdn.example/final', reason: 'resolved' });
    expect(second).toEqual(first);
    expect(requestMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * 60 * 1000);
    await resolveMediaUrl(INPUT);
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('does not keep a network failure', async () => {
    requestMock.mockRejectedValue(new Error('offline'));

    await expect(resolveMediaUrl(INPUT)).resolves.toEqual({ url: null, reason: 'network' });
    await expect(resolveMediaUrl(INPUT)).resolves.toEqual({ url: null, reason: 'network' });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
