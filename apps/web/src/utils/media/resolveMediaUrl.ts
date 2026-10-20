import { request } from '@podverse/helpers-requests';

import type { ResolveMediaUrlBody, ResolveMediaUrlReason } from './resolveMediaRedirect';

const CACHE_MS = 10 * 60 * 1000;

const REASONS: readonly ResolveMediaUrlReason[] = [
  'resolved',
  'same_url',
  'blocked_final',
  'http_error',
  'too_many_redirects',
  'invalid',
  'network',
];

type CacheEntry = {
  at: number;
  result: ResolveMediaUrlBody;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ResolveMediaUrlBody>>();

const networkResult = (): ResolveMediaUrlBody => ({ url: null, reason: 'network' });

const isReason = (value: unknown): value is ResolveMediaUrlReason =>
  typeof value === 'string' && REASONS.some((reason) => reason === value);

const isResolveBody = (value: unknown): value is ResolveMediaUrlBody => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('reason' in value) || !('url' in value)) {
    return false;
  }
  const { reason, url } = value;
  if (!isReason(reason)) {
    return false;
  }
  return url === null || typeof url === 'string';
};

const readResolveBody = async (inputUrl: string): Promise<ResolveMediaUrlBody> => {
  try {
    const { data, status } = await request<unknown>(
      `/api/resolve-media-url?url=${encodeURIComponent(inputUrl)}`
    );
    if (status !== 200 || !isResolveBody(data)) {
      return networkResult();
    }
    const httpStatus =
      'httpStatus' in data && typeof data.httpStatus === 'number' ? data.httpStatus : undefined;
    return {
      reason: data.reason,
      url: data.url,
      ...(httpStatus === undefined ? {} : { httpStatus }),
    };
  } catch {
    return networkResult();
  }
};

/** Asks the server for the final URL. The same input shares one request and a 10 minute result. */
export const resolveMediaUrl = (inputUrl: string): Promise<ResolveMediaUrlBody> => {
  const cached = cache.get(inputUrl);
  if (cached !== undefined && Date.now() - cached.at < CACHE_MS) {
    return Promise.resolve(cached.result);
  }

  const pending = inflight.get(inputUrl);
  if (pending !== undefined) {
    return pending;
  }

  const promise = readResolveBody(inputUrl)
    .then((result) => {
      if (result.reason !== 'network') {
        cache.set(inputUrl, { at: Date.now(), result });
      }
      return result;
    })
    .finally(() => {
      inflight.delete(inputUrl);
    });
  inflight.set(inputUrl, promise);
  return promise;
};

/** Drops the memo so tests and a fresh session do not reuse an old result. */
export const clearResolveMediaUrlCache = (): void => {
  cache.clear();
  inflight.clear();
};
