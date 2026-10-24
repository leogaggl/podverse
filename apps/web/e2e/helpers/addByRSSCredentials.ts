import type { Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';

import type { AddByRSSParseCacheEntry, AddByRSSPublisherListedFeed } from '@podverse/helpers';

export const E2E_API_BASE_URL = 'http://localhost:4030/api/v2';

const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';

/** test-assets gates every path under `/basic-auth/` behind these credentials. */
export const E2E_BASIC_AUTH_USERNAME = 'username';
export const E2E_BASIC_AUTH_PASSWORD = 'password';
const E2E_BASIC_AUTH_FEED_URL = 'http://localhost:2111/basic-auth/feeds/feed-basic-auth.rss';
export const E2E_BASIC_AUTH_AUDIO_URL = 'http://localhost:2111/basic-auth/audio/audio-001.mp3';

/**
 * A distinct protected feed URL per spec. Follows persist on the seeded account across specs,
 * so each spec follows its own URL and unfollows it afterwards.
 */
export const buildE2eProtectedFeedUrl = (label: string): string =>
  `${E2E_BASIC_AUTH_FEED_URL}?e2e=${label}`;

export async function loginSeedUser(page: Page): Promise<void> {
  const response = await page.request.post(`${E2E_API_BASE_URL}/auth/login`, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function followFeedOnServer(
  page: Page,
  params: { feedUrl: string; title: string; requiresCredentials: boolean }
): Promise<void> {
  const response = await page.request.post(
    `${E2E_API_BASE_URL}/account/follow/add-by-rss-channel`,
    {
      data: {
        feed_url: params.feedUrl,
        title: params.title,
        requires_credentials: params.requiresCredentials,
      },
    }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Best-effort cleanup; a spec that failed before following leaves nothing to remove. */
export async function unfollowFeedOnServer(page: Page, feedUrl: string): Promise<void> {
  await page.request.post(`${E2E_API_BASE_URL}/account/unfollow/add-by-rss-channel`, {
    data: { feed_url: feedUrl },
  });
}

export type StubbedParseOutcome = Pick<
  AddByRSSParseCacheEntry<never>,
  'status' | 'failureReason' | 'credentialsState' | 'httpStatus' | 'authChallenge'
> & {
  /** Partytime-shaped feed a `parsed` outcome returns. Omitted, the feed keeps its stored title. */
  payload?: Record<string, unknown>;
  /** On a parsed artist outcome: the feeds it lists, as the API returns them. */
  publisherListedFeeds?: AddByRSSPublisherListedFeed[];
};

export type StubbedParseRequests = {
  /** JSON bodies sent to `POST /account/add-by-rss/parse` for the stubbed feed, in order. */
  enqueueBodies: Record<string, unknown>[];
};

const REQUEST_ID_PREFIX = 'e2e-credentials-';

export const corsHeaders = (route: Route): Record<string, string> => ({
  'Access-Control-Allow-Origin': route.request().headers()['origin'] ?? 'http://localhost:4032',
  'Access-Control-Allow-Credentials': 'true',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameFeedUrl = (a: unknown, b: string): boolean => {
  if (typeof a !== 'string') {
    return false;
  }
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
};

/** A response for a page that already navigated away has nowhere to go. */
const fulfillUnlessGone = async (
  route: Route,
  response: Parameters<Route['fulfill']>[0]
): Promise<void> => {
  try {
    await route.fulfill(response);
  } catch {
    // The request was aborted with its page.
  }
};

/**
 * Stands in for the parse queue, which the web E2E stack does not run (no broker or workers).
 * Only parses of `feedUrl` are stubbed; parses of other feeds (the background refresh's first
 * parse of the seeded follows) reach the API. The Nth stubbed enqueue resolves to the Nth outcome
 * (the last outcome repeats). Status answers wait for `statusReleased` when given.
 */
export async function stubAddByRSSParse(
  page: Page,
  params: {
    feedUrl: string;
    outcomes: StubbedParseOutcome[];
    statusReleased?: Promise<void>;
  }
): Promise<StubbedParseRequests> {
  const { feedUrl, outcomes, statusReleased } = params;
  const enqueueBodies: Record<string, unknown>[] = [];

  await page.route('**/account/add-by-rss/parse', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body: unknown = route.request().postDataJSON();
    if (!isRecord(body) || !sameFeedUrl(body['feed_url'], feedUrl)) {
      await route.continue();
      return;
    }
    enqueueBodies.push(body);
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      headers: corsHeaders(route),
      body: JSON.stringify({ request_id: `${REQUEST_ID_PREFIX}${enqueueBodies.length - 1}` }),
    });
  });

  await page.route('**/account/add-by-rss/parse/status/*', async (route) => {
    const requestId = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    if (!requestId.startsWith(REQUEST_ID_PREFIX)) {
      await route.continue();
      return;
    }
    if (statusReleased) {
      await statusReleased;
    }
    const index = Number.parseInt(requestId.replace(REQUEST_ID_PREFIX, ''), 10);
    const outcome = outcomes[Math.min(Number.isFinite(index) ? index : 0, outcomes.length - 1)];
    await fulfillUnlessGone(route, {
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders(route),
      body: JSON.stringify({
        requestId,
        feedUrl,
        updatedAt: new Date().toISOString(),
        ...outcome,
      }),
    });
  });

  return { enqueueBodies };
}

export type StubbedParseAllRequests = {
  /** How many `POST /account/add-by-rss/parse/all` requests the page sent. */
  count: () => number;
};

/** Answers every refresh-all with no work, and counts the requests. */
export async function stubAddByRSSParseAll(page: Page): Promise<StubbedParseAllRequests> {
  let requests = 0;
  await page.route('**/account/add-by-rss/parse/all', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    requests += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: corsHeaders(route),
      body: JSON.stringify({ request_ids: [], deduped_feed_urls: [], dedupe_ttl_seconds: null }),
    });
  });
  return { count: () => requests };
}

/** The local feed idText behind a row in the needs-credentials section. */
export async function readNeedsCredentialsFeedIdText(
  page: Page,
  feedTitle: string
): Promise<string> {
  const link = page
    .getByTestId('add-by-rss-needs-credentials-section')
    .getByRole('link', { name: new RegExp(feedTitle) });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = (await link.getAttribute('href')) ?? '';
  const idText = href.split('/').pop() ?? '';
  expect(idText, `needs-credentials link href: ${href}`).not.toBe('');
  return idText;
}
