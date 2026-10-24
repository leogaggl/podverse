**Cursor model:** Opus 5.5 · **Reasoning:** high

# 78 — Web E2E: an Add by RSS artist's albums, player line, byline, and directory page

One Playwright spec walks the whole web Add by RSS artist story in one browser context
(IndexedDB is per context, so the steps share one test):

1. Add an Add by RSS artist whose stubbed parse lists one Add by RSS album and the seeded
   directory album.
2. The artist page's Albums tab shows both; the directory row links to `/album/e2eMusicAlbm01`.
3. The listed album is not in the library Albums chip.
4. The listed album opens with Subscribe and its track.
5. Playing that track shows the Add by RSS artist in the player bar and full-size player.
6. The track page shows the artist byline.
7. The directory artist page (`/artist/e2eMusicChnl01`) shows Your Add by RSS Albums and the
   track, each with the Add by RSS marker, because the album names that artist's guid.

The web E2E stack has no broker or workers and does not set `PODVERSE_E2E_FIXTURES`, so parses
are stubbed in the browser (`stubAddByRSSParse`). Plan 23's API fixture serves mobile; this spec
does not use it.

## Rows

R8, R19, R42, R43, R46, R47, R48, R50, R53

## Runs after

11, 30, 50, 51, 73, 74, 75, 76, 77

Plan 11 gives the seeded directory artist its podcast guid (`E2E_MUSIC_ARTIST_PODCAST_GUID`).

## Files

apps/web/e2e/helpers/addByRSSCredentials.ts
apps/web/e2e/helpers/addByRSSArtist.ts
apps/web/e2e/add-by-rss-artist-albums.spec.ts
makefiles/local/e2e-spec-order-web.txt

## `helpers/addByRSSCredentials.ts`

Widen `StubbedParseOutcome` with one optional field so a parsed outcome can carry the listed
feeds:

```typescript
  /** On a parsed artist outcome: the feeds it lists, as the API returns them. */
  publisherListedFeeds?: AddByRSSPublisherListedFeed[];
```

Import `AddByRSSPublisherListedFeed` with `import type` from the same module that supplies
`AddByRSSParseCacheEntry` here (plan 20 exports both together). Nothing else in the file changes.

## `helpers/addByRSSArtist.ts` (new)

```typescript
/**
 * Answers status polls for one request id the stubbed artist parse handed out for a listed
 * album. Register after `stubAddByRSSParse`: Playwright runs the newest route first, and other
 * ids fall back to the earlier stub.
 */
export async function stubAddByRSSParseStatusForRequest(
  page: Page,
  params: { requestId: string; feedUrl: string; outcome: StubbedParseOutcome }
): Promise<void>;
```

- `page.route('**/account/add-by-rss/parse/status/*', …)`: read the id like the existing stub;
  when it differs from `params.requestId`, `await route.fallback()` and return.
- Otherwise fulfill 200 JSON `{ requestId, feedUrl, updatedAt: new Date().toISOString(), ...outcome }`
  with the same CORS headers. Export `corsHeaders` and `StubbedParseOutcome` from
  `addByRSSCredentials.ts` (add `export` to both; no other change) and import them here.

## `add-by-rss-artist-albums.spec.ts` (new)

Constants at the top (these guids are fixed fixtures; `.example` hosts are never fetched):

```typescript
const ARTIST_FEED_URL = 'https://e2e-rss-artist.example/artist.xml';
const ARTIST_GUID = 'e2e0a77a-0000-4000-8000-0000000000c1';
const ARTIST_TITLE = 'E2E RSS Artist';
const ALBUM_FEED_URL = 'https://e2e-rss-artist.example/album.xml';
const ALBUM_GUID = 'e2e0a1b0-0000-4000-8000-0000000000c2';
const ALBUM_TITLE = 'E2E RSS Listed Album';
const TRACK_TITLE = 'E2E RSS Listed Track';
const ALBUM_REQUEST_ID = 'e2e-artist-album-0';
/** The seeded directory artist and album in tools/web/seed-e2e.mjs. */
const DIRECTORY_ARTIST_GUID = '11111111-2222-4333-8444-555555555502';
const DIRECTORY_ARTIST_FEED_URL = 'https://e2e-seed-music.example/artist.xml';
const DIRECTORY_ALBUM_GUID = '11111111-2222-4333-8444-555555555501';
const DIRECTORY_ALBUM_FEED_URL = 'https://e2e-seed-music.example/album.xml';
```

Before writing, confirm both directory guids and URLs in `tools/web/seed-e2e.mjs`
(`E2E_MUSIC_ALBUM_PODCAST_GUID`, `E2E_MUSIC_FEED_URL`, `E2E_MUSIC_ARTIST_FEED_URL`, and plan
11's `E2E_MUSIC_ARTIST_PODCAST_GUID`). Use `E2E_MUSIC_ALBUM_ID_TEXT` and `E2E_MUSIC_CHANNEL_ID_TEXT` from
`helpers/seedConstants.ts` for the idTexts.

Partytime-shaped payloads, following `PARSED_FEED` in `add-by-rss-auto-parse.spec.ts`:

- `ARTIST_FEED`: `title: ARTIST_TITLE`, `link: 'http://localhost:2111/'`, a description,
  `explicit: false`, `medium: 'publisher'`, `guid: ARTIST_GUID`, `items: []`,
  `podcastRemoteItems: [{ feedGuid: ALBUM_GUID, feedUrl: ALBUM_FEED_URL, medium: 'music', title: ALBUM_TITLE }, { feedGuid: DIRECTORY_ALBUM_GUID, feedUrl: DIRECTORY_ALBUM_FEED_URL, medium: 'music', title: 'E2E Music Album' }]`.
- `ALBUM_FEED`: `title: ALBUM_TITLE`, same link, a description, `explicit: false`,
  `medium: 'music'`, `guid: ALBUM_GUID`,
  `podcastPublisher: { feedGuid: DIRECTORY_ARTIST_GUID, feedUrl: DIRECTORY_ARTIST_FEED_URL, medium: 'publisher' }`,
  one item `{ title: TRACK_TITLE, guid: 'e2e-rss-listed-track-1', duration: 61, explicit: false, enclosure: { url: 'http://localhost:2111/audio/audio-001.mp3', type: 'audio/mpeg', length: 0 }, pubDate: '2025-07-02T11:21:52.000Z' }`.

The album names the directory artist (so it shows on `/artist/e2eMusicChnl01`) and is listed by
the Add by RSS artist (so the player and track byline link the Add by RSS artist, plan 72's
"listing" rule).

`ARTIST_LISTED_FEEDS` (typed `AddByRSSPublisherListedFeed[]`):

1. `{ kind: 'add_by_rss', feedGuid: ALBUM_GUID, feedUrl: ALBUM_FEED_URL, title: ALBUM_TITLE, listedAtChannelLevel: true, itemGuids: [], requestId: ALBUM_REQUEST_ID }`
2. `{ kind: 'directory', feedGuid: DIRECTORY_ALBUM_GUID, feedUrl: DIRECTORY_ALBUM_FEED_URL, title: 'E2E Music Album', listedAtChannelLevel: true, itemGuids: [], channelIdText: E2E_MUSIC_ALBUM_ID_TEXT, channelTitle: 'E2E Music Album', mediumId: 3 }`

Suite: `test.describe('Add by RSS artist albums', …)`. `test.afterEach` calls
`unfollowFeedOnServer(page, ARTIST_FEED_URL)` and `unfollowFeedOnServer(page, ALBUM_FEED_URL)`
(best effort; the album is never followed here, but a failed run must not leave either).

One test: "When a member adds an Add by RSS artist, its listed albums show on its page, play with the artist named, and appear on the directory artist page the album names."

`test.setTimeout(60_000)` with the comment: one test walks add, two stubbed parses, and six
page loads because the browser store is per test. Same budget as `add-by-rss-auto-parse.spec.ts`.

Setup: `loginSeedUser(page)`; `stubAddByRSSParse(page, { feedUrl: ARTIST_FEED_URL, outcomes: [{ status: 'parsed', payload: ARTIST_FEED, publisherListedFeeds: ARTIST_LISTED_FEEDS }] })`;
then `stubAddByRSSParseStatusForRequest(page, { requestId: ALBUM_REQUEST_ID, feedUrl: ALBUM_FEED_URL, outcome: { status: 'parsed', payload: ALBUM_FEED } })`;
then `stubAddByRSSParseAll(page)` so the background refresh of seeded follows stays local.

Steps (`test.step`, each with a full-sentence title; capture with `capturePageLoad` /
`captureVerifiedElement` on the element the step verifies):

1. **Add the artist.** `page.goto('/add-by-rss/add')`; fill the `RSS Feed URL` textbox; click
   `Add Feed`; `expect(page).toHaveURL(/\/add-by-rss\/artist\/[^/]+$/, { timeout: 20_000 })`;
   keep `artistPath` (pathname). Expect a heading `ARTIST_TITLE`.
2. **Albums tab.** `page.goto(\`${artistPath}?type=albums\`)`. Expect a link named
   `ALBUM_TITLE` whose `href` matches `/^\/add-by-rss\/album\/[^/]+$/` (timeout 15_000: the
   album's poll lands after the page paints) and a link whose `href` is
   `/album/${E2E_MUSIC_ALBUM_ID_TEXT}` containing `E2E Music Album`. Keep `albumPath`.
3. **Library stays clean.** `page.goto('/add-by-rss?tab=albums')`; expect
   `page.locator('a[href*="/add-by-rss/album/"]').filter({ hasText: ALBUM_TITLE })` to have
   count 0.
4. **Open the listed album.** `page.goto(albumPath)`; expect heading `ALBUM_TITLE`, a button
   named `Subscribe` (exact), and the text `TRACK_TITLE`.
5. **Play it.** Click the Play button on the `TRACK_TITLE` row inside `main` (scope with
   `main.getByRole('listitem')` or the row's container filtered by `TRACK_TITLE`; prefer the
   row's own accessible play button). Expect `#media-player` to contain the text
   `${ARTIST_TITLE} · ${ALBUM_TITLE}` (first match). Open the fullscreen player (click
   `#media-player`'s first button; `getByRole('dialog', { name: 'Fullscreen Media Player' })`),
   expect a button named `ARTIST_TITLE` (exact), click it, and expect the URL path to equal
   `artistPath` and the dialog to have count 0.
6. **Track byline.** Back on `albumPath`, open the track page by clicking `TRACK_TITLE`'s title
   link (or the row's track-page action); expect `toHaveURL(/\/add-by-rss\/track\/[^/]+$/)`,
   heading `TRACK_TITLE`, and a link named `ARTIST_TITLE` (exact) whose `href` is `artistPath`.
7. **Directory artist page.** `page.goto(\`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}\`)`. On the
   Albums tab (default or `?type=albums`, whichever plan 30 made the albums view), expect
   `getByTestId('artist-your-add-by-rss-albums')` to contain the heading
   `Your Add by RSS Albums` and a link `ALBUM_TITLE`, and within it
   `getByTestId('add-by-rss-row-marker')` with accessible name `Add by RSS`. Then select the
   Tracks chip (or `?type=tracks`) and expect `getByTestId('artist-your-add-by-rss-tracks')`
   to contain `TRACK_TITLE` and one marker.

If a locator above does not match the rendered page (a button name, the row play control, or
how the artist page selects its tab), read the component and use its actual accessible name;
do not add test ids to product code for this spec beyond the marker's.

Insert `apps/web/e2e/add-by-rss-artist-albums.spec.ts` in
`makefiles/local/e2e-spec-order-web.txt` directly after
`apps/web/e2e/artist-page-albums-and-tracks.spec.ts` (plan 30's line).

## Must stay true

- Default test timeout is 10 s; only this test raises it, with the comment above.
- Every stubbed route only answers its own feed URL or request id; everything else continues or
  falls back.
- No seed changes.

## Tests

This plan is the test. It covers plans 71 through 77 in the browser.

## Release scratchpad

none
