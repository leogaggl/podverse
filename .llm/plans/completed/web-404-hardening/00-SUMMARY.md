# Web 404 hardening — summary

Request: [00-REQUEST.md](00-REQUEST.md). Models and prompts: [COPY-PASTA.md](COPY-PASTA.md). Run
order and file ownership: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

## Goal

An API 404 for the entity a dynamic detail route renders becomes `notFound()` through one shared
server loading boundary in `apps/web`. Every other error is rethrown. One mechanism, not two.

## Requirement ledger

Rows quote the request, including its Deferred source section. A row marked with several areas is
a constraint every listed area applies to its own routes; each area's plans list it under
`## Rows`.

- **R1** (area A) "Start from .llm/plans/active/web-404-hardening-deferred (00-SUMMARY.md and both plans)" — Plan: 10
- **R2** (area A) "Remove the deferred folder once the new request file exists." — Plan: 10
- **R3** (area A) "Plan 02 is the architecture (shared loader). Plan 01 is the earlier route list and the same 404 contract. Reconcile them after the re-check; do not ship two mechanisms." — Plan: 10
- **R4** (area A) "Introduce a single high-order server loading boundary that converts only API 404 errors to `notFound()`." — Plan: 10
- **R5** (area A) "Rethrow non-404 errors so real failures are still visible." / "Do not swallow 5xx, network, or auth errors." — Plan: 10
- **R6** (area A) "Add a small HTTP status extractor in `helpers-requests` (or locally in web if preferred) that reliably reads axios-style status from unknown errors." — Plan: 10
- **R7** (area A) "Put the shared loader in one place. Plan 02 names `apps/web/src/lib/ssr/loadOrNotFound.ts` and a status extractor in `helpers-requests`. Use that unless the code already has an equivalent." — Plan: 10
- **R8** (area A) "Route SEO/data fetchers through this boundary (or equivalent dedicated loaders): `apps/web/src/lib/seo/fetchers.ts` becomes safe by default." — Plan: 10
- **R9** (area A) "Confirm no redirect cycle is introduced by ensuring only `notFound()` is used for 404 mapping." — Plan: 10
- **R10** (area A) "Tests: unit coverage for 404 mapped and non-404 rethrown" — Plan: 10
- **R11** (area A) "plus focused page behavior for a representative route" / "(e.g. podcast + episode) ensuring unknown id resolves to Not Found page behavior." — Plan: 10
- **R12** (area A) "Guidance: one rule or skill note that new dynamic detail pages use the shared boundary." — Plan: 11
- **R13** (area B) "re-check every dynamic route on current develop" — channel and feed routes — Plan: 20
- **R14** (area B) "`/podcast/[channel_id]`" and "The observed URL `/podcast/As8mB3rOfg` was repeated SSR error rendering in dev after an unhandled API 404" — Plan: 20 (fixed by 10)
- **R15** (area B) "`/album/[channel_id]`" — Plan: 20 (fixed by 10)
- **R16** (area B) "`/podcast-index/feed/[podcast_index_id]` (non-404 error path also possible)" — Plan: 20
- **R17** (area B) "Add routes the old audit missed." — channel and feed routes (`/artist/[channel_id]`, `/takedown-notice/[podcast_index_id]`) — Plan: 20
- **R18** (area C) "re-check every dynamic route on current develop" — item routes — Plan: 30
- **R19** (area C) "`/episode/[item_id]`" — Plan: 30 (fixed by 10)
- **R20** (area C) "`/track/[item_id]`" — Plan: 30 (fixed by 10)
- **R21** (area C) "`/podcast/livestream/[item_id]`" — Plan: 30 (fixed by 10)
- **R22** (area C) "`/music/livestream/[item_id]`" — Plan: 30 (fixed by 10)
- **R23** (area C) "`/clip/[clip_id]`" — Plan: 30
- **R24** (area C) "`/chapter/[item_chapter_id_text]`" — Plan: 30
- **R25** (area C) "`/official-clip/[item_soundbite_id]`" — Plan: 30
- **R26** (area D) "re-check every dynamic route on current develop" — account, playlist, owner edit, embed, and Add by RSS routes — Plan: 40, 41
- **R27** (area D) "Add routes the old audit missed." — account, playlist, owner edit, embed, and Add by RSS routes — Plan: 40, 41
- **R28** (area D) "Re-list every dynamic route on current `develop` under `apps/web`, and confirm whether `apps/management-web` still lacks the unhandled API 404 throw." / "Include a route only when that throw is there." — Plan: 40
- **R29** (areas B, C, D) "Apply it everywhere the re-check finds a page body that awaits a throwing API fetch for a missing entity. Drop routes that no longer do that." — Plan: 20, 30, 40, 41
- **R30** (areas B, C, D) "Keep metadata fallback behavior unless the re-check shows the same unhandled API 404 throw there." — Plan: 20, 30, 40, 41
- **R31** (areas B, C, D) "Endpoints that return 200 with null stay as they are. Do not map those to `notFound()` unless the re-check shows the page already treats that null as missing." — Plan: 20, 30, 40, 41
- **R32** (areas B, C, D) "Remove only the null `notFound()` checks that cannot run after a throwing fetch. Keep redirects and 200-plus-null handling." — Plan: 20, 30, 40, 41
- **R33** (area D, step 06) "A missing or private profile redirects to `/profiles` only for an API 404. Every other error is rethrown. Opening your own profile still redirects to `/my-profile`." — Plan: 41, 11
- **R34** (area E, step 07) "A signed-in `GET /playlist/:id` returns another account's non-private playlist, the same playlist a signed-out caller would get. The owner still gets their own playlist. A private playlist the viewer does not own stays 404." — Plan: 50

## Areas

### Area A — Shared 404 boundary and SEO fetchers

- **Rows:** R1–R12.
- **Plan number block:** 10–19.
- **Wave:** 1.
- **Starts from:** `packages/helpers-requests/src/api/_request.ts` (`ApiRequestService.apiRequest`
  rethrows), the existing status checks in
  `packages/helpers-requests/src/api/skipApiRequestErrorLogForFeedContentNotFound.ts` and
  `apps/web/src/lib/channel/loadChannelItemList.ts` (`response?.status === 404`), and
  `apps/web/src/lib/seo/fetchers.ts` (every `get*ForSeoPage` calls a throwing request method).
  No `apps/web/src/lib/ssr/` directory and no shared 404 status helper exist today.
- **Depends on:** none.
- **Shared files:** owns `apps/web/src/lib/seo/fetchers.ts`, the new loader module, the
  helpers-requests status extractor and its package export, the guidance rule, and the
  representative not-found Playwright spec. Areas B, C, and D consume all of these.
- **Contract for later areas:** the area A plan states the loader's exported name and signature,
  which `fetchers.ts` exports are wrapped, and the representative spec's path, so wave 2 plans
  can name them exactly.

### Area B — Channel and feed detail routes

- **Rows:** R13–R17, R29–R32.
- **Plan number block:** 20–29.
- **Wave:** 2.
- **Starts from:** `apps/web/src/app/podcast/[channel_id]/page.tsx`,
  `apps/web/src/app/album/[channel_id]/page.tsx`, `apps/web/src/app/artist/[channel_id]/page.tsx`
  (uses `getPublisherRemoteItemsForChannelSeoPage`, then `reqPodrollGetForChannel`),
  `apps/web/src/app/podcast-index/feed/[podcast_index_id]/page.tsx`, and
  `apps/web/src/app/takedown-notice/[podcast_index_id]/page.tsx` (calls
  `reqFeedGetByPodcastIndexId` directly with no catch).
- **Depends on:** area A (step 02, plans 10–19).
- **Shared files:** reads `fetchers.ts` and the loader from area A. Any edit to `fetchers.ts` or
  the representative spec goes in its own plan with `## Runs after` naming the area A plan, so
  Close can serialize it.

### Area C — Item detail routes

- **Rows:** R18–R25, R29–R32.
- **Plan number block:** 30–39.
- **Wave:** 2.
- **Starts from:** `apps/web/src/app/episode/[item_id]/page.tsx`,
  `apps/web/src/app/track/[item_id]/page.tsx`,
  `apps/web/src/app/podcast/livestream/[item_id]/page.tsx`,
  `apps/web/src/app/music/livestream/[item_id]/page.tsx`,
  `apps/web/src/app/clip/[clip_id]/page.tsx`,
  `apps/web/src/app/chapter/[item_chapter_id_text]/page.tsx`, and
  `apps/web/src/app/official-clip/[item_soundbite_id]/page.tsx`.
- **Depends on:** area A (step 02, plans 10–19).
- **Shared files:** same rule as area B for `fetchers.ts` and the representative spec.

### Area D — Account, playlist, owner edit, embed, and Add by RSS routes; management-web re-check

- **Rows:** R26–R33.
- **Plan number block:** 40–49.
- **Wave:** 2.
- **Starts from:** `apps/web/src/app/profile/[id_text]/page.tsx` (redirects to `/profiles` on
  failure), `apps/web/src/app/playlist/[playlist_id]/page.tsx`,
  `apps/web/src/app/playlist/edit/[playlist_id]/page.tsx`, and
  `apps/web/src/app/clip/edit/[clip_id]/page.tsx` (the last three catch every error and call
  `notFound()`, which also hides 5xx), `apps/web/src/app/embed/**/page.tsx` and
  `apps/web/src/app/add-by-rss/**/page.tsx` (no server fetch seen in the page file; confirm), and
  the eleven dynamic pages under `apps/management-web/src/app/(management)/` (they catch and
  redirect; confirm none throws an unhandled API 404).
- **Depends on:** area A (step 02, plans 10–19).
- **Shared files:** same rule as area B for `fetchers.ts` and the representative spec. A
  management-web change, if the re-check finds one, may need the helpers-requests status
  extractor from area A.

### Area E — Signed-in read of another account's playlist

- **Rows:** R34.
- **Plan number block:** 50–59.
- **Wave:** second pass, step 07, beside step 06. Its files are the API playlist read, not the web
  pages in plans 40 and 41.
- **Starts from:** `PlaylistController.getPlaylistById` in
  `apps/api/src/controllers/playlist/playlist.ts`. When the request is signed in it calls
  `getOnePrivate`, which filters by the viewer's account, so another account's non-private
  playlist becomes 404 after `verifyPrivatePlaylistOwnershipIfNeeded` has already allowed it.
  A signed-out caller uses `getOnePublic`.
- **Depends on:** step 05 only for the note in plan 40. No dependency on the web loader.
- **Shared files:** plan 40's markdown, for the out-of-scope note only. No shared product file
  with plans 10, 11, 20, 30, 40, or 41.

## Waves

- **Wave 1:** area A. Every other area uses the loader and the `fetchers.ts` behavior it defines.
- **Wave 2:** areas B, C, and D, in parallel. They own disjoint route files.

## Decisions to review

Settled. Answers are in `00-REQUEST.md` under "Review of the first planning pass".

Collected from the area steps' final messages. Step 04 (area C, plan 30) reported none.

- **D1** (step 02, plan 10) No new status reader in `helpers-requests`. The loader reuses `getErrorResponseStatus` from `@podverse/helpers`, which already reads axios `response.status` and is used by web, mobile, and other packages; the request allows reuse when "the code already has an equivalent". Alternative: add a near-copy reader to `helpers-requests` and export it.
- **D2** (step 02, plan 10) All 11 request-sending fetchers in `apps/web/src/lib/seo/fetchers.ts` go through `loadOrNotFound`, including the two Podcast Index lookups that answer 200 with null. Wrapping those changes nothing and keeps "safe by default" free of exceptions. Alternative: wrap only fetchers whose endpoint can answer 404.
- **D3** (step 02, plan 10) Callers that catch every error keep their current behavior in plan 10: metadata fallbacks, embed loaders, the profile redirect to `/profiles`, and the playlist page catch. Profile and playlist changes are left to area D (plans 40 and 41). Alternative: change those pages in plan 10.
- **D4** (step 03, plan 20) An unknown artist id stays on the error page. `GET /publisher-feed/channel/:id` answers 200 with `channel: null`, the artist page has no missing branch, and R31 says not to map that to `notFound()`. Alternative: add `if (response.channel === null) notFound()` so `/artist/<unknown>` matches `/podcast/<unknown>`.
- **D5** (step 05, plan 41) Profile: a missing or private account renders Not Found instead of redirecting to `/profiles`; the redirect to `/my-profile` for your own profile stays. Matches every other detail route and plan 11's rule. R32 says "Keep redirects"; the planner read that as the redirects left after removing unreachable null checks, not this one. Alternative: keep the `/profiles` redirect for 404 only and rethrow other errors, which needs profile-specific 404 detection and an exception in plan 11's rule.
- **D6** (step 05, plan 40) The playlist, playlist edit, and clip edit pages drop their catch-all `notFound()` and load through the shared boundary, even though none had the unhandled throw. A 5xx, network, or auth failure then shows the error page instead of a false Not Found. Alternative: leave their catch-all as it is.
- **D7** (step 05, plan 40) A visitor opening a removed clip's edit link sees `RemovedClipPage kind="visitor"`, as `/clip/[clip_id]` does. The page answers 200, because middleware sets 410 only on `/clip/<id>`. Alternative: keep showing Not Found for that case.

Also flagged by step 05, and now R34: `PlaylistController.getPlaylistById` uses `getOnePrivate(viewer)` whenever the request is signed in, so a signed-in user opening someone else's public playlist gets 404. Step 07 plans that fix. Plan 40 does not change the API.

## Order

First planning pass: areas A–D. Wave 1 is area A. Wave 2 is areas B, C, and D together.

Second pass after the first review: R33 and R34. Step 06 revises plans 11 and 41 so a missing or
private profile redirects to `/profiles` on a 404 and every other error is rethrown. Step 07
writes the signed-in playlist read in block 50–59 and updates plan 40's out-of-scope note. They
share a heading because their plan files are disjoint. D1, D2, D3, D4, D6, and D7 stay as the
first pass wrote them.
