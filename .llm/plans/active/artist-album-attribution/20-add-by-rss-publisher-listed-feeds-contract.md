**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 20 — Add by RSS publisher listed feeds: response contract and pure planning

When a member adds an Add by RSS artist (a publisher feed), the server will also parse the albums
the artist feed lists (plan 22) and tell the client which album came from which artist. This plan
defines that contract and the pure functions both the worker (plan 22) and the API E2E fixture
(plan 23) use. Nothing produces the new fields yet.

## Rows

R8, R19, R40, R41, R42, R43

## Runs after

none

## Files

packages/helpers/src/lib/addByRSSParseCache.ts
packages/parser-mapping/src/addByRSS/resourceType.ts
packages/parser-mapping/src/addByRSS/resourceType.test.ts
packages/parser-mapping/src/addByRSS/publisherListedFeeds.ts
packages/parser-mapping/src/addByRSS/publisherListedFeeds.test.ts
packages/parser-mapping/src/index.ts
apps/api/openapi.yml
.cursor/rules/add-by-rss-data-contracts.mdc

## How the parse response works today

- `POST /account/add-by-rss/parse` returns a `request_id`. The worker (`runAddByRSSParser.ts`)
  writes an `AddByRSSParseCacheEntry` to Valkey under that id. Clients poll
  `GET /account/add-by-rss/parse/status/{request_id}` (web `apps/web/src/utils/addByRSS/api.ts`,
  mobile `addByRssRepository.ts` `pollAddByRssParseStatus`).
- A `parsed` entry's `payload` is the raw partytime `FeedObject`. Each client maps it with
  `convertParsedRSSFeedToCompat`, so the mapped bundle already carries the artist feed's
  `channel.remoteItems` (channel-level album references and item-level track references) and an
  album's `channel.publisherRemoteItems` (its pointer back to the artist).
- What is missing is the artist-to-album relation the server resolved: which listed albums are
  already in the directory, and the request ids of the albums it parsed.

## Design (fixed here)

- **One parse entry per album.** Each album the server parses gets its own request id and its own
  `AddByRSSParseCacheEntry`, exactly like a member-initiated parse. Clients poll those ids with
  the existing status endpoint. The artist's entry carries only the list, never album payloads,
  so it stays small and each poll stays cheap.
- **The artist entry lists feeds, not albums.** The field is generic
  (`publisherListedFeeds`, R16 naming): one row per distinct feed guid the publisher feed lists,
  in feed order. Whether a row reads as an album is the client's medium check, as everywhere
  else.
- **Directory albums are linked, not parsed** (R43). A listed feed that matches a directory
  channel comes back as `kind: 'directory'` with that channel's `id_text`. Nothing is fetched for
  it, and nothing about it is written server-side (R40).
- **Only channel-level references are parsed.** A feed the publisher names only through
  item-level references (track credits) is linked when it is in the directory and otherwise
  reported as `item_references_only`, not fetched. Its tracks show once the member has its album
  (R19, settled design: "once their album is parsed").
- **Which feeds fan out.** Only feeds whose Add by RSS resource type is `artists` list other
  feeds. That keeps the server and the clients on one classification
  (`getAddByRSSResourceTypeFromMappedFeed`); widening it later is a change to
  `addByRSSResourceTypeListsFeeds` alone.
- **References the server never fetches:** a reference whose declared `medium` is a publisher
  medium (another publisher feed), and a reference to the publisher feed itself (same guid or
  same canonical URL). They are left out of the list.
- **Cap.** At most `ADD_BY_RSS_PUBLISHER_LISTED_FEEDS_MAX` (100) distinct feeds per publisher
  feed, in feed order. The rest are dropped from the list; the collector reports how many.

## `packages/helpers/src/lib/addByRSSParseCache.ts`

Add these types above `AddByRSSParseCacheEntry`:

```typescript
/** Why a feed a publisher feed lists was neither linked nor parsed. */
export type AddByRSSPublisherListedFeedUnresolvedReason =
  /** Listed at channel level, not in the directory, and no feed URL was known or found. */
  | 'no_feed_url'
  /** Named only by item-level references (track credits), and not in the directory. */
  | 'item_references_only';

type AddByRSSPublisherListedFeedBase = {
  /** The listed feed's guid as the publisher feed wrote it, trimmed. Compare case-insensitively. */
  feedGuid: string;
  /** Canonical feed URL: the reference's own, or one Podcast Index returned. Null when unknown. */
  feedUrl: string | null;
  /** The reference's `title` attribute, when it has one. */
  title: string | null;
  /** True when the publisher feed lists this feed itself, not only items in it. */
  listedAtChannelLevel: boolean;
  /** Item guids of item-level references into this feed, in feed order, without duplicates. */
  itemGuids: string[];
};

/**
 * A feed a publisher (artist) feed lists, as the server resolved it for one member's parse.
 * `directory`: already in the Podverse directory; link to that channel, nothing was fetched.
 * `add_by_rss`: parsed for this member; poll `requestId` like any Add by RSS parse.
 * `unresolved`: neither; see `reason`.
 */
export type AddByRSSPublisherListedFeed =
  | (AddByRSSPublisherListedFeedBase & {
      kind: 'directory';
      channelIdText: string;
      channelTitle: string | null;
      mediumId: number | null;
    })
  | (AddByRSSPublisherListedFeedBase & { kind: 'add_by_rss'; requestId: string })
  | (AddByRSSPublisherListedFeedBase & {
      kind: 'unresolved';
      reason: AddByRSSPublisherListedFeedUnresolvedReason;
    });
```

Add two optional fields to `AddByRSSParseCacheEntry`, after `credentialsState`:

```typescript
  /**
   * On a `parsed` entry for a feed whose resource type lists other feeds (artists): the feeds it
   * lists, in feed order. Absent when the feed lists nothing by type, or when the server could
   * not resolve the list; an empty array means it lists no eligible feed.
   */
  publisherListedFeeds?: AddByRSSPublisherListedFeed[];
  /** Set on the entry of a feed parsed because a publisher feed listed it: that parse's id. */
  publisherRequestId?: string;
```

The type stays generic over `TParsedFeed`; these fields do not depend on it. Both are optional,
so entries written before them still read (the existing doc comment already says so).

## `packages/parser-mapping/src/addByRSS/resourceType.ts`

1. Add `getAddByRSSResourceTypeFromMediumId(mediumId: number | null): AddByRSSResourceType` with
   the body of today's `getAddByRSSResourceTypeFromMappedFeed` (artist, then album, then podcast,
   else podcast). Rewrite `getAddByRSSResourceTypeFromMappedFeed` to call it with
   `parseMediumId(mappedFeed?.channel?.channel?.medium_id)`. Behavior is unchanged.
2. Add `getAddByRSSResourceTypeFromParsedFeed(parsedFeed: FeedObject): AddByRSSResourceType`,
   returning `getAddByRSSResourceTypeFromMediumId(compatChannelDto(parsedFeed).medium_id)`. Import
   `compatChannelDto` from `../compat/partytime/channel.js` and `import type { FeedObject }` from
   `../types/partytime.js`. This is the same classification the clients reach through
   `convertParsedRSSFeedToCompat`, without building the whole bundle.
3. Add:

```typescript
/** Resource types whose feeds list other feeds the server resolves for the member (artists). */
export const addByRSSResourceTypeListsFeeds = (resourceType: AddByRSSResourceType): boolean =>
  resourceType === 'artists';
```

## `packages/parser-mapping/src/addByRSS/publisherListedFeeds.ts` (new)

Pure; no network or database. Exports:

```typescript
export const ADD_BY_RSS_PUBLISHER_LISTED_FEEDS_MAX = 100;

export type AddByRSSPublisherListedFeedRef = {
  feedGuid: string;
  feedUrl: string | null;
  title: string | null;
  listedAtChannelLevel: boolean;
  itemGuids: string[];
};

export type CollectAddByRSSPublisherListedFeedRefsResult = {
  refs: AddByRSSPublisherListedFeedRef[];
  /** Distinct feeds left out because the list reached the cap. */
  droppedCount: number;
};

export const collectAddByRSSPublisherListedFeedRefs = (
  parsedFeed: FeedObject,
  publisherFeedUrl: string
): CollectAddByRSSPublisherListedFeedRefsResult;

export type AddByRSSDirectoryChannelMatch = {
  channelIdText: string;
  title: string | null;
  mediumId: number | null;
};

export type AddByRSSPublisherFeedToParse = {
  requestId: string;
  feedUrl: string;
  feedGuid: string;
};

export type PlanAddByRSSPublisherListedFeedsResult = {
  listedFeeds: AddByRSSPublisherListedFeed[];
  feedsToParse: AddByRSSPublisherFeedToParse[];
};

export const planAddByRSSPublisherListedFeeds = (input: {
  refs: readonly AddByRSSPublisherListedFeedRef[];
  /** Keyed by lowercased feed guid. */
  directoryByFeedGuid: ReadonlyMap<string, AddByRSSDirectoryChannelMatch>;
  /** Feed URLs found elsewhere (Podcast Index) for refs with none, keyed by lowercased guid. */
  lookedUpFeedUrlByFeedGuid: ReadonlyMap<string, string>;
  newRequestId: () => string;
}): PlanAddByRSSPublisherListedFeedsResult;
```

`AddByRSSPublisherListedFeed` is imported with `import type` from `@podverse/helpers`.

### `collectAddByRSSPublisherListedFeedRefs`

1. Read the references with `compatChannelRemoteItemDtos(parsedFeed)` from
   `../compat/partytime/channel.js`, so slicing and URL checks match the directory parser. Each dto
   has `feed_guid`, `feed_url`, `item_guid`, `title`, `medium_id`.
2. The publisher's own identity: `ownGuid = parsedFeed.guid?.trim().toLowerCase()` (the field
   `compatChannelDto` reads for `podcast_guid`) and
   `ownUrl = canonicalAddByRSSFeedUrl(publisherFeedUrl)` from `@podverse/helpers-validation`.
3. For each dto in order:
   - `guid = dto.feed_guid.trim()`; skip when empty.
   - Skip when `dto.medium_id` is a publisher medium. Use a module-level
     `const PUBLISHER_MEDIUM_IDS = new Set<number>([...])` built from `MediumEnum` in
     `@podverse/helpers`: `Publisher`, `PublisherL`, `PublisherPodcast`, `PublisherMusic`,
     `PublisherVideo`, `PublisherFilm`, `PublisherAudiobook`, `PublisherNewsletter`,
     `PublisherBlog`, `PublisherCourse`, `PublisherAV`.
   - `url = dto.feed_url === null ? null : canonicalAddByRSSFeedUrl(dto.feed_url)` (null when it
     does not canonicalize).
   - Skip when `guid.toLowerCase() === ownGuid`, or when `url !== null && url === ownUrl`.
   - `itemGuid = dto.item_guid?.trim() ?? ''`. Empty means a channel-level reference.
   - Group by `guid.toLowerCase()`, keeping first-seen order. In the group: set
     `listedAtChannelLevel` when `itemGuid === ''`; append `itemGuid` to `itemGuids` when non-empty
     and not already present; `feedGuid` is the first-seen trimmed guid.
   - `feedUrl`: the first non-null `url` from a channel-level reference; if none, the first
     non-null `url` from any reference in the group.
   - `title`: the same preference as `feedUrl`, using `dto.title` (trimmed; empty is null).
4. Keep the first `ADD_BY_RSS_PUBLISHER_LISTED_FEEDS_MAX` groups. `droppedCount` is the number
   of groups beyond that.

Guids are not required to be UUIDs here. Add by RSS trusts the member's feed, and clients match by
guid string. The directory lookup (plan 21) filters to UUIDs itself.

### `planAddByRSSPublisherListedFeeds`

For each ref, in order, produce exactly one listed feed. `base` is the ref's five fields, with
`feedUrl` replaced as noted:

1. `directoryByFeedGuid.get(ref.feedGuid.toLowerCase())` exists →
   `{ ...base, kind: 'directory', channelIdText, channelTitle: match.title, mediumId }`.
2. Else `ref.listedAtChannelLevel` is false →
   `{ ...base, kind: 'unresolved', reason: 'item_references_only' }`.
3. Else `url = ref.feedUrl ?? lookedUpFeedUrlByFeedGuid.get(ref.feedGuid.toLowerCase()) ?? null`,
   where a looked-up URL is passed through `canonicalAddByRSSFeedUrl` (null when it does not
   canonicalize). `url === null` → `{ ...base, kind: 'unresolved', reason: 'no_feed_url' }`.
4. Else, when an earlier ref in this call already produced a `feedsToParse` entry for the same
   `url`, reuse its `requestId` (two guids naming one URL fetch it once). Otherwise call
   `newRequestId()` and push `{ requestId, feedUrl: url, feedGuid: ref.feedGuid }` to
   `feedsToParse`. Emit `{ ...base, feedUrl: url, kind: 'add_by_rss', requestId }`.

The function never calls `newRequestId` for directory or unresolved rows.

### `packages/parser-mapping/src/index.ts`

Add `export * from './addByRSS/publisherListedFeeds.js';` after the `./addByRSS/liveItems.js`
line.

## `apps/api/openapi.yml`

In `ApiGetAccountAddByRssParseStatusRequestIdResponse200` (search the schema name; it is around
line 1013), add to `properties` after `credentialsState`:

- `publisherRequestId`: `type: string`, description "Set on the entry of a feed parsed because a
  publisher feed listed it: that publisher parse's request id."
- `publisherListedFeeds`: `type: array`, description "On a parsed entry for an artist (publisher)
  feed: the feeds it lists, in feed order. `directory` rows are already in the Podverse directory
  and were not fetched; `add_by_rss` rows were parsed for this member, poll their `requestId`;
  `unresolved` rows were neither. Absent when the feed lists nothing by type or the list could not
  be resolved." Items: an object with `required: [kind, feedGuid, feedUrl, title,
  listedAtChannelLevel, itemGuids]` and properties `kind` (`enum: [directory, add_by_rss,
  unresolved]`), `feedGuid` (string), `feedUrl` (string, nullable), `title` (string, nullable),
  `listedAtChannelLevel` (boolean), `itemGuids` (array of string), `channelIdText` (string,
  "directory rows"), `channelTitle` (string, nullable, "directory rows"), `mediumId` (integer,
  nullable, "directory rows"), `requestId` (string, "add_by_rss rows"), `reason` (`enum:
  [no_feed_url, item_references_only]`, "unresolved rows").

Match the file's nullable style (grep a nearby `nullable: true`). Keep
`additionalProperties: true` on the response schema. No route, request, or status-code change.

## `.cursor/rules/add-by-rss-data-contracts.mdc`

In step 1 ("Server"), after the sentence about `AddByRSSParseCacheEntry`, add one sentence: an
artist feed's parse entry also carries `publisherListedFeeds` (directory links and the request ids
of albums parsed with it), and each such album's own entry carries `publisherRequestId`.

## Must stay true

- `getAddByRSSResourceTypeFromMappedFeed` returns exactly what it returns today for every input.
- The new cache fields are optional; an entry without them is valid.
- No `as`, no `any`; strict equality; `import type` on its own line.

## Tests

- `packages/parser-mapping/src/addByRSS/resourceType.test.ts`: add cases for
  `getAddByRSSResourceTypeFromMediumId` (22 → artists, 3 → albums, 1 → podcasts, null → podcasts),
  `getAddByRSSResourceTypeFromParsedFeed` (a minimal `FeedObject` with `medium: 'publisher'` and
  two remote items with `medium: 'music'` → `artists`; `medium: 'music'` → `albums`), and
  `addByRSSResourceTypeListsFeeds` (true only for `artists`).
- `packages/parser-mapping/src/addByRSS/publisherListedFeeds.test.ts` (Vitest; build minimal
  `FeedObject` values the way `resourceType.test.ts` or `channel.lastPubDate.test.ts` does). One
  `it` each:
  - Two channel-level references come back in feed order with canonical URLs.
  - A channel-level and an item-level reference to one guid (different case) group into one ref
    with `listedAtChannelLevel` true and the item guid in `itemGuids`.
  - An item-level-only guid has `listedAtChannelLevel` false.
  - A reference with `medium: 'publisher'` is left out.
  - A reference to the publisher's own guid, and one to its own URL, are left out.
  - 101 distinct guids: 100 refs, `droppedCount` 1.
  - Plan: a directory match wins over a URL and calls `newRequestId` zero times.
  - Plan: an item-level-only ref with no directory match is `item_references_only`.
  - Plan: a channel-level ref with no URL uses the looked-up URL; with neither it is
    `no_feed_url`.
  - Plan: two guids with the same URL share one request id and one `feedsToParse` entry.

## Release scratchpad

none
