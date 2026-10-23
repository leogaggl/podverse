**Cursor model:** Opus 5.5 · **Reasoning:** high

# 71 — Web: store what an Add by RSS artist lists, and the albums parsed with it

When the member adds or refreshes an Add by RSS artist, the parse status for the artist carries
`publisherListedFeeds` (plan 20): directory albums to link, albums the server parsed for the
member (each with its own `requestId`), and references it could not resolve. This plan keeps that
list in the browser, polls each album's parse, and stores the parsed albums where the follow sync
cannot delete them. Nothing renders yet; plans 73–77 read these stores.

The `feeds` store mirrors the account's follows: `syncAddByRSSFollowStubs` and
`syncAddByRSSCacheWithServer` delete every record whose URL the account does not follow. An album
the member has not followed (R46) therefore lives in a separate `listedFeeds` store. It leaves
when no stored artist lists it any more, which also covers the artist being removed on another
device (R59 needs no prompt for these).

## Rows

R8, R19, R40, R42, R43, R44, R46, R54

## Runs after

20, 22

Plan 20 defines `AddByRSSPublisherListedFeed` and the two optional fields on
`AddByRSSParseCacheEntry`. Plan 22 makes the server return them. Nothing here needs plan 23.

## Files

apps/web/src/utils/addByRSS/types.ts
apps/web/src/utils/addByRSS/storage.ts
apps/web/src/utils/addByRSS/itemIndex.ts
apps/web/src/utils/addByRSS/listedFeeds.ts
apps/web/src/utils/addByRSS/listedFeeds.test.ts
apps/web/src/utils/addByRSS/actions.ts
apps/web/src/utils/addByRSS/actions.publisherListedFeeds.test.ts
apps/web/src/utils/addByRSS/sync.ts
apps/web/src/utils/addByRSS/sync.test.ts

## Decisions this plan fixes

- **Two new IndexedDB stores, `DB_VERSION` 7 → 8.** `publisherLinks` holds one row per parsed Add
  by RSS artist (its list, guid, title, and feeds-store `idText`). `listedFeeds` holds parsed
  albums the member has not followed. The other choice was a field on the artist's feeds record
  plus a flag on album records in `feeds`. That breaks the follow sync and puts unfollowed albums
  on Home and in the library lists.
- **A listed album is stored even when the member also follows it.** Readers prefer the followed
  record by canonical URL. Unfollowing such an album then leaves it under the artist instead of
  dropping it until the next artist refresh.
- **Listed tracks never enter the `items` index.** That index feeds the library Tracks and
  Episodes lists and is rebuilt from followed feeds. A listed album keeps its own stable track
  `idText` per item guid (`itemIdTextsByGuid`), so track URLs survive reloads.
- **Fan-out data arrives through `applyAddByRSSParseStatus`.** Every parse path (add page, first
  parse, parse-all, credentials page, list refreshes) already passes the status response as
  `outcome`, so widening `AddByRSSParseOutcome` reaches all of them without touching callers.
- **Refresh rule.** The artist's own parse refreshes its list whenever it returns
  `publisherListedFeeds`. A `not_modified` result returns none, so the stored list stays.
  `refreshAddByRSSPublisherLinks` sends the artist parse with no cache hints (plan 22's note: that
  is what re-fans out). Plan 73 calls it when the stored list is older than 24 hours.

## `types.ts`

Add `AddByRSSPublisherListedFeed` to the `import type` from `@podverse/helpers`, then:

```typescript
/**
 * An album an Add by RSS artist on this browser lists, parsed for the member but not followed.
 * Kept apart from followed feeds so the follow sync never removes it; it leaves when no stored
 * artist lists it.
 */
export type AddByRSSListedFeedRecord = AddByRSSFeedRecord & {
  /** The album parse the artist's parse started; polled until it settles. */
  publisherParseRequestId: string | null;
  /** Track idTexts by item guid. Listed tracks never enter the items index. */
  itemIdTextsByGuid: Record<string, string>;
};

/** What one parsed Add by RSS artist on this browser lists. */
export type AddByRSSPublisherLinkRecord = {
  /** Canonical feed URL of the artist feed; the store key. */
  publisherFeedUrl: string;
  /** The artist's `idText` in the feeds store. */
  publisherIdText: string;
  publisherTitle: string;
  /** The artist feed's `podcast:guid`, trimmed and lowercased; null when it has none. */
  publisherGuid: string | null;
  listedFeeds: AddByRSSPublisherListedFeed[];
  updatedAt: string;
};

/** An album record and which store it came from. */
export type AddByRSSAlbumSource =
  | { followed: true; feed: AddByRSSFeedRecord }
  | { followed: false; feed: AddByRSSListedFeedRecord };
```

## `storage.ts`

- `DB_VERSION = 8`. Constants `PUBLISHER_LINKS_STORE = 'publisherLinks'` and
  `LISTED_FEEDS_STORE = 'listedFeeds'`.
- In `onupgradeneeded`, after the live items block, the same `contains` guard:
  - `publisherLinks`: `createObjectStore(PUBLISHER_LINKS_STORE, { keyPath: 'publisherFeedUrl' })`.
  - `listedFeeds`: `createObjectStore(LISTED_FEEDS_STORE, { keyPath: 'idText' })` with
    `createIndex('feedUrl', 'feedUrl', { unique: true })`.
- New exports, each returning the empty value when `!isIndexedDbAvailable()` and going through
  `withStore` like the feeds functions:
  - `getAllAddByRSSPublisherLinks(): Promise<AddByRSSPublisherLinkRecord[]>`
  - `getAddByRSSPublisherLink(publisherFeedUrl: string): Promise<AddByRSSPublisherLinkRecord | null>`
  - `upsertAddByRSSPublisherLink(record): Promise<void>`
  - `removeAddByRSSPublisherLinks(publisherFeedUrls: readonly string[]): Promise<void>` (one
    readwrite transaction, like `bulkRemoveAddByRSSFeeds`)
  - `getAllListedAddByRSSFeeds(): Promise<AddByRSSListedFeedRecord[]>`
  - `getListedAddByRSSFeedByIdText(idText): Promise<AddByRSSListedFeedRecord | null>`
  - `getListedAddByRSSFeedByUrl(feedUrl): Promise<AddByRSSListedFeedRecord | null>` (the
    `feedUrl` index)
  - `upsertListedAddByRSSFeed(record): Promise<void>`
  - `bulkRemoveListedAddByRSSFeeds(idTexts: readonly string[]): Promise<void>`
  - `getAddByRSSAlbumSourceByIdText(idText): Promise<AddByRSSAlbumSource | null>`: the feeds
    store first (`followed: true`), else the listed store.
  - `getAddByRSSAlbumSourceByUrl(feedUrl): Promise<AddByRSSAlbumSource | null>`: exact URL in
    feeds, then in listed; when neither, retry both with
    `canonicalAddByRSSFeedUrl(feedUrl)` from `@podverse/helpers-validation/client` when that is
    non-null and differs.
- Apply `withKnownResourceType` to listed records as the feeds getters do; it returns the
  record's own type, so give it a generic signature
  `<T extends AddByRSSFeedRecord>(record: T): T` instead of adding a cast.

## `itemIndex.ts`

Rename the module-private `toIndexItem` to `toAddByRSSItemIndexItem` and export it. Update its two
in-file callers. No behavior change.

## `listedFeeds.ts` (new)

Storage and pure helpers only. It must not import `./actions` (actions imports this file).

```typescript
export const ADD_BY_RSS_PUBLISHER_LINKS_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Trimmed, lowercased guid; null when empty. Feed guids compare case-insensitively. */
export const normalizeAddByRSSGuid = (value: string | null | undefined): string | null;

/** Canonical form for comparing feed URLs across stores and server rows. */
export const toAddByRSSComparableFeedUrl = (feedUrl: string): string;
// canonicalAddByRSSFeedUrl(feedUrl) ?? feedUrl.trim(), the rule credentialsStatus.ts uses

/** The guid key an item has in the index: its guid, else `${feed.idText}-${index}`. */
export const getAddByRSSItemGuidKey = (
  feed: Pick<AddByRSSFeedRecord, 'idText'>,
  bundle: AddByRSSMappedFeed['items'][number],
  index: number
): string;

/** Keeps every existing track idText and creates one for each new item guid. */
export const assignListedTrackIdTexts = (
  record: AddByRSSListedFeedRecord
): AddByRSSListedFeedRecord;

/** Index-shaped items for a listed album, built in memory with its stored idTexts. */
export const listedAddByRSSTrackIndexItems = (
  record: AddByRSSListedFeedRecord
): AddByRSSItemIndexItem[];

export const addByRSSPublisherLinksNeedRefresh = (
  link: AddByRSSPublisherLinkRecord | null,
  nowMs: number
): boolean; // null → true; else Date.parse(updatedAt) is NaN or older than the constant

/**
 * Drops artist links whose artist this browser no longer follows, then listed albums no
 * remaining link lists. Returns the feed URLs it removed.
 */
export const pruneAddByRSSPublisherData = async (): Promise<string[]>;
```

- `getAddByRSSItemGuidKey` matches `buildAddByRSSItemsIndex` (`bundle.item.guid ?? \`${feed.idText}-${index}\``).
  Use it in `assignListedTrackIdTexts` and `listedAddByRSSTrackIndexItems`.
- `listedAddByRSSTrackIndexItems` maps `record.mappedFeed?.items ?? []` with
  `toAddByRSSItemIndexItem(record, bundle, index, record.itemIdTextsByGuid[key])`.
- `pruneAddByRSSPublisherData`:
  1. `followed = await getAllAddByRSSFeeds()`; `followedUrls` = their comparable URLs.
  2. Links whose `publisherFeedUrl` is not in `followedUrls` → `removeAddByRSSPublisherLinks`.
  3. `listedUrls` = comparable `feedUrl` of every `kind === 'add_by_rss'` row of the remaining
     links.
  4. Listed records whose comparable URL is not in `listedUrls` → `bulkRemoveListedAddByRSSFeeds`.
  5. `emitAddByRSSFeedChanged` once for each removed link URL and listed URL; return them.

## `actions.ts`

### Outcome type

```typescript
/** The parts of a parse status response beyond the feed itself. */
export type AddByRSSParseOutcome = Pick<
  AddByRSSParseStatusResponse,
  'failureReason' | 'credentialsState' | 'publisherListedFeeds'
>;
```

Grep every `applyAddByRSSParseStatus(` and `AddByRSSFirstParseStatusHandler` caller. Each already
forwards the status response or the `outcome` it received; if one builds an object literal,
add `publisherListedFeeds` to it.

### Record from a status

Extract the record computation of `applyAddByRSSParseStatus` (from `const nowIso` through the
`updated` object, both the payload and no-payload branches) into a module-private pure function:

```typescript
const buildAddByRSSFeedRecordFromStatus = <T extends AddByRSSFeedRecord>(
  base: T,
  params: {
    parsedFeed: AddByRSSParsedFeed | undefined;
    status: AddByRSSParseStatus;
    cache?: AddByRSSFeedRecord['cache'];
    outcome?: AddByRSSParseOutcome;
  }
): T;
```

`applyAddByRSSParseStatus` keeps its signature and result. After it stores the updated record:
when `status === 'parsed'` and `outcome?.publisherListedFeeds !== undefined`, call
`void ingestAddByRSSPublisherListedFeeds({ publisher: updated, listedFeeds: outcome.publisherListedFeeds })`.
Use the payload branch's `updated` (the list only arrives with a parsed payload). Do not await it:
the artist record is ready before its albums.

### Listed albums

```typescript
/** Applies a parse status to a listed album. Never writes the feeds store. */
export const applyListedAddByRSSParseStatus = async (params: {
  feedUrl: string;
  parsedFeed: AddByRSSParsedFeed | undefined;
  status: AddByRSSParseStatus;
  cache?: AddByRSSFeedRecord['cache'];
  outcome?: AddByRSSParseOutcome;
  fallbackRecord?: AddByRSSListedFeedRecord | null;
  onUpdated?: (record: AddByRSSListedFeedRecord) => void;
}): Promise<AddByRSSListedFeedRecord | null>;
```

Base is `getListedAddByRSSFeedByUrl(feedUrl) ?? fallbackRecord`; null base → return null. Next
record is `assignListedTrackIdTexts(buildAddByRSSFeedRecordFromStatus(base, …))`, with
`mayHaveLivestreams` handled as the followed path does. `upsertListedAddByRSSFeed`, `onUpdated`,
`emitAddByRSSFeedChanged(feedUrl)`. It ignores `outcome.publisherListedFeeds` (album entries never
fan out).

```typescript
export const ingestAddByRSSPublisherListedFeeds = async (params: {
  publisher: AddByRSSFeedRecord;
  listedFeeds: AddByRSSPublisherListedFeed[];
}): Promise<void>;
```

1. `publisherFeedUrl = toAddByRSSComparableFeedUrl(publisher.feedUrl)`.
2. `upsertAddByRSSPublisherLink({ publisherFeedUrl, publisherIdText: publisher.idText, publisherTitle: getAddByRSSChannelMetadata(publisher.mappedFeed).title ?? publisher.title ?? publisher.feedUrl, publisherGuid: normalizeAddByRSSGuid(publisher.mappedFeed?.channel?.channel?.podcast_guid), listedFeeds, updatedAt: nowIso })`
   then `emitAddByRSSFeedChanged(publisher.feedUrl)`.
3. For each row with `kind === 'add_by_rss'` (its `feedUrl` is non-null for that kind; skip it
   when null), in order: `existing = await getListedAddByRSSFeedByUrl(row.feedUrl)`. When none,
   create

   ```typescript
   const idText = createAddByRSSIdText();
   const record: AddByRSSListedFeedRecord = {
     id: createAddByRSSId(idText),
     idText,
     resourceType: 'albums',
     feedUrl: row.feedUrl,
     title: row.title ?? row.feedUrl,
     imageUrl: null,
     status: 'queued',
     updatedAt: nowIso,
     publisherParseRequestId: row.requestId,
     itemIdTextsByGuid: {},
   };
   ```

   When one exists, store it with `publisherParseRequestId: row.requestId` and `status: 'queued'`
   (keep its `mappedFeed`, so the album stays readable while it refreshes). Collect the stored
   records.
4. `await pruneAddByRSSPublisherData()` (an album this artist dropped leaves unless another
   artist lists it).
5. `await resumeListedAddByRSSPolls(collected)`.

Wrap the body in `try`/`catch` that logs `console.error('Add by RSS artist albums could not be stored', error)`;
a failure here must never fail the artist's parse.

```typescript
/** Polls each listed album still queued or processing, at most four at a time. */
export const resumeListedAddByRSSPolls = async (
  records: readonly AddByRSSListedFeedRecord[]
): Promise<void>;
```

- Keep records with `publisherParseRequestId !== null` and status `queued` or `processing` (or
  `undefined`).
- A module-level `LISTED_POLL_CONCURRENCY = 4`; run that many async workers that take the next
  record from a shared queue.
- Per record: `claimAddByRSSParseInFlight(\`listed:${record.feedUrl}\`)`; skip when false. Then
  `pollAddByRSSParseStatus({ requestId, onStatusUpdate: (response) => applyListedAddByRSSParseStatus({ feedUrl: record.feedUrl, parsedFeed: response.payload, status: response.status, cache: response.cache, outcome: response, fallbackRecord: record }) })`.
  `catch` logs once per feed URL (module `Set`, as `firstParse.ts` does) and leaves the record as
  it is; `finally` releases the in-flight key. A timed-out or expired request stays `queued`
  until the next artist refresh replaces its request id.

```typescript
/** Re-parses an artist with no cache hints so the server lists its albums again. */
export const refreshAddByRSSPublisherLinks = async (params: {
  accountId: string;
  publisher: AddByRSSFeedRecord;
}): Promise<void>;
```

`claimAddByRSSParseInFlight(publisher.feedUrl)` (return when false); `enqueueAddByRSSParseWithStoredCredentials({ accountId, feedUrl })`
with no `cache`; `pollAddByRSSParseStatus` with `applyAddByRSSParseStatus({ feedUrl, parsedFeed: response.payload, status: response.status, cache: response.cache, outcome: response, fallbackRecord: publisher })`;
`catch` logs; `finally` releases. Credentials go only where plan 22 sends them; this function
sends the artist's own stored credentials, as every artist parse does.

### Follow from a listed album

`followAddByRSSChannelAndQueue` gains `seedRecord?: AddByRSSFeedRecord | null`. When given, the
stored record keeps `seedRecord`'s `id`, `idText`, `title`, `imageUrl`, `mappedFeed`, `cache`,
`lastParsedAt`, and `mayHaveLivestreams`, with `resourceType: params.resourceType`,
`status: 'queued'`, and `updatedAt` now. Copy only those fields (not `publisherParseRequestId` or
`itemIdTextsByGuid`). The album keeps its URL and shows its tracks while the follow's parse runs.
Without `seedRecord`, behavior is unchanged.

### Unfollow

In `unfollowAddByRSSChannelAndClear`, after `removeAddByRSSFeed`, call
`await pruneAddByRSSPublisherData()` inside its own `try`/`catch` that logs. Removing an artist
then removes the albums that only it listed. A listed album the member had followed stays listed.

## `sync.ts`

In both `syncAddByRSSCacheWithServer` and `syncAddByRSSFollowStubs`, inside the
`if (toRemove.length > 0)` block after `clearAddByRSSItemsIndex()`, call
`await pruneAddByRSSPublisherData()`. Update the two doc comments to say unfollowed artists'
listed albums leave too.

## Must stay true

- Nothing in this plan writes a listed album into the `feeds` store except
  `followAddByRSSChannelAndQueue` with `seedRecord`.
- Library lists, Home, and the items index are unchanged.
- A parse response without `publisherListedFeeds` never clears a stored list.
- No server write is added; listed albums are not follows.
- No `as`, no `any`, strict equality, type imports on their own line.

## Tests

`listedFeeds.test.ts` (new; mock `./storage` with `vi.hoisted` fns as `actions.test.ts` does, and
`./feedChangedEvent`):

- `normalizeAddByRSSGuid`: trims and lowercases; empty and null give null.
- `assignListedTrackIdTexts` keeps an existing idText and adds one for a new guid; an item with no
  guid keys by `${idText}-${index}`.
- `listedAddByRSSTrackIndexItems` returns one item per track with the stored idText and
  `channelIdText` the album's idText.
- `addByRSSPublisherLinksNeedRefresh`: null → true; fresh → false; 25 hours old → true.
- `pruneAddByRSSPublisherData`: with one followed artist A and a link for unfollowed artist B,
  B's link is removed; a listed album only B listed is removed; one A lists stays; the comparison
  matches `http://` and `https://` forms the way `canonicalAddByRSSFeedUrl` does.

`actions.publisherListedFeeds.test.ts` (new; mock `./api`, `./storage`, `./feedChangedEvent`,
`./parseInFlight`, and `./credentialStore` with `vi.hoisted`):

- `applyAddByRSSParseStatus` with a parsed payload and
  `outcome.publisherListedFeeds = [directory row, add_by_rss row, unresolved row]` stores one
  link whose `listedFeeds` equals the input and creates one listed record (the `add_by_rss` row)
  with `status: 'queued'` and that `requestId`. Await the ingest with `vi.waitFor` on the upsert
  mock rather than sleeping.
- Without `publisherListedFeeds` (and with `not_modified`), no link is written.
- The listed album's poll applies `parsed` to the listed store only: `upsertListedAddByRSSFeed` is
  called with the mapped feed and track idTexts; `upsertAddByRSSFeed` is not called for it.
- A rejected poll leaves the record and releases the in-flight key.
- `followAddByRSSChannelAndQueue` with `seedRecord` stores that `idText` and `mappedFeed` with
  `status: 'queued'`; without it, a new idText.

`sync.test.ts`: extend the existing removal case to assert `pruneAddByRSSPublisherData` is called
once when a feed is removed and not when nothing is removed (mock `./listedFeeds`).

## Release scratchpad

none (plan 73 carries the entry for the artist page that shows these albums)
