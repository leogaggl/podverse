# 69 — Web chips pages: Playwright coverage

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R20, R46, R47, R48, R49, R50 (browser checks), R63 (no Library Profiles link). Web E2E
only: `apps/web/e2e/` and
`makefiles/local/e2e-spec-order-web.txt`. Runs after plans 60–68. Follows **e2e-readability**,
**e2e-url-state-contracts**, **e2e-screenshot-verified-element**, and **e2e-report-order**.

Shares `add-by-rss-auto-parse.spec.ts` with plan 92 (keep its listener and step) and plan 71's
spec, whose list URL this step's planning already changed to `/add-by-rss`.

## Locked decisions

1. **One new spec**, `e2e/media-list-chips.spec.ts`, listed in the spec order file right after
   `apps/web/e2e/focus-states.spec.ts`.
1. **Existing specs move to the new URLs** (list in § Existing specs). A spec keeps its subject;
   only its route, heading, and sidebar locators change.
1. **Chip locators.** The chip row is `page.getByTestId('media-list-chips')`; a chip is
   `chipRow.getByRole('button', { name: '<Label>', exact: true })`; the selected chip has
   `aria-pressed="true"`.
1. **Add by RSS data** comes from the seeded follow of the test-assets feed
   (`E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE`), with `stubAddByRSSParse` returning a parsed feed (no
   `statusReleased`, so it answers at once) and `stubAddByRSSParseAll`, as
   `add-by-rss-auto-parse.spec.ts` does. Its `PARSED_FEED` shape is copied into the new spec with
   its own episode title, `E2E Chips Add by RSS Episode`, and a 2025 `pubDate`.

## New spec: `media-list-chips.spec.ts`

`test.describe('Subscribed, Browse, and Add by RSS chips pages', …)`. Each test uses
`test.step` sentences and screenshot captures centered on the element each step verifies.

1. **Browse chips keep the chosen chip in the URL and in this browser** (signed out):
   - `/browse` shows the heading "Browse" and eight chips in order: Podcasts, Episodes, Clips,
     Artists, Albums, Tracks, Playlists, Users. Podcasts is pressed; the URL has no `tab`.
   - Clicking Artists gives `/browse?tab=artists`, Artists pressed, and the heading
     `E2E_DIRECTORY_ARTIST_TITLE` visible.
   - Reloading keeps Artists. Opening `/browse` with no query restores Artists (stored chip).
   - Clicking Podcasts returns to `/browse` with no `tab`.
1. **Browse Playlists and Users chips show public lists without type tabs** (signed out):
   - `/browse?tab=playlists`: Playlists pressed; no button named "Create Playlist"; no "My
     Playlists" tab.
   - `/browse?tab=users`: Users pressed; the type dropdown is gone, so the page header shows no
     "Global" text (`page.locator('header').getByText('Global', { exact: true })` has count 0).
1. **A Browse category link keeps the chip** (signed out): on `/browse?tab=episodes`, choose a
   category through the categories modal (as the Episodes list does today); the URL becomes
   `/browse?tab=episodes&category=<key>` and Episodes stays pressed.
1. **Subscribed lists server and Add by RSS follows together** (signed in with
   `loginSeedUser`, stubs as decision 4):
   - `/` shows the heading "Subscribed" and six chips in order: Podcasts, Episodes, Clips,
     Artists, Albums, Tracks.
   - The Podcasts chip lists `E2E_PODCAST_CHANNEL_TITLE` and a link
     `a[href*="/add-by-rss/podcast/"]` with `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE`.
   - Clicking Episodes gives `/?tab=episodes`; `E2E Chips Add by RSS Episode` becomes visible
     (15 s).
   - Clicking Clips shows no Add by RSS row (no `a[href*="/add-by-rss/"]` in the main column).
1. **Signed-out Subscribed points to Browse**: `/` shows the six chips and a link to `/browse`
   from the getting-started message.
1. **The Add by RSS page has its own chips and Add Feed** (signed in, same stubs):
   - The sidebar's Library link "Add by RSS" opens `/add-by-rss` with the heading "Add by RSS"
     and five chips: Podcasts, Episodes, Artists, Albums, Tracks.
   - The feed link with `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE` is listed.
   - The header button "Add Feed" opens `/add-by-rss/add`.
1. **Old list URLs are gone**: `request.get` of `/podcasts`, `/episodes`, `/clips`, `/artists`,
   `/albums`, `/tracks`, `/podcasts/livestreams`, `/music/livestreams`, `/add-by-rss/podcasts`,
   and `/add-by-rss/livestreams` each returns 404. A detail URL still works:
   `/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}` returns 200.

Put shared stubs in a `test.beforeEach` only for the signed-in tests (a nested `describe`).

## Existing specs

- `seo-robots-and-sitemap.spec.ts` (line 18): expect `/browse`, and expect no `<loc>` ending in
  `/podcasts`.
- `seo-static-pages-metadata.spec.ts` (lines 26–44): the Podcasts step fetches `/browse` and
  expects `<title>Browse` and the description "Browse podcasts, episodes, clips, music,
  playlists, and profiles on PodverseE2E."; delete the Episodes step.
- `navbar-chrome.spec.ts` (lines 26–48): rename the test to "the sidebar shows Subscribed,
  Browse, and an expanded Library"; expect one `#sidebar details` (open), the links
  `a[href="/"]`, `a[href="/browse"]`, `a[href="/add-by-rss"]`, and `a[href="/playlists"]`, no
  `a[href="/podcasts"]`, and no `a[href="/profiles"]` (R63; plan 68 deletes that Library link).
  `seo-profile-sharable-status.spec.ts` still fetches the `/profiles` page; do not change it.
- `media-player-space-shortcut.spec.ts` (lines 35–51, 159–185): replace the Podcasts accordion
  helpers with `navigateToBrowseViaSidebar` (click `#sidebar a[href="/browse"]`, expect the
  heading "Browse"). The focused link is `#sidebar a[href="/browse"]`; rename the test and
  captions to "sidebar Browse link".
- `focus-states.spec.ts` (lines 21–22): step "Navigate to Browse Episodes and open the first
  episode"; `goto('/browse?tab=episodes')`.
- `podcasts-subscribed-filter.spec.ts` (lines 14–15): `SUBSCRIBED_PODCASTS_URL = '/?sort=a_z'`
  and `GLOBAL_PODCASTS_URL = '/browse?sort=recent'`. The URL assertions on lines 71 and 96 match
  the query and stay.
- `podcasts-unseen-badges.spec.ts` (line 14): `SUBSCRIBED_PODCASTS_URL = '/?sort=a_z'`.
- `artists-list-date-and-view.spec.ts`: `ARTISTS_URL = '/browse?tab=artists'` and
  `PODCASTS_URL = '/browse'`. URL regexes become `/\/browse\?tab=artists$/` and `/\/browse\/?$/`
  (lines 31, 50, 67, 75, 86). The heading checks (lines 32, 51, 87) expect "Browse" plus the
  pressed chip (Artists or Podcasts).
- `add-by-rss-credentials-partial-row.spec.ts` (35), `add-by-rss-credentials-add.spec.ts` (104),
  `add-by-rss-credentials-media-message.spec.ts` (104), and
  `add-by-rss-credentials-rejected.spec.ts` (74): `goto('/add-by-rss')`.
- `add-by-rss-auto-parse.spec.ts` (lines 65–66): step "The Add by RSS podcasts chip names the
  followed feed by its title, not its URL"; `goto('/add-by-rss')`. Keep plan 92's listener and
  step.

`podcasts-subscribed-filter.spec.ts`: Subscribed scope has no type dropdown and keeps the filter
term in `filter=`; the filtered URL from `buildPodcastsPagePath` now starts with `/`. Check its
assertions that read `type=subscribed` from the URL and drop any that the subscribed page no
longer writes (plan 61 keeps `type`, `sort`, `range`, and `filter` on a filtered URL).

After editing, these find only the new spec's 404 list:

```bash
rg "'/(podcasts|episodes|clips|artists|albums|tracks)\b" apps/web/e2e
rg "add-by-rss/(podcasts|episodes|artists|albums|tracks)\b" apps/web/e2e
```

## Spec order

In `makefiles/local/e2e-spec-order-web.txt`, insert `apps/web/e2e/media-list-chips.spec.ts` on
the line after `apps/web/e2e/focus-states.spec.ts`. Plan 71 inserts its own spec after
`navbar-chrome.spec.ts`; keep both insertions.

## Background work on Subscribed

When the signed-in account follows Add by RSS feeds, opening `/` now runs the follow sync and
first parses (plan 65) beside the background refresh. `add-by-rss-auto-parse.spec.ts` counts only
refresh-all requests, which this does not send; no change. If another spec that visits `/` fails
on an unexpected `/account/add-by-rss/parse` request, stub it there with `stubAddByRSSParse`
rather than changing the page.

## Release scratchpad

No entry: tests only.
