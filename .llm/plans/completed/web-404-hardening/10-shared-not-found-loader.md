**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# Shared not-found loader and safe SEO fetchers

Add one server loading boundary in `apps/web` that turns an API 404 into `notFound()` and
rethrows everything else, then route every API-calling fetcher in
`apps/web/src/lib/seo/fetchers.ts` through it. After this plan, every detail page that loads its
entity through a fetcher renders the not-found page (HTTP 404) for an unknown id instead of the
error boundary.

This plan does not edit any `page.tsx`. Areas B, C, and D (plans 20–49) own the route files:
direct `ssrApiRequestService.req*` calls in page bodies, unreachable null checks, and
catch-all handlers.

## Rows

R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11

## Runs after

none

## Files

apps/web/src/lib/ssr/loadOrNotFound.ts
apps/web/src/lib/ssr/loadOrNotFound.test.ts
apps/web/src/lib/seo/fetchers.ts
apps/web/e2e/detail-route-not-found.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

## Contract for later plans

Wave 2 plans name these exactly.

- **Loader:** `loadOrNotFound` in `apps/web/src/lib/ssr/loadOrNotFound.ts`, a named export:

  ```typescript
  export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T>
  ```

  A page imports it with an extensionless relative path (Tier B), for example
  `import { loadOrNotFound } from '../../../lib/ssr/loadOrNotFound';` from
  `apps/web/src/app/takedown-notice/[podcast_index_id]/page.tsx`.
- **Status reader:** `getErrorResponseStatus` from `@podverse/helpers` (already exported from the
  root entry and from `@podverse/helpers/error`). There is **no** new helpers-requests export.
- **Wrapped `fetchers.ts` exports (11):** `getChannelForSeoPage`, `getItemForSeoPage`,
  `getPodcastIndexFeedForSeoPage`, `getInternalFeedForSeoPage`,
  `getChannelByPodcastIndexIdForSeoPage`, `getPublisherRemoteItemsForChannelSeoPage`,
  `getClipForSeoPage`, `getItemChapterForSeoPage`, `getItemSoundbiteForSeoPage`,
  `getAccountForSeoPage`, `getPlaylistForSeoPage`.
- **Inherits, not wrapped itself:** `getChannelForItemPage` (calls `getChannelForSeoPage` when the
  item carries no channel).
- **Unchanged:** `getChannelHeroImageUrl`, `getItemThenChannelHeroImageUrl`,
  `getPodcastIndexFeedHeroImageUrl` (no request). `apps/web/src/lib/seo/index.ts` re-exports are
  unchanged.
- **Representative spec:** `apps/web/e2e/detail-route-not-found.spec.ts`, top-level describe
  `'Detail route not found'`, covering `/podcast/[channel_id]` and `/episode/[item_id]`.

## Reconciling the deferred documents

- **R1:** the deferred summary and both deferred plans are copied verbatim into
  `00-REQUEST.md` § Deferred source. This plan is built from them plus a re-check of current code.
- **R2:** the deferred folder is already gone. `00-REQUEST.md` says so, and
  `.llm/plans/active/` has no `web-404-hardening-deferred` directory. Nothing to delete.
- **R3:** one mechanism. Deferred plan 01's "centralized wrapper in SEO fetchers" and deferred
  plan 02's `loadOrNotFound` are the same thing here: `loadOrNotFound` is the only place that maps
  a 404, and `fetchers.ts` calls it. No second wrapper, and no per-page try/catch that maps 404.

## Decisions settled from the code

- **Status reader (R6, R7).** The request allows reuse "unless the code already has an
  equivalent". `getErrorResponseStatus` in `packages/helpers/src/lib/error/errorParsing.ts` already
  reads `error.response.status` as an own property, and web, mobile, and v4v-metaboost already use
  it. Axios errors reach callers unchanged: `packages/http-request-core/src/request.ts` calls
  `axios.request` and does not wrap the error, and `ApiRequestService.apiRequest` in
  `packages/helpers-requests/src/api/_request.ts` logs then rethrows the same object. `AxiosError`
  assigns `response` in its constructor, so it is an own property. Do not add a helpers-requests
  extractor. Do not use `getStatusCodeFromError` from helpers-requests: it reads top-level
  `statusCode` / `status`, not `response.status`.
- **Where the loader lives (R7).** `apps/web/src/lib/ssr/loadOrNotFound.ts`. No `lib/ssr/`
  directory and no equivalent loader exist today.
- **Wrap inside each cached fetcher, around the request only.** `getSsrApiRequestService()` stays
  outside the loader, so only the entity request is mapped. React `cache` memoizes the rejection,
  so `generateMetadata` and the page body see the same not-found signal for one id.
- **Wrap all 11 request fetchers, including 200-with-null ones (R8).** `GET /feed/:podcast_index_id`
  and `GET /channel/podcast-index/:podcast_index_id` answer 200 with `null` for a missing feed
  (`apps/api/src/controllers/feed.ts`, `apps/api/src/controllers/channel.ts`), so wrapping them
  changes nothing for a missing entity. Their null handling stays (R31). Wrapping every fetcher
  keeps "safe by default" a rule with no exceptions to remember.
- **Callers that catch every error keep their behavior.** These catch the not-found signal like
  any other error, exactly as they catch the 404 today:
  - `generateMetadata` in every detail page returns its fallback metadata (R30).
  - `apps/web/src/lib/embed/fetchEmbedSingleResource.ts`,
    `fetchEmbedListData.ts`, `fetchEmbedListPlayIdTextOverrideRow.ts`, and
    `fetchEmbedBuilderSourceIntro.ts` return their own not-found result or `null`.
  - `apps/web/src/app/profile/[id_text]/page.tsx` still redirects to `/profiles`.
  - `apps/web/src/app/playlist/[playlist_id]/page.tsx` still calls `notFound()`.

  Area D decides whether the profile, playlist, and edit pages change.
- **No redirect cycle (R9).** The loader only calls `notFound()`. It never calls `redirect()` or
  `permanentRedirect()`. A redirect or not-found signal thrown inside `load` has no
  `response.status`, so the loader rethrows it untouched.
- **What the not-found page is.** `apps/web` has no `not-found.tsx`, so Next.js 16 renders its
  built-in page inside the root layout. Its text is `This page could not be found.`
  (`node_modules/next/dist/client/components/builtin/not-found.js`). No route has a `loading.tsx`,
  and neither the root layout nor `AppChrome` puts a Suspense boundary around page content, so a
  `notFound()` in a page body answers HTTP 404. The root `error.tsx` renders
  `Something Went Wrong` (`errors.boundary_title`), which is what an unknown id shows today.

## Implementation

### 1. `apps/web/src/lib/ssr/loadOrNotFound.ts` (new)

Write exactly this (imports: `next/*` first, then `@podverse/*`, as in sibling files):

```typescript
import { notFound } from 'next/navigation';

import { getErrorResponseStatus } from '@podverse/helpers';

/**
 * Server boundary for the entity a detail route renders. An API 404 renders the route's
 * not-found page. Every other failure, including 5xx, network, and auth errors and Next.js
 * navigation signals thrown inside `load`, propagates unchanged.
 */
export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (getErrorResponseStatus(error) === 404) {
      notFound();
    }
    throw error;
  }
}
```

### 2. `apps/web/src/lib/seo/fetchers.ts`

Add `import { loadOrNotFound } from '../ssr/loadOrNotFound';` after the `getSSRAuthService` import.
Change each of the 11 fetchers listed under § Contract so the request call goes through the loader.
Keep the `cache(...)` wrapper, the parameter names and types, and the request method and its
arguments. The pattern, shown for the first one:

```typescript
export const getChannelForSeoPage = cache(async (idOrIdText: string | number) => {
  const ssrApiRequestService = await getSsrApiRequestService();
  return loadOrNotFound(() => ssrApiRequestService.reqChannelGetByIdOrIdText(idOrIdText));
});
```

Apply the same shape to `getItemForSeoPage`, `getPodcastIndexFeedForSeoPage`,
`getInternalFeedForSeoPage`, `getChannelByPodcastIndexIdForSeoPage`,
`getPublisherRemoteItemsForChannelSeoPage`, `getClipForSeoPage`, `getItemChapterForSeoPage`,
`getItemSoundbiteForSeoPage`, `getAccountForSeoPage` (keeps `{ id_text: idText }`), and
`getPlaylistForSeoPage`. Let Prettier wrap any line past 100 characters. Leave
`getSsrApiRequestService`, `getChannelForItemPage`, and the three hero image helpers as they are.
Do not add explicit return types; the loader preserves each request's type.

### 3. `apps/web/src/lib/ssr/loadOrNotFound.test.ts` (new)

Vitest, colocated like `apps/web/src/lib/auth/jwtPayload.test.ts`. Mock `next/navigation` with a
hoisted `notFound` that throws a sentinel error, the way Next.js's own `notFound()` throws:

```typescript
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
```

Build real axios errors (`axios` is a direct `apps/web` dependency) so the test proves the
own-property read on an actual `AxiosError`, without type assertions:

```typescript
import { AxiosError, AxiosHeaders } from 'axios';

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
```

Clear the mock in `beforeEach`. Cases, with sentence-style titles:

1. A load that resolves returns its value, and `notFound` is not called.
1. A load that rejects with an axios 404 rejects with `NOT_FOUND_SIGNAL`, and `notFound` is called
   once.
1. `it.each([400, 401, 403, 410, 500, 503])`: a load that rejects with that axios status rejects
   with the **same** error object (`rejects.toBe(error)`), and `notFound` is not called.
1. A network failure (`new AxiosError('Network Error', 'ERR_NETWORK')`, no response) is rethrown
   unchanged, and `notFound` is not called.
1. A Next.js navigation signal thrown inside `load` (an `Error` with
   `digest: 'NEXT_REDIRECT;replace;/somewhere;307;'`, set with `Object.assign`) is rethrown
   unchanged, and `notFound` is not called.

### 4. `apps/web/e2e/detail-route-not-found.spec.ts` (new)

Follow **e2e-readability**, **e2e-suite-title**, and **e2e-screenshot-verified-element**. The ids
are deliberately absent from the seed; keep them as local constants in the spec, not in
`seedConstants.ts`. Both fit `nano_id_v2` (12 characters), so the API answers 404, not 400.

```typescript
import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const MISSING_PODCAST_ID_TEXT = 'e2eMissPod01';
const MISSING_EPISODE_ID_TEXT = 'e2eMissEp001';
const NOT_FOUND_TEXT = 'This page could not be found.';
const ERROR_BOUNDARY_TITLE = 'Something Went Wrong';
```

Top-level `test.describe('Detail route not found', ...)` with two tests:

- `When a visitor opens a podcast id that does not exist, they see the not-found page with a 404
  status.` — `const response = await page.goto(`/podcast/${MISSING_PODCAST_ID_TEXT}`)`;
  `expect(response?.status()).toBe(404)`; `toHaveURL` ending in that path (no redirect);
  `page.getByText(NOT_FOUND_TEXT)` visible; `page.getByText(ERROR_BOUNDARY_TITLE)` has count 0;
  `capturePageLoad(page, testInfo, 'The missing podcast shows the not-found page.', notFoundText)`.
- `When a visitor opens an episode id that does not exist, they see the not-found page with a 404
  status.` — the same steps for `/episode/${MISSING_EPISODE_ID_TEXT}`.

If the status assertion fails while the not-found text shows, report it as a finding in the final
message. Do not loosen the assertion.

### 5. `makefiles/local/e2e-spec-order-web.txt`

Insert `apps/web/e2e/detail-route-not-found.spec.ts` on the line after
`apps/web/e2e/medium-canonical-route-redirect.spec.ts` (both are detail-route routing contracts).

## What changes per route after this plan

So wave 2 plans start from the right baseline:

- **Not-found on an unknown id now, through fetchers:** `/podcast/[channel_id]`,
  `/album/[channel_id]`, `/episode/[item_id]`, `/track/[item_id]`,
  `/podcast/livestream/[item_id]`, `/music/livestream/[item_id]`, `/clip/[clip_id]`,
  `/chapter/[item_chapter_id_text]`, `/official-clip/[item_soundbite_id]`. Their channel, item,
  clip, chapter, and soundbite endpoints answer 404 through `handleReturnDataOrNotFound` or an
  explicit `res.status(404)`.
- **Depends on the endpoint:** `/artist/[channel_id]` uses
  `getPublisherRemoteItemsForChannelSeoPage`. `PublisherFeedController` in
  `apps/api/src/controllers/publisherFeed.ts` has no explicit 404 and no try/catch; area B
  confirms what it answers for a missing channel.
- **Still an error page for a bad id:** `/podcast-index/feed/[podcast_index_id]`. Its Podcast Index
  endpoint answers 500 when the lookup fails and 400 for a non-numeric id, never 404 (area B).
- **Direct request calls in page bodies, not covered here:** for example
  `apps/web/src/app/takedown-notice/[podcast_index_id]/page.tsx` calls
  `reqFeedGetByPodcastIndexId` directly. Wave 2 wraps such calls with `loadOrNotFound` when the
  endpoint can answer 404.

## Tests

- Unit: `apps/web/src/lib/ssr/loadOrNotFound.test.ts` (new) — 404 mapped; 400, 401, 403, 410,
  500, 503, network failure, and Next.js navigation signals rethrown unchanged; success returns the
  value.
- Playwright: `apps/web/e2e/detail-route-not-found.spec.ts` (new) — unknown podcast and episode
  ids answer 404 and show the not-found page, not the error boundary. Registered in
  `makefiles/local/e2e-spec-order-web.txt`.

## Release scratchpad

Append to `release-notes/scratchpad.md` (or, when this prompt shares a phase with other prompts,
put it in the final message under "Release notes entry"):

```markdown
## Unknown detail links show Not Found instead of an error page

- Surfaces: web
- Change: Podcast, album, episode, track, livestream, clip, chapter, and official clip pages now
  render the not-found page with HTTP 404 when the API answers 404 for the id in the URL. Before,
  the page threw and showed "Something Went Wrong" (and re-rendered repeatedly in dev). Every other
  API failure (5xx, network, auth) still shows the error page. Embed pages keep their current
  handling; the profile and playlist changes have their own entries.
- Who notices: visitors following a stale or mistyped link; search crawlers now get a 404 instead
  of a 500 for removed content
- Operator steps: none
```
