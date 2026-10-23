import { createHmac } from 'node:crypto';

import type { APIRequestContext, BrowserContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import { Client } from 'pg';

import { buildPodverseApiTestEnv } from '@podverse/helpers-config';

/**
 * Account-session E2E helpers. The sessions account is dedicated to these specs so ending its
 * sessions never signs out the shared e2e user. Sync the email with tools/web/seed-e2e.mjs.
 */
export const E2E_SESSIONS_EMAIL = 'e2e-sessions@example.com';

export const E2E_SESSIONS_PASSWORD = 'Test!1Aa';

export const E2E_API_BASE_URL = 'http://localhost:4030/api/v2';

export const FIREFOX_WINDOWS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';

/** Pass `page.request` so the session cookie lands in the browser's context. */
export async function loginSessionsUser(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${E2E_API_BASE_URL}/auth/login`, {
    data: { email: E2E_SESSIONS_EMAIL, password: E2E_SESSIONS_PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Ends every session but the caller's, so earlier runs leave nothing behind. */
export async function endOtherSessions(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${E2E_API_BASE_URL}/auth/sessions/revoke-others`);
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Signs in a mobile session for the sessions user and returns its access token. */
export async function loginSessionsUserMobile(
  request: APIRequestContext,
  deviceLabel: string
): Promise<string> {
  const response = await request.post(`${E2E_API_BASE_URL}/auth/mobile/token`, {
    data: {
      email: E2E_SESSIONS_EMAIL,
      password: E2E_SESSIONS_PASSWORD,
      device_label: deviceLabel,
    },
  });
  const body: unknown = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  if (!isRecord(body) || typeof body.access_token !== 'string' || body.access_token === '') {
    throw new Error('The mobile token response has no access_token');
  }
  return body.access_token;
}

/** A second device's API client, already signed in as the sessions user. The caller disposes it. */
export async function newOtherDeviceRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  userAgent: string
): Promise<APIRequestContext> {
  const request = await playwright.request.newContext({
    extraHTTPHeaders: { 'user-agent': userAgent },
  });
  await loginSessionsUser(request);
  return request;
}

export async function withAppDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5732'),
    user: process.env.SEED_DB_USER ?? 'podverse_app_read_write',
    password: process.env.SEED_DB_PASSWORD ?? 'test',
    database: process.env.DB_APP_NAME ?? 'podverse_app_test',
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/** HS256 with the E2E API's own secret, so the API accepts the token as one it issued. */
export function signE2eJwt(payload: Record<string, unknown>): string {
  const secret = buildPodverseApiTestEnv({ profile: 'apiWebE2e' }).AUTH_JWT_SECRET;
  if (secret === undefined || secret === '') {
    throw new Error('The web E2E API env has no AUTH_JWT_SECRET');
  }
  const signingInput = `${base64UrlJson({ alg: 'HS256', typ: 'JWT' })}.${base64UrlJson(payload)}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export async function readJwtCookie(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies()).find((entry) => entry.name === 'jwt');
  if (cookie === undefined || cookie.value === '') {
    throw new Error('The browser context has no jwt cookie');
  }
  return cookie.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeE2eJwtPayload(token: string): Record<string, unknown> {
  const payloadSegment = token.split('.')[1];
  if (payloadSegment === undefined) {
    throw new Error('The token has no payload segment');
  }
  const payload: unknown = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
  if (!isRecord(payload)) {
    throw new Error('The token payload is not an object');
  }
  return payload;
}
