# 87 — Livestreams chip E2E (Playwright and Maestro)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

## Rows

- **R51**, **R52**: the Livestreams chip on every page that has it, and its order (live, then
  scheduled, no ended). **R53** is covered by the unit tests in plans 80 and 82 and by the Add
  by RSS step below (a parsed live item makes the feed's livestreams show).
- **R60** (row actions): Browse's More menu on a directory livestream row offers Share only.
- **R61** (the Add by RSS livestream page): the new `add-by-rss-livestream` flow.
- **R67** (mobile, plan 95): the same flow checks the feed page's live rows above the episode.
  Web's Add by RSS feed pages already listed live items; no web step.
- **R70** (web): that same parsed feed, once its live item has shown on the Livestreams chip, is
  still listed on `/add-by-rss` Podcasts. Plan 84 keeps a flagged feed on its medium's chip.

Runs last in area H, after plans 80–86, 89, and 95, and after plan 36 (its fixture registry in
`accountAddByRSSParse.ts`, `e2e-test.sh`, and `e2e/README.md`). Follows **e2e-readability**,
**e2e-screenshot-verified-element**, **e2e-report-order**, **mobile-maestro-timeouts**, and
**e2e-seed-nano-id-limits**.

## Seed facts (plan 80)

"Followed" means the seed user follows the channel.

| Item                                    | Channel                  | Status    | Followed |
| --------------------------------------- | ------------------------ | --------- | -------- |
| `E2E Livestream Item` (`e2eLiveStrm01`) | `E2E Livestream Channel` | live      | yes      |
| `E2E Live Audio Stream`                 | `E2E Live AV Channel`    | live      | no       |
| `E2E Live Video Stream`                 | `E2E Live AV Channel`    | live      | no       |
| `E2E Scheduled Livestream`              | `E2E Live AV Channel`    | scheduled | no       |

No seeded item has ended, so "no ended" is checked by the API (plan 81) and by the absence of
the Ended word on the list.

## Files

All paths are under `apps/` unless they start with `scripts/` or `.cursor/`.

| Path                                                               | Change            |
| ------------------------------------------------------------------ | ----------------- |
| `web/e2e/media-list-chips.spec.ts`                                 | Counts, new tests |
| `web/src/components/List/LiveItem/ListLiveItemRow.tsx`             | Row `data-testid` |
| `web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx` | Row `data-testid` |
| `mobile/e2e/browse.yaml`                                           | Livestreams step  |
| `mobile/e2e/home.yaml`                                             | Livestreams step  |
| `mobile/e2e/add-by-rss.yaml`                                       | Livestreams step  |
| `api/src/controllers/account/accountAddByRSSParse.ts`              | Live E2E fixture  |
| `mobile/e2e/add-by-rss-livestream.yaml`                            | New flow          |
| `scripts/mobile/e2e-test.sh`                                       | Register the flow |
| `mobile/e2e/README.md`                                             | List the flow     |
| `.cursor/skills/mobile-test-economics/SKILL.md`                    | List the flow     |

The spec is already in `makefiles/local/e2e-spec-order-web.txt` (plan 69); no order change.

## Playwright — `media-list-chips.spec.ts`

### Existing tests (plan 69)

- Browse: nine chips in order — Podcasts, Episodes, Clips, Artists, Albums, Tracks, Livestreams,
  Playlists, Users.
- Subscribed (signed in and signed out): seven chips — Podcasts, Episodes, Clips, Artists,
  Albums, Tracks, Livestreams.
- Add by RSS: six chips — Podcasts, Episodes, Artists, Albums, Tracks, Livestreams.
- The spec's `PARSED_FEED` gains one live item (shape read by `compatLiveItemsDtos` in
  `packages/parser-mapping/src/compat/partytime/liveItem.ts`):

```typescript
podcastLiveItems: [
  {
    title: 'E2E Chips Add by RSS Livestream',
    guid: 'e2e-chips-add-by-rss-live',
    status: 'live',
    start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    enclosure: {
      url: 'http://localhost:2111/audio/audio-001.mp3',
      type: 'audio/mpeg',
      length: 0,
    },
  },
],
```

Name it `E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE` at the top of the spec.

### Row test id

`ListLiveItemRow`'s root element gets `data-testid="list-live-item-row"` so a step can scope a
badge to its row. `AddByRSSLivestreamRow`'s root gets `data-testid="add-by-rss-livestream-row"`.

### New tests

1. **Browse Livestreams lists live streams first, then scheduled ones** (signed out):
   - `/browse?tab=livestreams`: the Livestreams chip is pressed; the heading is "Browse".
   - The rows `E2E_LIVE_AV_AUDIO_ITEM_TITLE`, `E2E_LIVESTREAM_ITEM_TITLE`, and
     `E2E_LIVE_AV_SCHEDULED_ITEM_TITLE` are visible. Each row is
     `page.getByTestId('list-live-item-row').filter({ hasText: <title> })`.
   - The two live rows contain the text "Live"; the scheduled row contains "Scheduled".
   - The scheduled row's `boundingBox().y` is greater than both live rows' `y`.
   - The main column has no "Ended" text, no "Global" text in the page header, and no view
     selector (`getByRole('button', { name: /grid/i })` count 0; use the label the
     `ViewSelector` actually renders).
   - Clicking the audio row's title link goes to a URL containing `/podcast/livestream/`.
1. **Subscribed Livestreams lists followed channels only** (signed in with `loginSeedUser`):
   - `/?tab=livestreams`: the Livestreams chip is pressed; `E2E_LIVESTREAM_ITEM_TITLE` is
     visible with "Live" in its row; `E2E_LIVE_AV_SCHEDULED_ITEM_TITLE` has count 0.
1. **Add by RSS livestreams show on the Add by RSS page and on Subscribed** (signed in, the
   nested `describe`'s stubs):
   - `/add-by-rss?tab=livestreams`: the chip is pressed; a link
     `a[href*="/add-by-rss/podcast/livestream/"]` with `E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE`
     is visible (15 s, the parse lands first); its row contains "Live"; the header has the
     "Check for Updates" and "Add Feed" buttons and no view selector.
   - Podcasts, in that same test, after the Livestreams step above (R70). Step sentence: "The
     feed that has a live item is still listed on the Podcasts chip." Click
     `page.getByTestId('media-list-chips').getByRole('button', { name: 'Podcasts', exact: true })`.
     It is pressed (`aria-pressed="true"`). The URL pathname is `/add-by-rss` and the query has
     no `tab`. Click the chip; a visit with no query stays on Livestreams, because opening
     `?tab=livestreams` stored that chip (plan 60). The feed link is
     `a[href*="/add-by-rss/podcast/"]:not([href*="/livestream/"])` filtered by
     `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE`, the title `PARSED_FEED` already uses. It is
     visible on the default timeout; the Livestreams step already waited for the parse. That
     href is plan 67's podcasts list (`AddByRSSListClient` with `resourceType="podcasts"`,
     `/add-by-rss/podcast/${idText}`). Screenshot centered on the feed link. This step checks
     only that the feed link is visible.
   - `/?tab=livestreams`: the same Add by RSS link is visible beside `E2E_LIVESTREAM_ITEM_TITLE`.

Every step captures a screenshot centered on the element it verifies.

### Other web specs

Search `apps/web/e2e` for `podcasts/livestreams`, `music/livestreams`, `podcasts-livestreams`,
and `music-livestreams`. A spec that still opens the old list routes (outside plan 69's 404
test) moves to `/browse?tab=livestreams`; one that asserted the live/scheduled/ended tabs drops
those steps. List any you change in the final message.

## Maestro

Use `${TIMEOUT_*}` from `shared/timeouts.env`, fastest that can succeed. iOS omits off-screen
test ids, so swipe the chip row itself (`from: id: <selector>`), as the flows already do.

### `browse.yaml`

- The existing swipes toward Playlists and Users now pass one more chip; add one more `swipe`
  if `browse-media-type-users` is not reached.
- New section after the Users step (or before it, wherever the row shows the chip): tap
  `browse-media-type-livestreams`; `extendedWaitUntil` text `E2E Live Audio Stream`
  (`TIMEOUT_SLOWER`); `assertVisible` text `E2E Scheduled Livestream`; `assertNotVisible` id
  `browse-sort-button` and id `browse-category-button`; `takeScreenshot:
browse-media-type-livestreams`.
- Row actions (R60), on the followed live row `e2eLiveStrm01` (Browse rows use `HomeFeedRow`'s
  ids): tap id `home-row-more-e2eLiveStrm01`; `extendedWaitUntil` id
  `media-row-menu-e2eLiveStrm01` (`TIMEOUT_FASTER`); `assertVisible` id
  `media-row-action-share-e2eLiveStrm01`; `assertNotVisible` ids
  `media-row-action-queue-next-e2eLiveStrm01`, `media-row-action-queue-last-e2eLiveStrm01`,
  `media-row-action-add-to-playlist-e2eLiveStrm01`, and
  `media-row-action-mark-as-played-e2eLiveStrm01`; `takeScreenshot:
browse-livestream-row-more-menu`; tap id `media-row-menu-e2eLiveStrm01-cancel`. Read the menu
  id format from `MediaRowActions.tsx` and `podcast-episode.yaml` before writing the step.
- Tap text `E2E Live Audio Stream`; `extendedWaitUntil` id `episode-detail-screen`
  (`TIMEOUT_SLOW`); `takeScreenshot: browse-livestream-detail`; `runFlow:
shared/stack-back.yaml`; assert `browse-screen`.

### `home.yaml`

After the Tracks section returns to `home-screen`: restore the chip row
(`shared/restore-chip-row-start.yaml`), swipe `home-media-type-selector` LEFT until the chip
shows, tap `home-media-type-livestreams`, `extendedWaitUntil` text `E2E Livestream Item`
(`TIMEOUT_SLOWEST`; the home-livestreams sync job fills it after sign-in), `assertNotVisible` id
`home-sort-button`, `assertNotVisible` text `E2E Scheduled Livestream`, `takeScreenshot:
home-media-type-livestreams`.

### `add-by-rss.yaml`

At the end, on `rss-root-screen`: swipe the `rss-media-type-selector` row LEFT as needed, tap
`rss-media-type-livestreams`, `assertVisible` id `rss-livestreams-empty` (the seeded Add by RSS
feeds carry no live items), `assertNotVisible` id `rss-sort`, `takeScreenshot:
add-by-rss-livestreams-empty`. Confirm the selector's id in `AddByRssRootScreen.tsx`
(`MediaTypeSelector` with `testIDPrefix="rss"`).

### API fixture — `accountAddByRSSParse.ts` (E2E fixtures only)

- `E2eParsedFeedFixture` gains `liveItems?: { guid: string; startOffsetMs: number; status:
  'live' | 'pending'; title: string }[]`.
- New constants beside plan 36's sections fixture:
  - `E2E_ADD_BY_RSS_LIVE_FEED_URL = 'https://e2e-seed-addbyrss.example/podcast-live.xml'`
  - `E2E_ADD_BY_RSS_LIVE_PARSED_FEED`: channel title `'E2E Add-by-RSS Live Channel'`, item title
    `'E2E Add-by-RSS Live Channel Episode'`, guid
    `'https://e2e-seed-addbyrss.example/item-guid/live-channel'`, the default fixture's other
    fields, and two live items: `'E2E Add-by-RSS Live Now'` (`status: 'live'`, start one hour
    ago) and `'E2E Add-by-RSS Scheduled Live'` (`status: 'pending'`, start one day ahead), guids
    `'https://e2e-seed-addbyrss.example/live-guid/now'` and `.../live-guid/scheduled`.
- Register the URL in plan 36's fixture `Record`. `buildE2eParsedFeedPayload` adds, only when
  `liveItems` is set, `podcastLiveItems` in the shape this plan's web spec uses: `title`, `guid`,
  `status`, `start: new Date(Date.now() + startOffsetMs).toISOString()`, and `enclosure: { url:
  'http://localhost:2111/audio/audio-001.mp3', type: 'audio/mpeg', length: 0 }`.
- One-line doc comment: a feed with one live and one scheduled livestream, for the mobile Add by
  RSS livestream flow. The fixture path stays behind `config.e2e.fixturesEnabled`.

### `add-by-rss-livestream.yaml` (new)

Header like plan 36's `add-by-rss-episode-sections.yaml`: `name: Add By RSS Livestream Flow`,
a comment naming the fixture feed, and `# Needs flow_needs_e2e_api + flow_needs_test_assets.`

1. `shared/launch-and-connect.yaml`, `shared/login-seeded-user.yaml`; tap `tab-my-library`,
   `library-nav-add-by-rss`, `rss-add-button`, `rss-url-input`; input
   `https://e2e-seed-addbyrss.example/podcast-live.xml`; tap `rss-add-submit`;
   `extendedWaitUntil` id `rss-root-screen` (`TIMEOUT_SLOWER`).
2. `shared/reveal-chip-row-trailing.yaml` with `CHIP_ROW_ID: rss-media-type-selector`,
   `TRAILING_ID: rss-media-type-livestreams`; tap it. `extendedWaitUntil` text `E2E Add-by-RSS
   Live Now` (`TIMEOUT_SLOWER`; the parse lands first); `assertVisible` text `E2E Add-by-RSS
   Scheduled Live`; `assertNotVisible` id `"home-row-more-.*"` (Add by RSS live rows have no
   More); `takeScreenshot: add-by-rss-livestream-rows`.
3. Tap text `E2E Add-by-RSS Scheduled Live`; `extendedWaitUntil` id
   `add-by-rss-livestream-detail-screen` (`TIMEOUT_SLOW`); `assertVisible` id
   `add-by-rss-livestream-detail-summary`; `assertNotVisible` id
   `add-by-rss-livestream-detail-play-chrome` (no play, no More);
   `takeScreenshot: add-by-rss-livestream-scheduled-page`; `shared/stack-back.yaml`.
4. Tap text `E2E Add-by-RSS Live Now`; `extendedWaitUntil` id
   `add-by-rss-livestream-detail-screen`; `assertVisible` id `"home-row-play-.*"`;
   `assertNotVisible` id `"home-row-more-.*"`; `takeScreenshot:
add-by-rss-livestream-live-page`; `shared/stack-back.yaml`; `extendedWaitUntil` id
   `rss-root-screen`.
5. Tap id `"home-row-play-.*"` (only the live row has play); `extendedWaitUntil` id
   `mini-player` (`TIMEOUT_SLOWER`); `takeScreenshot: add-by-rss-livestream-playing`.
6. Cleanup: `shared/reveal-chip-row-leading.yaml` with `LEADING_ID: rss-media-type-podcasts`;
   tap it; tap text `E2E Add-by-RSS Live Channel` `childOf` id `rss-feed-list` (the mini player
   also names the channel); `extendedWaitUntil` id `add-by-rss-home-detail-screen`.
7. Feed page live rows (R67, plan 95). The mini player also shows `E2E Add-by-RSS Live Now`,
   so anchor on row test ids, not that text. Plan 95's ids: row
   `add-by-rss-home-live-${row.id}`, play `add-by-rss-home-play-live-${row.id}`, where `row.id`
   ends with the live guid; confirm both in `AddByRssEpisodesSection.tsx` first.
   - `extendedWaitUntil` id `"add-by-rss-home-live-.*live-guid/now"` (`TIMEOUT_FAST`).
   - `assertVisible` id `"add-by-rss-home-live-.*live-guid/scheduled"` with `below:` id
     `"add-by-rss-home-live-.*live-guid/now"`.
   - `assertVisible` text `E2E Add-by-RSS Live Channel Episode` with `below:` id
     `"add-by-rss-home-live-.*live-guid/scheduled"`.
   - `assertVisible` id `"add-by-rss-home-play-live-.*live-guid/now"`; `assertNotVisible` id
     `"add-by-rss-home-play-live-.*live-guid/scheduled"`.
   - `takeScreenshot: add-by-rss-feed-live-rows`.
   - Tap text `E2E Add-by-RSS Scheduled Live`; `extendedWaitUntil` id
     `add-by-rss-livestream-detail-screen` (`TIMEOUT_SLOW`); `takeScreenshot:
add-by-rss-feed-live-row-opens-page`; `shared/stack-back.yaml`; `extendedWaitUntil` id
     `add-by-rss-home-detail-screen`.
8. Tap `add-by-rss-home-remove`; then the same `notVisible` check `add-by-rss.yaml` ends with.

Removing goes back one screen, so cleanup starts from the Podcasts chip, not the livestream
page. Then:

- `scripts/mobile/e2e-test.sh`: add `add-by-rss-livestream` after plan 36's
  `add-by-rss-episode-sections` in both `flow_needs_e2e_api` and `flow_needs_test_assets`.
- `apps/mobile/e2e/README.md` "Current flows" and the **mobile-test-economics** Discovery row:
  add `add-by-rss-livestream` after `add-by-rss-episode-sections`.

## Tests

This plan is the test. No unit tests.

## Release scratchpad

No entry; tests, test ids, and an E2E-only API fixture behind `config.e2e.fixturesEnabled`.
