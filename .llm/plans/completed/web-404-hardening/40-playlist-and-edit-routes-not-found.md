**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Playlist and edit routes use the shared not-found boundary

`/playlist/[playlist_id]`, `/playlist/edit/[playlist_id]`, and `/clip/edit/[clip_id]` each wrap
their entity request in a try/catch that calls `notFound()` for **every** error. A 5xx, a network
failure, or a 401 renders "This page could not be found." and is never logged as a failure. This
plan routes all three through the shared boundary from plan 10, so only an API 404 renders Not
Found and every other error reaches the error page.

This plan also records the area D re-check of every dynamic route outside the channel and item
families, including `apps/management-web`.

## Rows

R26, R27, R28, R29, R30, R31, R32

## Runs after

10

## Files

apps/web/src/app/playlist/[playlist_id]/page.tsx
apps/web/src/app/playlist/edit/[playlist_id]/page.tsx
apps/web/src/app/clip/edit/[clip_id]/page.tsx
apps/web/e2e/playlist-and-edit-route-not-found.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

## Contract this plan relies on (plan 10)

- `getPlaylistForSeoPage` and `getClipForSeoPage` in `apps/web/src/lib/seo/fetchers.ts` run their
  request through `loadOrNotFound`. An API 404 throws the Next.js not-found signal; every other
  error is rethrown unchanged.
- Both fetchers use the same SSR request service as `getSSRAuthService()` (the session JWT from
  the cookie), and both API requests send `withCredentials: true`. Switching the edit pages from a
  direct `ssrApiRequestService.req*` call to the fetcher sends the identical request.
- `apps/web/e2e/detail-route-not-found.spec.ts` exists and is listed in
  `makefiles/local/e2e-spec-order-web.txt`.

## Re-check of area D routes (R26, R27, R28)

Checked on this worktree's `develop`.

### `apps/web` — routes this plan changes

| Route | Today | API for a missing id | After this plan |
| --- | --- | --- | --- |
| `/playlist/[playlist_id]` | Catch-all `notFound()` around `getPlaylistForSeoPage` | `GET /playlist/:id` answers 404 when missing, and 404 for a private playlist the viewer does not own | 404 renders Not Found; other errors reach the error page |
| `/playlist/edit/[playlist_id]` | Catch-all `notFound()` around `ssrApiRequestService.reqPlaylistGet` | same endpoint | same as above |
| `/clip/edit/[clip_id]` | Catch-all `notFound()` around `ssrApiRequestService.reqClipGet` | `GET /clip/:id` answers 404 when missing or private to someone else, 410 `{ removed: true }` to a non-owner when the episode was removed | 404 renders Not Found; removed clip renders the visitor removed-clip shell; other errors reach the error page |

These three routes and `/profile/[id_text]` (plan 41) are routes the old audit missed (R27). None
had the unhandled throw; each instead hid every failure behind Not Found or a redirect.

`GET /playlist/:id` and `GET /clip/:id` validate the id only as a required string
(`playlistIdTextParamSchema`, `clipIdTextParamSchema` in
`apps/api/src/lib/validation/querySchemas.ts`), so a malformed id answers 404, not 400.

### `apps/web` — routes with no change

- **Embed (9 routes):** `embed/album/[channel_id]`, `embed/chapter/[item_chapter_id_text]`,
  `embed/clip/[clip_id]`, `embed/episode-chapters/[item_id]`, `embed/episode/[item_id]`,
  `embed/official-clip/[item_soundbite_id]`, `embed/playlist/[playlist_id]`,
  `embed/podcast/[channel_id]`, `embed/track/[item_id]`. Each page renders
  `EmbedTypedRoutePage`, which calls `fetchEmbedListData` or `fetchEmbedSingleResource`. Both
  wrap every fetch in a catch-all and return the embed's own not-found shell
  (`EmbedNotFoundShell`). No unhandled throw. The rule from plan 11 keeps embed loaders as they
  are. Dropped.
- **Add by RSS (9 routes):** `add-by-rss/[resource]/[id_text]`, `album/[id]`, `artist/[id]`,
  `credentials/[id]`, `episode/[episodeId]`, `music/livestream/[id]`, `podcast/[id]`,
  `podcast/livestream/[id]`, `track/[id]`. Every page only reads `params` and renders a client
  component; Add by RSS data lives on the device. `[resource]/[id_text]` calls `notFound()` for
  an unknown resource type, which is correct. No server fetch. Dropped.

### `apps/management-web` (R28)

The 11 dynamic pages under `apps/management-web/src/app/(management)/` have **no** unhandled API
404 throw. No management-web change.

- `admins/[id]/edit`: `getAdminAccountById` is inside try/catch that redirects to the admins list.
- `database/[table]/[id]`: `getTableRow` is inside try/catch that redirects to the table.
- `storage/[key]`: the `/storage` probe is inside try/catch that redirects to the dashboard.
- `admins/[id]`, `billing/help/[slug]`, `database/[table]`, `database/[table]/new`,
  `notifications/[id]`, `users/[id]`, `users/[id]/edit`, `users/[id]/billing`: no server API
  fetch besides the session check. `billing/help/[slug]` calls `notFound()` for an unknown slug.
- The session helpers (`getManagementSession`, `getManagementSessionUser` in
  `apps/management-web/src/lib/auth/serverManagementSession.ts`) catch every error and return
  `null`, which each page turns into a redirect home.

### Rows R29–R32 for these routes

- **R29:** the three changed routes now load through the boundary; embed, Add by RSS, and
  management-web are dropped (no unhandled throw).
- **R30:** `generateMetadata` on `/playlist/[playlist_id]` keeps its try/catch fallback
  unchanged. The two edit routes return static noindex metadata and fetch nothing there.
- **R31:** neither endpoint answers 200 with `null`; both answer 404. Nothing to keep.
- **R32:** the `if (!ssrPlaylist) notFound()` and `if (!ssrClip) notFound()` checks cannot run
  (`apiRequest<T>` resolves `T` or throws), so they are removed. No redirect exists on these
  routes.

## Implementation

### 1. `apps/web/src/app/playlist/[playlist_id]/page.tsx`

- Delete `import { notFound } from 'next/navigation';`.
- Leave `generateMetadata` exactly as it is.
- Replace the body of `PlaylistPage` with:

```tsx
export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { playlist_id } = await params;
  const ssrPlaylist = await getPlaylistForSeoPage(playlist_id);

  return <PlaylistPageClient ssrPlaylist={ssrPlaylist} />;
}
```

### 2. `apps/web/src/app/playlist/edit/[playlist_id]/page.tsx`

Load through the wrapped fetcher instead of a direct request. The whole file becomes:

```tsx
import { buildNoindexMetadata } from '../../../../lib/seo/buildNoindexMetadata';
import { getPlaylistForSeoPage } from '../../../../lib/seo/fetchers';
import { PlaylistEditPageClient } from './PlaylistEditPageClient';

type PlaylistEditPageProps = {
  params: Promise<{ playlist_id: string }>;
};

export async function generateMetadata() {
  return buildNoindexMetadata();
}

export default async function PlaylistEditPage({ params }: PlaylistEditPageProps) {
  const { playlist_id } = await params;
  const ssrPlaylist = await getPlaylistForSeoPage(playlist_id);

  return <PlaylistEditPageClient ssrPlaylist={ssrPlaylist} />;
}
```

### 3. `apps/web/src/app/clip/edit/[clip_id]/page.tsx`

Load through `getClipForSeoPage`, and handle the removed-clip 410 the way
`apps/web/src/app/clip/[clip_id]/page.tsx` does (parity source): a non-owner gets the visitor
removed-clip shell. Every other error, including the not-found signal, is rethrown.

- Imports: delete `import { notFound } from 'next/navigation';` and the `getSSRAuthService`
  import. Keep `import { z } from 'zod';`. Add, in this order after `zod` and a blank line:

```tsx
import { RemovedClipPage } from '../../../../components/Clip/RemovedClipPage';
import { isRemovedClipHttpError } from '../../../../lib/clip/removedClip';
import { buildNoindexMetadata } from '../../../../lib/seo/buildNoindexMetadata';
import { getClipForSeoPage } from '../../../../lib/seo/fetchers';
import { ClipEditPageClient } from './ClipEditPageClient';
```

- Replace the request block in `ClipEditPage` (from `const { ssrApiRequestService } = ...`
  through the closing `}` of the catch) with:

```tsx
  let ssrClip;
  try {
    ssrClip = await getClipForSeoPage(clip_id);
  } catch (error) {
    if (isRemovedClipHttpError(error)) {
      return <RemovedClipPage kind="visitor" />;
    }
    throw error;
  }
```

- Leave `searchParamsSchema`, `parseSearchParams`, `generateMetadata`, and the returned
  `<ClipEditPageClient ... />` unchanged.

The owner of a removed clip gets 200 from the API and keeps today's edit page; this plan does not
change that.

### 4. `apps/web/e2e/playlist-and-edit-route-not-found.spec.ts` (new)

Follow **e2e-readability**, **e2e-suite-title**, and **e2e-screenshot-verified-element**. Mirror
the shape of `apps/web/e2e/detail-route-not-found.spec.ts` from plan 10. All tests run signed
out. The missing ids are deliberately absent from the seed; keep them as local constants. Both
are 12 characters and differ from plan 10's ids.

```typescript
import { expect, test } from '@playwright/test';

import { buildPlaylistPath } from '@podverse/helpers';

import { E2E_REMOVED_CLIP_ID_TEXT, E2E_REMOVED_CLIP_TITLE } from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const MISSING_PLAYLIST_ID_TEXT = 'e2eMissPl001';
const MISSING_CLIP_ID_TEXT = 'e2eMissClp01';
const NOT_FOUND_TEXT = 'This page could not be found.';
const ERROR_BOUNDARY_TITLE = 'Something Went Wrong';
/** Web E2E sets NEXT_PUBLIC_BRAND_NAME to this value. */
const E2E_BRAND_NAME = 'PodverseE2E';
const CLIP_REMOVED_SENTENCE = `The episode for this clip was removed from ${E2E_BRAND_NAME}.`;
```

Top-level `test.describe('Playlist and edit routes not found', ...)` with four tests:

1. `When a visitor opens a playlist id that does not exist, they see the not-found page with a 404
   status.` — `const response = await page.goto(buildPlaylistPath(MISSING_PLAYLIST_ID_TEXT))`;
   `expect(response?.status()).toBe(404)`; `toHaveURL` ending in that path (no redirect);
   `page.getByText(NOT_FOUND_TEXT)` visible; `page.getByText(ERROR_BOUNDARY_TITLE)` has count 0;
   `capturePageLoad(page, testInfo, 'The missing playlist shows the not-found page.', notFoundText)`.
1. `When a visitor opens the edit page for a playlist id that does not exist, they see the
   not-found page with a 404 status.` — same steps for
   `/playlist/edit/${MISSING_PLAYLIST_ID_TEXT}`.
1. `When a visitor opens the edit page for a clip id that does not exist, they see the not-found
   page with a 404 status.` — same steps for `/clip/edit/${MISSING_CLIP_ID_TEXT}`.
1. `When a signed-out visitor opens the edit page for a clip whose episode was removed, they see
   the removed clip sentence instead of an error.` — `page.goto(`/clip/edit/${E2E_REMOVED_CLIP_ID_TEXT}`)`;
   `page.getByText(CLIP_REMOVED_SENTENCE, { exact: true })` visible;
   `page.getByText(E2E_REMOVED_CLIP_TITLE, { exact: true })` has count 0;
   `page.getByText(ERROR_BOUNDARY_TITLE)` and `page.getByText(NOT_FOUND_TEXT)` each have count 0;
   `capturePageLoad(page, testInfo, 'The removed clip edit link shows the removed clip sentence.', sentence)`.
   Do not assert the status code here; the middleware's 410 applies only to `/clip/[clip_id]`.

If a 404 status assertion fails while the not-found text shows, report it as a finding in the
final message. Do not loosen the assertion.

### 5. `makefiles/local/e2e-spec-order-web.txt`

Insert `apps/web/e2e/playlist-and-edit-route-not-found.spec.ts` on the line after
`apps/web/e2e/detail-route-not-found.spec.ts` (added by plan 10). If another wave 2 plan already
inserted a not-found spec there, put this line after the last consecutive `*not-found*.spec.ts`
line.

## Out of scope, observed during the re-check

`PlaylistController.getPlaylistById` in `apps/api/src/controllers/playlist/playlist.ts` calls
`playlistService.getOnePrivate(account.id_text, ...)` whenever the request is signed in, and that
query filters by the viewer's account. A signed-in user who opens another account's public
playlist gets 404, so the playlist page shows Not Found. Plan 50 owns the API fix: a signed-in
caller gets the same non-private playlist a signed-out caller gets. This plan does not change the
API, and its spec runs signed out, so it does not depend on plan 50.

## Tests

- Playwright: `apps/web/e2e/playlist-and-edit-route-not-found.spec.ts` (new) — unknown playlist,
  playlist edit, and clip edit ids answer 404 and show the not-found page, not the error page;
  a removed clip's edit link shows the removed-clip sentence. Registered in
  `makefiles/local/e2e-spec-order-web.txt`.
- Existing specs that must still pass unchanged: `apps/web/e2e/playlist-edit-play.spec.ts`,
  `apps/web/e2e/removed-content.spec.ts`, `apps/web/e2e/clip-editor-modal.spec.ts`.

## Release scratchpad

```markdown
## Playlist and edit pages report API failures instead of showing Not Found

- Surfaces: web
- Change: `/playlist/[playlist_id]`, `/playlist/edit/[playlist_id]`, and `/clip/edit/[clip_id]`
  render the not-found page (HTTP 404) only when the API answers 404 for the id in the URL. Before,
  every failure, including 5xx, network, and auth errors, rendered Not Found. Those failures now
  show the error page and reach the logs. A signed-out visitor who opens the edit link of a clip
  whose episode was removed sees the removed-clip message, as on the clip page, instead of Not
  Found.
- Who notices: visitors during an API outage see an error instead of a false "missing" page;
  visitors following a stale playlist or edit link see no difference
- Operator steps: none
```
