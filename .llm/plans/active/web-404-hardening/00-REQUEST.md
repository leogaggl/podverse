# Web 404 hardening

## Request

web 404 hardening. Start from .llm/plans/active/web-404-hardening-deferred (00-SUMMARY.md and both plans) and re-check every dynamic route on current develop. Remove the deferred folder once the new request file exists.

## Operator answers

No questions were asked. The request names the source documents and the re-check.

The deferred folder was removed from this checkout after this file was written. Its three files are copied under Deferred source. Do not look for the folder.

## Glossary

- **notFound()**: Next.js App Router call that renders the not-found page for that route.
- **Dynamic route**: an App Router page whose path has a dynamic segment, such as `[channel_id]`.
- **API 404**: an HTTP 404 from the Podverse API request helper, which throws. It is not a Next.js not-found result by itself.

## Orientation

Checked while writing this file, from the deferred documents only. The route list below is the old audit. Re-check every dynamic route on the worktree's `develop`; do not treat the old list as complete.

- Architecture already chosen: one server loading boundary for detail-route data. API 404 becomes `notFound()`. Every other error is rethrown. Do not swallow 5xx, network, or auth errors.
- `generateMetadata` often already try/catches. The page body is what throws. Keep metadata fallback behavior unless the re-check shows the same unhandled API 404 throw there.
- Endpoints that return 200 with null stay as they are. Do not map those to `notFound()` unless the re-check shows the page already treats that null as missing.
- `apps/management-web` was outside the confirmed-risk list. Re-check it only to see whether the same unhandled API 404 throw exists now. Include a route only when that throw is there.
- Prior high-confidence `apps/web` routes: `/podcast/[channel_id]`, `/episode/[item_id]`, `/clip/[clip_id]`, `/chapter/[item_chapter_id_text]`, `/official-clip/[item_soundbite_id]`, `/track/[item_id]`, `/album/[channel_id]`, `/podcast/livestream/[item_id]`, `/music/livestream/[item_id]`, `/podcast-index/feed/[podcast_index_id]`.
- Files named in the old audit: `apps/web/src/lib/seo/fetchers.ts`, `packages/helpers-requests/src/api/_request.ts`, and the `page.tsx` for each route above. `ApiRequestService.apiRequest` rethrows; it does not return null on 404.
- The observed URL `/podcast/As8mB3rOfg` was repeated SSR error rendering in dev after an unhandled API 404, not a redirect loop.
- Plan 02 is the architecture (shared loader). Plan 01 is the earlier route list and the same 404 contract. Reconcile them after the re-check; do not ship two mechanisms.

## Deferred source

### 00-SUMMARY.md

# Deferred: Web 404 Hardening

This plan set is saved for later implementation.

## Context
- The observed behavior at `/podcast/As8mB3rOfg` is not a redirect loop.
- It is repeated SSR error rendering in dev after an unhandled API 404 throw.
- This risk exists in multiple dynamic pages in `apps/web`, not only podcast.

## Goal
- Introduce a single high-order server loading boundary that converts only API 404 errors to `notFound()`.
- Rethrow non-404 errors so real failures are still visible.
- Apply this consistently across affected dynamic detail routes.

## Saved plan documents
- `01-stop-404-render-loop-risk.md` (initial focused podcast/SEO plan)
- `02-global-web-404-hardening.md` (full-route audit and architecture plan)

## Implementation status
- Deferred by request.
- No code changes for 404 hardening have been implemented yet.

### 01-stop-404-render-loop-risk.md

# Stop 404 Render Loop Risk

## What is happening now
- The URL `/podcast/As8mB3rOfg` is not redirecting in a loop; it is throwing an unhandled server error in the page render path.
- In `apps/web/src/app/podcast/[channel_id]/page.tsx`, `getChannelForSeoPage(channel_id)` throws on API 404 before any guard can run.
- In `apps/web/src/lib/seo/fetchers.ts`, SEO fetchers directly call request methods that throw on 404.
- In `packages/helpers-requests/src/api/_request.ts`, `ApiRequestService.apiRequest` rethrows errors; it never returns `null` for 404.
- This creates repeated 500 renders/retries in dev UX (looks like a loop), not a redirect loop.

## Implementation approach
1. Add a shared 404 detector helper in `helpers-requests` (e.g., `isApiRequestNotFoundError`) to identify axios-style `response.status === 404`.
2. In `apps/web` SEO fetchers, introduce one centralized wrapper that converts only 404 to `notFound()` and rethrows all non-404 errors.
3. Route every SEO fetcher through that wrapper so all affected routes get consistent behavior (podcast, episode, clip, chapter, album, livestream variants, etc.).
4. Preserve existing non-404 behavior (e.g., upstream 500 still surfaces as error rather than silently pretending not-found).
5. Optional cleanup: remove unreachable `if (!ssrX) notFound()` checks in routes where awaited calls can only throw on missing data.

## Scope of affected route files (high confidence)
- `apps/web/src/app/podcast/[channel_id]/page.tsx`
- `apps/web/src/app/episode/[item_id]/page.tsx`
- `apps/web/src/app/clip/[clip_id]/page.tsx`
- `apps/web/src/app/chapter/[item_chapter_id_text]/page.tsx`
- `apps/web/src/app/official-clip/[item_soundbite_id]/page.tsx`
- `apps/web/src/app/track/[item_id]/page.tsx`
- `apps/web/src/app/album/[channel_id]/page.tsx`
- `apps/web/src/app/podcast/livestream/[item_id]/page.tsx`
- `apps/web/src/app/music/livestream/[item_id]/page.tsx`

## Safety checks
- Confirm no redirect cycle is introduced by ensuring only `notFound()` is used for 404 mapping.
- Keep `generateMetadata` fallback behavior unchanged unless explicitly desired.
- Add focused tests for the new 404 helper and at least one route-level behavior path (404 -> notFound).

### 02-global-web-404-hardening.md

# Global Page 404 Hardening

## Findings from full route audit
- This is not an actual redirect loop. It is repeated server re-rendering after an unhandled thrown 404 in a route page.
- In `apps/web`, this pattern appears in multiple dynamic detail pages (not just podcast): route body awaits a throwing API fetch without route-safe handling.
- `generateMetadata` often has try/catch, but the page body often does not, so metadata is safe while render still fails.
- `apps/management-web` does not currently show the same systemic pattern; server pages there generally catch and redirect/fallback.

## Confirmed risk scope (apps/web)
High-risk route pages include:
- `/episode/[item_id]`
- `/track/[item_id]`
- `/podcast/[channel_id]`
- `/album/[channel_id]`
- `/podcast/livestream/[item_id]`
- `/music/livestream/[item_id]`
- `/clip/[clip_id]`
- `/chapter/[item_chapter_id_text]`
- `/official-clip/[item_soundbite_id]`
- `/podcast-index/feed/[podcast_index_id]` (non-404 error path also possible)

## Architectural fix (single high-order boundary)
Implement one shared server-page loader utility in `apps/web` that becomes the only detail-route data boundary:

1. Add a small HTTP status extractor in `helpers-requests` (or locally in web if preferred) that reliably reads axios-style status from unknown errors.
2. Add `apps/web/src/lib/ssr/loadOrNotFound.ts` with strict behavior:
   - If status is 404: call `notFound()`.
   - Otherwise: rethrow (do not swallow 5xx/network/auth errors).
3. Route SEO/data fetchers through this boundary (or equivalent dedicated loaders):
   - `apps/web/src/lib/seo/fetchers.ts` becomes safe by default.
4. Apply that boundary to all detail-page loaders so every missing entity is deterministic `notFound()`.
5. Keep endpoint-specific semantics where APIs intentionally return 200 + null (do not force 404 behavior there unless product wants it).

## Why this is not a workaround
- It creates a clear contract at a single architectural seam: detail data load for route render.
- It preserves observability and correctness by only mapping explicit 404.
- It avoids per-page copy/paste try/catch and unreachable null checks.
- It scales to future pages with one import pattern and code review rule.

## Hardening additions
- Add unit tests for the new `loadOrNotFound` behavior (404 mapped, non-404 rethrown).
- Add focused page tests for a representative route (e.g. podcast + episode) ensuring unknown id resolves to Not Found page behavior.
- Add a small engineering rule/skill note so new dynamic pages must use the shared loader boundary.

## Rollout order
1. Introduce helper + tests.
2. Update `seo/fetchers.ts` (or page loader layer) to use helper.
3. Update all confirmed-risk pages.
4. Remove unreachable `if (!entity) notFound()` checks that can never run after thrown requests.
5. Add/adjust docs/rules for future-proofing.

## Questions for the planning run

Settle from the code. The old route list is a starting point.

1. Re-list every dynamic route on current `develop` under `apps/web`, and confirm whether `apps/management-web` still lacks the unhandled API 404 throw.
2. Put the shared loader in one place. Plan 02 names `apps/web/src/lib/ssr/loadOrNotFound.ts` and a status extractor in `helpers-requests`. Use that unless the code already has an equivalent.
3. Apply it everywhere the re-check finds a page body that awaits a throwing API fetch for a missing entity. Drop routes that no longer do that. Add routes the old audit missed.
4. Remove only the null `notFound()` checks that cannot run after a throwing fetch. Keep redirects and 200-plus-null handling.
5. Tests: unit coverage for 404 mapped and non-404 rethrown, plus focused page behavior for a representative route. Guidance: one rule or skill note that new dynamic detail pages use the shared boundary.
