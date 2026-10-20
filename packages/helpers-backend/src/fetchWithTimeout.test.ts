import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initObservability, shutdownObservability } from '@podverse/observability';

import { fetchWithTimeout } from './fetchWithTimeout.js';

describe('fetchWithTimeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      )
    ) as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await shutdownObservability();
    vi.restoreAllMocks();
  });

  it('injects traceparent when observability is initialized with an active client span', async () => {
    initObservability({
      serviceName: 'podverse-test',
      tracesExport: 'none',
    });

    await fetchWithTimeout('https://example.com/feed.xml', { method: 'GET' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const init = call?.[1];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[1-9a-f]$/);
  });

  it('follows redirects unless a mode is set', async () => {
    await fetchWithTimeout('https://example.com/feed.xml');
    await fetchWithTimeout('https://example.com/feed.xml', { redirect: 'manual' });

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[1]?.redirect).toBe('follow');
    expect(calls[1]?.[1]?.redirect).toBe('manual');
  });

  it('returns the full body when maxBodyBytes is omitted', async () => {
    const response = await fetchWithTimeout('https://example.com/feed.xml');
    expect(await response.text()).toBe('ok');
  });

  it('returns at most maxBodyBytes and cancels the rest of the body', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('abcdefghij'));
      },
      cancel() {
        cancelled = true;
      },
    });
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(stream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'content-encoding': 'gzip',
            'content-length': '10',
            'content-type': 'text/plain',
          },
        })
      )
    ) as typeof fetch;

    const response = await fetchWithTimeout('https://example.com/feed.xml', { maxBodyBytes: 4 });

    expect(response.status).toBe(206);
    expect(response.statusText).toBe('Partial Content');
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.text()).toBe('abcd');
    expect(cancelled).toBe(true);
  });
});
