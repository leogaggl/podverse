**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 23 — E2E fixture: an Add by RSS artist that lists two albums

The mobile E2E stack has no broker or worker; under `PODVERSE_E2E_FIXTURES=1` the API answers
Add by RSS parses synchronously from fixtures in `accountAddByRSSParse.ts`. This plan adds an
artist fixture whose parse returns `publisherListedFeeds` the same way the worker does (plan 22),
so the mobile and web Add by RSS artist plans (areas I and H) can test against it. The artist
lists the existing Add by RSS album fixture (parsed for the member) and the seeded directory album
(linked), plus one track-level reference.

## Rows

R8, R19, R41, R42, R43

## Runs after

20, 21

## Files

apps/api/src/controllers/account/accountAddByRSSParse.ts
apps/api/src/lib/addByRSSE2ePublisherFixture.ts
apps/api/src/test/add-by-rss-parse-publisher-fixture.test.ts

## Before editing

`add-by-rss-parity` plan 87 (livestreams E2E) also adds a fixture to the same
`E2E_PARSED_FEEDS_BY_URL` record and may extend `E2eParsedFeedFixture` and
`buildE2eParsedFeedPayload`. Re-read the fixture block at the top of `accountAddByRSSParse.ts`
(from `E2E_ADD_BY_RSS_CHANNEL_TITLE` to `buildE2eParsedFeedPayload`) and keep every fixture and
field already there. Add to it; do not restructure it.

## Fixture data (`accountAddByRSSParse.ts`)

New constants beside the existing ones. The two directory values must match
`tools/web/seed-e2e.mjs` (`E2E_MUSIC_ALBUM_PODCAST_GUID`, `E2E_MUSIC_FEED_URL`); say so in the
doc comment as the existing "Sync with" comment does.

```typescript
const E2E_ADD_BY_RSS_ARTIST_FEED_URL = 'https://e2e-seed-addbyrss.example/artist.xml';
const E2E_ADD_BY_RSS_ARTIST_PODCAST_GUID = 'e2e0a77a-0000-4000-8000-0000000000a1';
const E2E_ADD_BY_RSS_MUSIC_PODCAST_GUID = 'e2e0a1b0-0000-4000-8000-0000000000b1';
/** The seeded directory album in tools/web/seed-e2e.mjs. */
const E2E_DIRECTORY_MUSIC_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555501';
const E2E_DIRECTORY_MUSIC_FEED_URL = 'https://e2e-seed-music.example/album.xml';
```

Extend `E2eParsedFeedFixture` with optional fields:

```typescript
  podcastGuid?: string;
  /** The feed's podcast:publisher pointer. */
  publisher?: { feedGuid: string; feedUrl: string; medium: string };
  /** Channel-level podcast:remoteItem elements. */
  remoteItems?: Array<{
    feedGuid: string;
    feedUrl?: string;
    itemGuid?: string;
    medium?: string;
    title?: string;
  }>;
  /** A publisher feed has no items of its own. */
  omitItems?: boolean;
```

In `buildE2eParsedFeedPayload`, spread into the fixture object only when defined:
`guid: source.podcastGuid`, `podcastPublisher: source.publisher`,
`podcastRemoteItems: source.remoteItems`; and use `items: []` when `source.omitItems === true`
(otherwise the existing one-item array). These are the partytime `FeedObject` field names
(`guid`, `podcastPublisher`, `podcastRemoteItems`) that `compatChannelDto`,
`compatChannelPublisherRemoteItemDtos`, and `compatChannelRemoteItemDtos` read. The existing
`as unknown as` cast at the end stays the only assertion.

Fixture changes:

- `E2E_ADD_BY_RSS_MUSIC_PARSED_FEED` gains `podcastGuid: E2E_ADD_BY_RSS_MUSIC_PODCAST_GUID` and
  `publisher: { feedGuid: E2E_ADD_BY_RSS_ARTIST_PODCAST_GUID, feedUrl: E2E_ADD_BY_RSS_ARTIST_FEED_URL, medium: 'publisher' }`.
  Everything else about it is unchanged, so `apps/mobile/e2e/add-by-rss-track.yaml` sees the same
  album and track.
- New `E2E_ADD_BY_RSS_ARTIST_PARSED_FEED`: `channelTitle: 'E2E Add-by-RSS Artist'`, `medium: 'publisher'`,
  `podcastGuid: E2E_ADD_BY_RSS_ARTIST_PODCAST_GUID`, `omitItems: true`, the default link and
  channel image, and the required item fields copied from `E2E_DEFAULT_PARSED_FEED` (unused
  because `omitItems`). `remoteItems`, in this order:
  1. `{ feedGuid: E2E_ADD_BY_RSS_MUSIC_PODCAST_GUID, feedUrl: E2E_ADD_BY_RSS_MUSIC_FEED_URL, medium: 'music', title: 'E2E Add-by-RSS Album' }`
  2. `{ feedGuid: E2E_DIRECTORY_MUSIC_ALBUM_PODCAST_GUID, feedUrl: E2E_DIRECTORY_MUSIC_FEED_URL, medium: 'music', title: 'E2E Music Album' }`
  3. `{ feedGuid: E2E_ADD_BY_RSS_MUSIC_PODCAST_GUID, feedUrl: E2E_ADD_BY_RSS_MUSIC_FEED_URL, itemGuid: E2E_ADD_BY_RSS_MUSIC_PARSED_FEED.itemGuid, medium: 'music' }`
  Two `music` references make `detectDuckTypedPublisherMediumId` classify the feed as
  `PublisherMusic`, so its Add by RSS type is `artists`.
- Register `[E2E_ADD_BY_RSS_ARTIST_FEED_URL]: E2E_ADD_BY_RSS_ARTIST_PARSED_FEED` in
  `E2E_PARSED_FEEDS_BY_URL`.

## `apps/api/src/lib/addByRSSE2ePublisherFixture.ts` (new)

```typescript
/**
 * E2E fixtures only. Resolves a fixture publisher feed's listed feeds the way the Add by RSS
 * worker does, without a broker: directory albums are linked, and every other listed album gets
 * its own `parsed` entry written now from the fixture payload for its URL.
 */
export const writeE2eAddByRSSPublisherListedFeeds = async (input: {
  accountId: number;
  requestId: string;
  feedUrl: string;
  payload: NonNullable<AddByRSSParseCacheEntry['payload']>;
  payloadForFeedUrl: (feedUrl: string) => NonNullable<AddByRSSParseCacheEntry['payload']>;
}): Promise<AddByRSSPublisherListedFeed[] | undefined>;
```

`AddByRSSParseCacheEntry` is the API type from `@api/lib/addByRSSParseCache.js`. Steps:

1. Return `undefined` unless
   `addByRSSResourceTypeListsFeeds(getAddByRSSResourceTypeFromParsedFeed(input.payload))`.
2. `collectAddByRSSPublisherListedFeedRefs(input.payload, input.feedUrl)`.
3. `new ChannelAddByRSSDirectoryMatchService().getForListedFeeds(refs)`.
4. `planAddByRSSPublisherListedFeeds({ refs, directoryByFeedGuid, lookedUpFeedUrlByFeedGuid: new Map(), newRequestId: randomUUID })`.
   No Podcast Index lookup under fixtures.
5. For each `feedsToParse` entry, `setAddByRSSParseCacheEntry({ requestId, accountId, feedUrl, status: 'parsed', cache: {}, payload: input.payloadForFeedUrl(feedUrl), publisherRequestId: input.requestId, updatedAt: new Date().toISOString() })`.
6. Return `listedFeeds`.

If `getAddByRSSResourceTypeFromParsedFeed` does not accept the payload type without an assertion,
type the `payload` parameter as parser-mapping's `FeedObject` and have the controller pass the
value it already built; do not add a second cast.

## Controller wiring

In both fixture branches (`enqueueParse` and `enqueueParseAll`, each under
`if (config.e2e.fixturesEnabled)`):

1. Build `const payload = buildE2eParsedFeedPayload(feedUrl);` once.
2. `const publisherListedFeeds = await writeE2eAddByRSSPublisherListedFeeds({ accountId: account.id, requestId, feedUrl, payload, payloadForFeedUrl: buildE2eParsedFeedPayload });`
3. Pass `payload` and, only when defined, `publisherListedFeeds` to the existing
   `setAddByRSSParseCacheEntry` call. The album entries are written before this one, matching the
   worker's order.

Nothing changes outside `config.e2e.fixturesEnabled`.

## Must stay true

- Fixtures stay fixture-only: no new behavior when `PODVERSE_E2E_FIXTURES` is not `1`.
- The existing fixture feeds return the same payloads as before, except the music album's added
  `guid` and `podcastPublisher`.
- No new `as`.

## Tests

`apps/api/src/test/add-by-rss-parse-publisher-fixture.test.ts` (new). Set
`process.env.PODVERSE_E2E_FIXTURES = '1'` before `startTestApp` and restore it in `afterAll`, as
`e2e-unparsed-search-fixture.test.ts` does. `vi.mock('@podverse/orm', …)` keeping the actual
module and replacing `ChannelAddByRSSDirectoryMatchService` with a class whose `getForListedFeeds`
returns a map with `'11111111-2222-4333-8444-555555555501'` →
`{ channelIdText: 'e2eMusicAlbm01', title: 'E2E Music Album', mediumId: 3 }`. Use `authHeaders`
from `./helpers/index.js`. One `it` each:

- Parsing the artist URL resolves to `parsed` with three things true: `publisherListedFeeds[0]` is
  `add_by_rss` for the album URL with `listedAtChannelLevel` true and the track guid in
  `itemGuids`; `publisherListedFeeds[1]` is `directory` with `channelIdText` `e2eMusicAlbm01`; and
  there are exactly two rows.
- The album row's `requestId` resolves to `parsed`, its payload title is
  `E2E Add-by-RSS Album`, and its `publisherRequestId` is the artist parse's request id.
- Parsing the album URL directly returns no `publisherListedFeeds`, and its payload carries
  `guid` `e2e0a1b0-0000-4000-8000-0000000000b1`.

## Release scratchpad

none
