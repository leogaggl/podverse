import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { parseAuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

/** Same cookie `getManagementJwtFromCookies` reads (`pv_mgmt_auth`). */
const MANAGEMENT_AUTH_COOKIE_NAME = 'pv_mgmt_auth';

/** A stalled management API must not hold the page. */
const AUTH_ME_TIMEOUT_MS = 2000;

function ssrApiBase(): string | null {
  const protocol = process.env.NEXT_PUBLIC_SSR_API_PROTOCOL?.trim();
  const host = process.env.NEXT_PUBLIC_SSR_API_HOST?.trim();
  const port = process.env.NEXT_PUBLIC_SSR_API_PORT?.trim();
  const prefix = process.env.NEXT_PUBLIC_API_PREFIX?.trim();
  const version = process.env.NEXT_PUBLIC_API_VERSION?.trim();
  if (!protocol || !host || !prefix || !version) {
    return null;
  }
  const portPart = port ? `:${port}` : '';
  return `${protocol}://${host}${portPart}${prefix.replace(/\/$/, '')}${version}`;
}

function shouldSkipSessionFetch(request: NextRequest): boolean {
  if (request.headers.get('next-router-prefetch') === '1') {
    return true;
  }
  return request.nextUrl.pathname.startsWith('/_next');
}

function setCookieName(setCookie: string): string | null {
  const firstSegment = setCookie.split(';')[0] ?? '';
  const separator = firstSegment.indexOf('=');
  if (separator === -1) {
    return null;
  }
  const name = firstSegment.slice(0, separator).trim();
  return name.length > 0 ? name : null;
}

function managementAuthSetCookies(setCookies: string[]): string[] {
  return setCookies.filter((setCookie) => setCookieName(setCookie) === MANAGEMENT_AUTH_COOKIE_NAME);
}

function withAuthCookies(response: NextResponse, setCookies: string[]): NextResponse {
  for (const setCookie of setCookies) {
    response.headers.append('set-cookie', setCookie);
  }
  return response;
}

function loginUrlWithNotice(request: NextRequest, notice: AuthSessionEndedNotice): URL {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  url.searchParams.set('notice', notice);
  return url;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchManagementAuthMe(
  apiBase: string,
  cookieHeader: string
): Promise<Response | null> {
  try {
    return await fetch(`${apiBase}/auth/me`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie: cookieHeader,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_ME_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

/**
 * Copies a renewed or cleared `pv_mgmt_auth` from management-api onto the document response.
 * Server-rendered pages cannot store that `Set-Cookie` themselves. A failed fetch leaves the
 * browser cookie alone.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (shouldSkipSessionFetch(request)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(MANAGEMENT_AUTH_COOKIE_NAME)?.value;
  if (token === undefined || token.length === 0) {
    return NextResponse.next();
  }

  const apiBase = ssrApiBase();
  if (apiBase === null) {
    return NextResponse.next();
  }

  const apiResponse = await fetchManagementAuthMe(apiBase, request.headers.get('cookie') ?? '');
  if (apiResponse === null) {
    return NextResponse.next();
  }

  const authCookies = managementAuthSetCookies(apiResponse.headers.getSetCookie());

  if (apiResponse.status === 401) {
    const notice = parseAuthSessionEndedNotice(await readJsonBody(apiResponse));
    if (notice !== null && request.nextUrl.pathname !== '/') {
      return withAuthCookies(
        NextResponse.redirect(loginUrlWithNotice(request, notice)),
        authCookies
      );
    }
    return withAuthCookies(NextResponse.next(), authCookies);
  }

  void apiResponse.body?.cancel().catch(() => undefined);

  if (apiResponse.status === 200) {
    return withAuthCookies(NextResponse.next(), authCookies);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
