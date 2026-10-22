**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 13 — E2E fixtures for the artist page's album groups

Plan 11 gives the seeded artist `e2eMusicChnl01` one verified album. Areas D (Playwright) and E
(Maestro) also need, on the same artist page, an album that is parsed but does not name the artist
back (must not appear), a Not Yet Added album whose row opens the Podcast Index preview, and a
reference Podcast Index does not know (must not appear). Web and mobile E2E APIs both run with
`PODVERSE_E2E_FIXTURES=1` (`packages/helpers-config/src/podverseTestEnv.ts`, profiles `apiWebE2e`
and `apiMobileE2e`), so a fixture stands in for Podcast Index, following
`apps/api/src/lib/feedDirectories/e2eUnparsedSearchFixture.ts`.

## Rows

R23, R25, R26

## Runs after

11

## Files

apps/api/src/lib/e2eArtistAlbumsFixture.ts
apps/api/src/lib/remoteItems.ts
apps/api/src/controllers/externalServices/podcastIndex.ts
apps/api/src/test/e2e-artist-albums-fixture.test.ts
tools/web/seed-e2e.mjs
apps/web/e2e/helpers/seedConstants.ts

## Decisions this plan fixes

- **In fixtures mode the artist page never calls live Podcast Index.** `buildRemoteItemsFinalResult`
  resolves guid and feed-URL lookups from the fixture only, so unknown references are hidden
  deterministically and no E2E run depends on the network. Item lookups (`episodeGetByGuid`) are
  skipped too. Outside fixtures mode nothing changes.
- **The preview route serves the same synthetic feed.** `GET /external-services/podcast-index/feed/:id`
  returns the fixture feed for the fixture id in fixtures mode, so a Not Yet Added row opens a
  working preview on web (`/podcast-index/feed/[id]`) and mobile (`PodcastIndexFeedPreviewScreen`).
- Fixture ids sit below the Podcast Index package's mock range (`TEST_PODCAST_INDEX_ID_MIN` =
  2147483640) so the two mechanisms never overlap.

## `apps/api/src/lib/e2eArtistAlbumsFixture.ts` (new)

Mirror the structure of `e2eUnparsedSearchFixture.ts` (exports, comment style):

```typescript
/** Fixtures-only Not Yet Added album on the seeded E2E artist (`e2eMusicChnl01`). */
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555504';
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID = 2147483631;
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL =
  'https://e2e-seed-music.example/album-not-yet-added.xml';
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE = 'E2E Not Yet Added Album';

export const buildE2eArtistNotYetAddedAlbumFeed = (): PodcastBatchByFeedGuidResponse['feeds'][number] => { … };
export const buildE2eArtistNotYetAddedAlbumByIdResponse = (): PodcastIndexPodcastByIdResponse => { … };
export const findE2eArtistAlbumFeedByGuid = (guid: string) => …; // feed or null
export const findE2eArtistAlbumFeedByUrl = (url: string) => …;   // feed or null
```

- Feed fields: `id` the PI id, `podcastGuid` the guid, `title`, `url` / `originalUrl` the feed URL,
  `medium: 'music'`, `author` and `ownerName` `'E2E Music Artist'`, `image` / `artwork` the same
  device-reachable URL `buildE2eUnparsedSearchFeed` uses, and zero / empty values for the rest.
  Fill every required field of the two types from `@podverse/helpers`
  (`PodcastBatchByFeedGuidResponse`, `PodcastIndexPodcastByIdResponse`); build both from one shared
  base object so they cannot drift.
- `ByIdResponse`: `{ status: 'true', query: { id: String(id) }, feed, description: 'Found matching feeds.' }`
  or whatever the type requires.
- Guid comparison is case-insensitive after trim; URL comparison is exact after trim.

## `apps/api/src/lib/remoteItems.ts`

In `buildRemoteItemsFinalResult`, when `config.e2e.fixturesEnabled`:

- For the channel refs: skip `cacheGetJson`, `podcastsBatchByFeedGuid`, and `cacheSetJson`; build
  `channelsUnaddedFromPI` from `findE2eArtistAlbumFeedByGuid` for each ref guid, in ref order.
- When `options?.enrichUnaddedChannelsByFeedUrl`, call `enrichMissedChannelsUnaddedByFeedUrl` with
  a lookup that returns `findE2eArtistAlbumFeedByUrl(url)` instead of
  `lookupPodcastIndexFeedByUrl`, and do not cache.
- Items: `itemsUnaddedFromPI = []` without lookups.

Keep the non-fixture path byte-for-byte equivalent. A small private branch at the top of each
section is enough; do not restructure the function.

## `apps/api/src/controllers/externalServices/podcastIndex.ts`

In `podcastById`, after parsing the id and before calling `podcastIndexService.podcastGetById`:
when `config.e2e.fixturesEnabled` and the id equals
`E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID`, `res.json(buildE2eArtistNotYetAddedAlbumByIdResponse())`
and return. Import `config` from `@api/config/index.js`.

## `tools/web/seed-e2e.mjs`

Add constants beside the music artist constants (count `id_text` lengths: 9–15 characters,
**e2e-seed-id-text-limits**):

```javascript
/** Parsed album the E2E artist lists that does not name the artist back; hidden on the artist page. */
const E2E_MUSIC_ALBUM_UNCLAIMED_ID_TEXT = 'e2eMusicAlbm02'; // 14
const E2E_MUSIC_ALBUM_UNCLAIMED_TITLE = 'E2E Unclaimed Music Album';
const E2E_MUSIC_ALBUM_UNCLAIMED_PODCAST_GUID = '11111111-2222-4333-8444-555555555503';
const E2E_MUSIC_ALBUM_UNCLAIMED_FEED_URL = 'https://e2e-seed-music.example/album-unclaimed.xml';
const E2E_MUSIC_ALBUM_UNCLAIMED_FEED_PI_ID = 876543224;
/** Must match E2E_ARTIST_NOT_YET_ADDED_ALBUM_* in apps/api/src/lib/e2eArtistAlbumsFixture.ts. */
const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555504';
const E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL = 'https://e2e-seed-music.example/album-not-yet-added.xml';
/** A reference Podcast Index does not know; hidden on the artist page. */
const E2E_ARTIST_UNKNOWN_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555505';
```

Grep the seed for each guid and the PI id first; if any is taken, pick the next free value and use
it everywhere, including the API fixture and `seedConstants.ts`.

In the music artist block, after plan 11's verified link inserts:

1. Delete then insert the unclaimed album's feed (`DELETE FROM feed WHERE podcast_index_id = $1 OR url = $2`,
   then `feed`, `feed_log`, `feed_policy` public), its channel (medium `music`,
   `podcast_guid` the unclaimed guid, title), `channel_about`, a description via
   `insertSeedChannelDescription`, and a `channel_image` with `E2E_FIXTURE_CHANNEL_IMAGE_URL`,
   following the album insert above it. No `channel_publisher` row: it does not name the artist.
2. Add three album-level rows to the artist's `channel_remote_item` (`item_guid` NULL, medium
   `music`): the unclaimed album (guid, feed URL, title), the Not Yet Added album (its guid, feed
   URL, `'E2E Not Yet Added Album'`), and the unknown album (its guid, feed URL NULL,
   `'E2E Unknown Album'`). Insert them after the existing verified-album row so the verified album
   stays first in feed order.
3. Extend the artist `console.log` to name the three extra references.

## `apps/web/e2e/helpers/seedConstants.ts`

Export, next to `E2E_MUSIC_CHANNEL_ID_TEXT`, the constants D's Playwright specs need:

```typescript
export const E2E_MUSIC_ALBUM_TITLE = 'E2E Music Album'; // only if not already exported
export const E2E_MUSIC_ALBUM_UNCLAIMED_ID_TEXT = 'e2eMusicAlbm02';
export const E2E_MUSIC_ALBUM_UNCLAIMED_TITLE = 'E2E Unclaimed Music Album';
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE = 'E2E Not Yet Added Album';
export const E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID = 2147483631;
```

Grep the file first and skip any constant that already exists under another name.

## Must stay true

- With `PODVERSE_E2E_FIXTURES` unset, `buildRemoteItemsFinalResult` and `podcastById` behave
  exactly as before.
- The podroll endpoint in fixtures mode returns no Podcast Index rows for unknown references,
  which is acceptable for E2E (no podroll spec depends on live Podcast Index).
- The seed stays re-runnable.

## Tests

- `apps/api/src/test/e2e-artist-albums-fixture.test.ts` (new), modeled on
  `e2e-unparsed-search-fixture.test.ts` (sets `PODVERSE_E2E_FIXTURES=1` before `startTestApp`,
  mocks `../factories/podcastIndexService.js` so every method throws "live Podcast Index must not
  run when fixturesEnabled"). Cases:
  - `GET /external-services/podcast-index/feed/2147483631` returns the fixture feed (title, guid,
    medium `music`).
  - `buildRemoteItemsFinalResult([], [notYetAddedRef, unknownRef], [], [], { enrichUnaddedChannelsByFeedUrl: true })`
    loaded with `await import('../lib/remoteItems.js')` after `startTestApp` (so it sees the
    re-imported config) returns exactly the fixture feed in `channelsUnadded`, and the mocked
    service is never called. The refs are plain `RemoteItemGeneric` objects with the fixture guid
    and the unknown guid.
- No Playwright or Maestro changes here; areas D and E assert the page with these fixtures.

## Release scratchpad

none
