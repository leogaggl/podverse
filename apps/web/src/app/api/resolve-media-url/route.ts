import type { NextRequest } from 'next/server';

import { getConfig } from '../../../config';
import { resolveMediaRedirectChain } from '../../../utils/media/resolveMediaRedirect';
import { checkRateLimit } from '../../../utils/proxy/rateLimiter';
import { validateProxyUrl } from '../../../utils/proxy/urlValidator';

const CACHE_CONTROL = 'private, max-age=600';

const jsonBody = (
  body: { httpStatus?: number; reason: string; url: string | null },
  status: number
): Response =>
  Response.json(body, {
    status,
    headers: status === 200 ? { 'Cache-Control': CACHE_CONTROL } : undefined,
  });

/**
 * Follows a media URL's redirects and returns the final address. The response never contains
 * media bytes. Each hop is checked for SSRF, including DNS, and no credentials are sent.
 */
export async function GET(req: NextRequest) {
  const rateLimitResult = checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
      },
    });
  }

  const url = new URL(req.url).searchParams.get('url');
  if (url === null || url.trim() === '') {
    return jsonBody({ url: null, reason: 'invalid' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return jsonBody({ url: null, reason: 'invalid' }, 400);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return jsonBody({ url: null, reason: 'invalid' }, 400);
  }
  const validation = validateProxyUrl(url);
  if (!validation.isValid) {
    return jsonBody({ url: null, reason: 'invalid' }, 400);
  }

  const body = await resolveMediaRedirectChain(url, getConfig().proxy.userAgent);
  return jsonBody(body, 200);
}
