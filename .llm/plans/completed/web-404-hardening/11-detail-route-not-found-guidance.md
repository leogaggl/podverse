**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Guidance: new dynamic detail pages use the shared not-found boundary

Add one scoped Cursor rule so a new or edited dynamic detail page in `apps/web` loads its entity
through `loadOrNotFound`, and point the rule index at it. Guidance only; no product code.

The rule names `loadOrNotFound` in `apps/web/src/lib/ssr/loadOrNotFound.ts` and the wrapped
fetchers in `apps/web/src/lib/seo/fetchers.ts`, both specified in
[10-shared-not-found-loader.md](10-shared-not-found-loader.md). The rule text does not depend on
that code existing yet, so this plan edits disjoint files and can run beside plan 10.

The rule carries one exception, settled by the operator (review D5, R33): a missing or private
profile at `/profile/[id_text]` redirects to `/profiles` for an API 404 only. The rule names the
mechanism [41-profile-route-not-found.md](41-profile-route-not-found.md) uses, so the two agree.
The rule does not cite plan numbers.

## Rows

R12, R33

## Runs after

none

## Files

.cursor/rules/web-detail-route-not-found.mdc
.cursor/rules/rule-index.mdc

## Implementation

### 1. `.cursor/rules/web-detail-route-not-found.mdc` (new)

Write exactly this content. It follows **comments-future-forward** (states the code as it
stands, cites no plan) and **llm-safe-plan-vocabulary**. Prettier formats `.mdc` like markdown:
keep lines at or under 100 characters.

````markdown
---
description: A dynamic detail page in apps/web loads its entity through loadOrNotFound, so an API 404 renders Not Found and every other error stays visible
globs:
  - "apps/web/src/app/**/page.tsx"
  - "apps/web/src/lib/seo/fetchers.ts"
  - "apps/web/src/lib/ssr/**"
alwaysApply: false
---

# Web detail routes: an API 404 becomes `notFound()`

A dynamic detail page is an `apps/web` route whose path names one entity: `/podcast/[channel_id]`,
`/episode/[item_id]`, `/clip/[clip_id]`, and the like. It loads that entity through one server
boundary, `loadOrNotFound` in `apps/web/src/lib/ssr/loadOrNotFound.ts`.

- An API 404 calls `notFound()`. The route renders the not-found page with HTTP 404.
- Every other error is rethrown unchanged: 5xx, network failures, timeouts, 400, 401, 403, and
  410. The error page and the logs still show them.

## Do

- Load the page's entity with a `get*ForSeoPage` fetcher from `apps/web/src/lib/seo/fetchers.ts`.
  Every fetcher there that sends a request already runs it through `loadOrNotFound`.
- Add a new entity fetch to `fetchers.ts` beside its siblings, in the same shape:

  ```typescript
  export const getThingForSeoPage = cache(async (idText: string) => {
    const ssrApiRequestService = await getSsrApiRequestService();
    return loadOrNotFound(() => ssrApiRequestService.reqThingGet(idText));
  });
  ```

- When a page body calls `ssrApiRequestService.req*` directly for the entity it renders, wrap
  that call: `await loadOrNotFound(() => ssrApiRequestService.reqThingGet(idText))`.
- Keep the try/catch fallback in `generateMetadata`. Its catch also receives the not-found
  signal and returns the fallback metadata; the page body still renders Not Found.
- Read an HTTP status from an unknown error with `getErrorResponseStatus` from
  `@podverse/helpers`. It reads the axios `response.status`.

## Don't

- Don't catch every error and call `notFound()`. That shows a 5xx or a network failure as missing
  content.
- Don't call `redirect()` for a missing entity. Only `notFound()` maps a 404, so the boundary
  cannot start a redirect cycle. The profile route below is the one exception.
- Don't wrap a `loadOrNotFound` call in a try/catch that maps every error to one outcome. The
  catch swallows the not-found signal along with real failures.
- Don't map a 200 response with `null` to `notFound()` unless the page already treats that null
  as missing. Lookups such as the feed and channel by Podcast Index id answer 200 with `null`.
- Don't leave `if (!entity) notFound()` after a call that throws for a missing entity. It cannot
  run.
- Don't run secondary loads (episode lists, podroll, soundbites, live items) through
  `loadOrNotFound` when their 404 does not mean the page's entity is missing. They keep their own
  handling, such as `loadChannelItemList`.
- Don't write a local status reader or a second loader.

## The one redirect: `/profile/[id_text]`

A missing profile, or one private to the viewer, redirects to `/profiles` instead of rendering
Not Found. Only an API 404 for the account redirects; every other error is rethrown. No other
detail route redirects for a missing entity. Adding another exception is a product decision, not
a code-review call.

- `apps/web/src/app/profile/[id_text]/page.tsx` still loads the account through
  `getAccountForSeoPage`, so the 404 reaches the page as the Next.js not-found signal, not as an
  axios error. `getErrorResponseStatus` does not apply at that point.
- The page catches around that one call only. It redirects when
  `isHTTPAccessFallbackError(error) && getAccessFallbackHTTPStatus(error) === 404`, both from
  `next/dist/client/components/http-access-fallback/http-access-fallback`, and rethrows anything
  else. These are Next.js's own guards for the signal; do not compare `error.digest` to a string.
- The `/auth/me` call and the `/my-profile` redirect for the viewer's own profile stay outside
  that catch.
- `/profiles` loads no single account, so the redirect cannot cycle.

## Scope

This rule covers server pages in `apps/web`. Embed loaders in `apps/web/src/lib/embed/` catch
every error and return their own not-found result; they stay that way.
````

### 2. `.cursor/rules/rule-index.mdc`

Append one bullet at the end of the list, after the `even-content-spacing` bullet, in the same
style (wrap continuation lines with two spaces):

```markdown
- A new dynamic detail page in `apps/web`, or a server fetch for the entity a page renders →
  `web-detail-route-not-found`
```

## Tests

none — guidance only.

## Release scratchpad

none
