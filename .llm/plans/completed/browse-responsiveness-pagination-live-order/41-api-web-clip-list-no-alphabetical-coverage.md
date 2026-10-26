**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 41 — API and web: tests that hold clip lists to Recent, Oldest, and Top

## Rows

R13, R14, R15

## Runs after

10, 21

Plan 10 adds a test to `apps/web/e2e/media-list-chips.spec.ts` after
`'Browse chips keep the chosen chip in the URL and in this browser'`. Plan 21 edits the
`'When Browse Livestreams is opened signed out, …'` test in the same file. This plan adds one test
between the Subscribed/Browse Sort test and the Browse Livestreams test. No other plan in the set
edits `apps/api/src/test/clip.test.ts`.

## Operator decision

D9: clips never offer an A-Z sort, on the API, web, mobile, or anywhere else. Clip lists default to
Recent. A saved A-Z preference for clips falls back to Recent when read. Podcasts, episodes, and
channels keep A-Z.

## Why there is no API or web product change

Each clip list is already limited to Recent, Oldest, and Top, so this plan adds regression tests and
changes no product code.

- **API routes** (`apps/api/src/routes/clip.ts`): one route per order. `/public/{recent,oldest,top}`,
  `/public/category/{recent,oldest,top}`, `/public/channel/{recent,oldest,top}/:channel_id_text`,
  `/public/item/{recent,oldest,top}/:item_id_text`, `/public/subscribed/{recent,top}`. `/private`
  takes no sort. Profile clips are `/:account_id_text/clips/recent` and `/clips/recent` only
  (`apps/api/src/routes/profileContent.ts`, public and my-profile routers). The `/az` path convention used by channels and playlists
  has no clip route. The controllers order by `created_at` or popularity stats only.
- **OpenAPI** is registered from these routes, so it lists no clip A-Z either.
- **Request helpers** (`packages/helpers-requests/src/api/clip/clip.ts`): `reqClipGetManyPublic`
  takes `QueryParamsGetManyPartial.sort` (`recent`, `oldest`, `top`). The channel and item clip
  helpers take `SORT_RECENT_OLDEST_TOP`.
- **Web sort controls:** Browse and Subscribed Clips offer Recent and Top
  (`getEpisodesPageSortOptions`). The podcast Clips tab offers Recent, Oldest, and Top. The episode
  Clips tab offers Recent, Oldest, and Top, and Official Clips offers Recent and Oldest. The profile
  Clips tab is Recent only.
- **Web stored preferences:** apps/web does not use the `@podverse/ui` table sort cookies. Clip list
  prefs live in the `local-settings` cookie:
  - `fd.clips` and `fd['subscribed-clips']` (typed `QueryParamsSubscribedPartialSort`) are read in
    `loadClipsListProps` (`apps/web/src/app/_media-lists/clips/clipsListSsr.ts`) and passed through
    `getEpisodesPageFilterParams` → `buildSubscribedListFilterParams` → `getValidQueryParam`, which
    replaces any token outside `QUERY_PARAMS_GLOBAL_SORT_VALUES` / `QUERY_PARAMS_SUBSCRIBED_PARTIAL_SORT`
    with `recent`.
  - Podcast and episode Clips tab entries in `sp` go through `resolveStoredToken` →
    `pickSortPrefToken`, which falls back to the tab's default (Recent) for any token it does not
    offer.
  So a hand-edited or older cookie with `a_z` for clips already reads as Recent. The E2E below locks
  that in.
- **Add by RSS:** the web Add by RSS page has no Clips chip, so there is no Add by RSS clip list to
  match (add-by-rss-parity-sync).
- **R15:** podcast, episode, channel, artist, and album lists keep A-Z. Nothing here touches them.

Mobile Home Clips is the only clip list that offers A-Z today; plan 40 removes it.

## Changes

### 1. `apps/api/src/test/clip.test.ts`

After the last `describe('GET /public/subscribed/top', …)` block, inside `describe('clip routes')`,
add:

```ts
describe('No A-Z order for clips', () => {
  it.each([
    '/public/az?medium=all&page=1',
    '/public/category/az?medium=all&page=1',
    `/public/channel/az/${CHANNEL_ID_TEXT}?page=1`,
    `/public/item/az/${ITEM_ID_TEXT}?page=1`,
    '/public/subscribed/az?medium=all&page=1',
  ])('answers 404 for GET %s and reads no clips', async (path) => {
    const res = await request(app).get(`${clipBase}${path}`);

    expect(res.status).toBe(404);
    expect(clipGetManyPublicMock).not.toHaveBeenCalled();
    expect(clipGetManyByChannelAndCountPublicMock).not.toHaveBeenCalled();
    expect(clipGetManyByItemAndCountPublicMock).not.toHaveBeenCalled();
    expect(clipGetManyByChannelsMock).not.toHaveBeenCalled();
  });
});
```

Use the constants and mocks the file already defines (`CHANNEL_ID_TEXT`, `ITEM_ID_TEXT`, `clipBase`,
`app`, the `clip*Mock` hoisted mocks). The file has no `beforeEach` that clears call counts, so
give this `describe` its own `beforeEach(() => { vi.clearAllMocks(); })` (it clears calls and keeps
the hoisted implementations). Add `beforeEach` to the `vitest` import if it is missing. Every
path has at least two segments, so none of them can match `GET /:clip_id_text`.

### 2. `apps/web/e2e/media-list-chips.spec.ts`

Insert this test right after
`'Subscribed and Browse lists put Sort and the gear after the media chips, and only where the list uses them'`
and before `'When Browse Livestreams is opened signed out, …'`. It uses the file's existing
`sortChip`, `expectAppPath`, and `capturePageLoad` helpers.

```ts
test('Clip lists sort by Recent or Top, never A-Z, and a saved A-Z for clips opens on Recent', async ({
  page,
}, testInfo) => {
  await test.step('Browse Clips opens on Recent and its Sort menu offers Recent and Top but not A-Z', async () => {
    await page.goto('/browse?tab=clips');
    await expect(sortChip(page)).toHaveAccessibleName('Sort: Recent');
    await sortChip(page).click();
    const sortMenu = page.getByRole('menu', { name: 'Sort' });
    await expect(sortMenu).toBeVisible();
    await expect(sortMenu.getByRole('menuitemradio', { name: 'Recent', exact: true })).toBeVisible();
    await expect(sortMenu.getByRole('menuitemradio', { name: 'Top', exact: true })).toBeVisible();
    await expect(sortMenu.getByRole('menuitemradio', { name: 'A-Z', exact: true })).toHaveCount(0);

    await capturePageLoad(page, testInfo, 'The Browse Clips sort menu lists Recent and Top only.', sortMenu);
    await page.keyboard.press('Escape');
  });

  await test.step('Signed-out Subscribed Clips also offers Recent and Top but not A-Z', async () => {
    await page.goto('/?tab=clips');
    await expect(sortChip(page)).toHaveAccessibleName('Sort: Recent');
    await sortChip(page).click();
    const sortMenu = page.getByRole('menu', { name: 'Sort' });
    await expect(sortMenu).toBeVisible();
    await expect(sortMenu.getByRole('menuitemradio', { name: 'A-Z', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  await test.step('A saved A-Z for Browse Clips in this browser opens on Recent', async () => {
    const baseURL =
      typeof testInfo.project.use.baseURL === 'string'
        ? testInfo.project.use.baseURL
        : 'http://localhost:4032';
    const settings = {
      uit: 'dark',
      vs: 'grid',
      seda: false,
      aqc: { rp: false, rd: false },
      fd: { clips: { type: 'global', sort: 'a_z', range: null, category: null } },
      sp: [],
    };
    await page.context().addCookies([
      { name: 'local-settings', value: encodeURIComponent(JSON.stringify(settings)), url: baseURL },
    ]);

    await page.goto('/browse?tab=clips');
    await expectAppPath(page, '/browse');
    await expect(sortChip(page)).toHaveAccessibleName('Sort: Recent');

    await capturePageLoad(
      page,
      testInfo,
      'Browse Clips reads Recent even when this browser saved A-Z for clips.',
      sortChip(page)
    );
  });
});
```

Match the file's conventions for anything this sketch gets wrong (for example how other tests
read `baseURL`, as `apps/web/e2e/channel-merge-redirect.spec.ts` does, or whether `expectAppPath`
checks the query string). Keep the step titles as complete sentences (e2e-readability). If the
Sort menu does not close on Escape, close it the way the earlier Sort test in this file does.

## Files

apps/api/src/test/clip.test.ts
apps/web/e2e/media-list-chips.spec.ts

## Tests

This plan is the tests:

- API: `apps/api/src/test/clip.test.ts`, "No A-Z order for clips" (five 404 cases, no clip reads).
- Web E2E: the new `media-list-chips.spec.ts` test above. Browse Clips and signed-out Subscribed
  Clips menus have no A-Z, and a planted `fd.clips.sort = 'a_z'` cookie opens on Recent.

If either test fails because product code does offer or keep A-Z for clips, stop and report the
route or file. Do not widen this plan into a product change.

## Release scratchpad

None (tests only; no shipped behavior changes).
