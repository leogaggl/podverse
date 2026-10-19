import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ONE_YEAR_SECONDS } from '@podverse/helpers';

import {
  channelPathForMedium,
  channelPathForRoute,
  itemPathForRoute,
  mediumIdFromChannelBody,
  MERGE_REDIRECT_CHECKED_HEADER,
  mergeRedirectRouteFromPath,
  rewrittenLocalSettingsCookie,
  withSearch,
} from './utils/redirect/mergedIdentity';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function idMove(value: unknown): { fromIdText: string; toIdText: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const fromIdText = stringField(value, 'from_id_text');
  const toIdText = stringField(value, 'to_id_text');
  if (fromIdText === null || toIdText === null) {
    return null;
  }
  return { fromIdText, toIdText };
}

function podcastIndexMove(value: unknown): { toIdText: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const toIdText = stringField(value, 'to_channel_id_text');
  return toIdText === null ? null : { toIdText };
}

function firstRow(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

async function postResolve(
  base: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${base}/identity/resolve`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function mediumIdForChannel(base: string, idText: string): Promise<number | null> {
  try {
    const response = await fetch(`${base}/channel/${encodeURIComponent(idText)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    return mediumIdFromChannelBody(payload);
  } catch {
    return null;
  }
}

function passThrough(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(MERGE_REDIRECT_CHECKED_HEADER, '1');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const route = mergeRedirectRouteFromPath(request.nextUrl.pathname);
  if (route === null) {
    return NextResponse.next();
  }
  const base = ssrApiBase();
  if (base === null) {
    return NextResponse.next();
  }

  const resolved =
    route.kind === 'channel'
      ? await postResolve(base, { channel_id_texts: [route.id] })
      : route.kind === 'item'
        ? await postResolve(base, { item_id_texts: [route.id] })
        : await postResolve(base, { podcast_index_ids: [Number(route.id)] });
  if (resolved === null) {
    return NextResponse.next();
  }

  const search = route.kind === 'podcast_index' ? '' : request.nextUrl.search;
  let path: string | null = null;
  let cookie: string | null = null;

  if (route.kind === 'item') {
    const move = idMove(firstRow(resolved.items));
    if (move) {
      path = withSearch(itemPathForRoute(route.routeKind, move.toIdText), search);
      cookie = rewrittenLocalSettingsCookie(
        request.cookies.get('local-settings')?.value,
        'item',
        move.fromIdText,
        move.toIdText
      );
    }
  } else if (route.kind === 'podcast_index') {
    const move = podcastIndexMove(firstRow(resolved.podcast_index_ids));
    if (move) {
      const mediumId = await mediumIdForChannel(base, move.toIdText);
      path =
        mediumId === null
          ? channelPathForRoute('podcast', move.toIdText)
          : channelPathForMedium(mediumId, move.toIdText);
    }
  } else {
    const move = idMove(firstRow(resolved.channels));
    if (move) {
      const mediumId = await mediumIdForChannel(base, move.toIdText);
      path = withSearch(
        mediumId === null
          ? channelPathForRoute(route.routeKind, move.toIdText)
          : channelPathForMedium(mediumId, move.toIdText),
        search
      );
      cookie = rewrittenLocalSettingsCookie(
        request.cookies.get('local-settings')?.value,
        'channel',
        move.fromIdText,
        move.toIdText
      );
    }
  }

  if (path === null) {
    return passThrough(request);
  }

  const destination = new URL(path, request.url);
  const current = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (`${destination.pathname}${destination.search}` === current) {
    return passThrough(request);
  }

  const response = NextResponse.redirect(destination, 308);
  if (cookie !== null) {
    response.cookies.set('local-settings', cookie, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  matcher: [
    '/podcast/:id',
    '/album/:id',
    '/artist/:id',
    '/episode/:id',
    '/track/:id',
    '/podcast-index/feed/:id',
  ],
};
