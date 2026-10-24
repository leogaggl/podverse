**Cursor model:** Opus 5.5 · **Reasoning:** high

# 80 — Mobile stores what an Add by RSS artist lists, and albums it holds only for that artist

Adding an Add by RSS artist on mobile parses every album it lists (R43). Those albums live on the
device, are linked to the artist, and show only under the artist until the member follows one
(R46). The device needs two things it does not have: a table of what each Add by RSS artist
lists (plan 20's `publisherListedFeeds`), and a way to hold an Add by RSS feed row that is not a
follow. This plan adds both, plus the per-feed guid columns the artist line needs. It changes no
screen. Plans 81–85 read what it stores.

## Rows

R8, R19, R40, R43, R44, R46

## Runs after

20

## Files

apps/mobile/src/data/db/migrations.ts
apps/mobile/src/data/db/migrations.test.ts
apps/mobile/src/data/db/schema.ts
apps/mobile/src/data/db/index.ts
apps/mobile/src/data/db/applyAddByRssPublisherRefs.ts
apps/mobile/src/lib/addByRss/publisherRefs.ts
apps/mobile/src/lib/addByRss/publisherRefs.test.ts
apps/mobile/src/data/repositories/addByRssListedFeeds.ts
apps/mobile/src/data/repositories/addByRssListedFeeds.test.ts
apps/mobile/src/data/repositories/addByRssRepository.ts
apps/mobile/src/data/repositories/channelSeenRepository.ts
apps/mobile/src/prefs/addByRSSFeeds.ts
apps/mobile/vitest.config.ts

## Reuses

- `AddByRSSPublisherListedFeed` (plan 20) from `@podverse/helpers`.
- The one-time pass pattern of `apps/mobile/src/data/db/applyAddByRssResourceTypes.ts`
  (`kv_meta` marker key, runs from `initializeDatabase`).
- `canonicalAddByRSSFeedUrl` from `@podverse/helpers-validation/client` for URL comparison.
- The cleanup already in `addByRssRepository.removeFeed` (credentials, live status, seen state,
  auto-download rule).

## Decisions this plan fixes

- **"Followed" is a column on the existing feed table, not a second table.** A listed album is a
  full Add by RSS feed row (bundle, artwork, playback) so every Add by RSS screen and player path
  works on it unchanged. `followed = 0` means "held because an Add by RSS artist on this device
  lists it". Every existing row and every row written without the flag is `followed = 1`.
- **Library, Home, unseen badges, and refresh-all read followed rows only.** `listFeeds` keeps its
  name and now returns followed rows; `listAllFeeds` returns every row.
- **Listed-only rows go when nothing lists them.** After any change to listings or feeds, a row
  with `followed = 0` that no listing names (by canonical URL, or by its `podcast:guid`) is
  removed with the same cleanup `removeFeed` does. This is how removing an artist removes the
  albums it brought (R46) while an album two artists list stays until both are gone (R44).
- **Listings are replaced whole per artist parse**, never merged, because plan 20 sends the full
  list on every `parsed` entry. Directory artwork and pending request ids already stored for an
  unchanged listing carry over.

## Migration (`migrations.ts`)

Add version 25 after the current last version (24, `may_have_livestreams`). One migration, SQL in
this order:

```sql
ALTER TABLE add_by_rss_feed ADD COLUMN followed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE add_by_rss_feed ADD COLUMN podcast_guid TEXT;
ALTER TABLE add_by_rss_feed ADD COLUMN publisher_guids_json TEXT;
ALTER TABLE add_by_rss_feed ADD COLUMN publisher_directory_json TEXT;
CREATE INDEX IF NOT EXISTS idx_add_by_rss_feed_podcast_guid ON add_by_rss_feed (podcast_guid);
CREATE TABLE IF NOT EXISTS add_by_rss_listed_feed (
  publisher_feed_url TEXT NOT NULL,
  feed_guid TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  feed_url TEXT,
  title TEXT,
  listed_at_channel_level INTEGER NOT NULL,
  item_guids_json TEXT NOT NULL,
  channel_id_text TEXT,
  channel_title TEXT,
  medium_id INTEGER,
  image_url TEXT,
  artwork_checked INTEGER NOT NULL DEFAULT 0,
  pending_request_id TEXT,
  unresolved_reason TEXT,
  PRIMARY KEY (publisher_feed_url, feed_guid)
);
CREATE INDEX IF NOT EXISTS idx_add_by_rss_listed_feed_guid ON add_by_rss_listed_feed (feed_guid);
CREATE INDEX IF NOT EXISTS idx_add_by_rss_listed_feed_channel ON add_by_rss_listed_feed (channel_id_text);
```

`feed_guid` is stored lowercased. `kind` is `directory`, `add_by_rss`, or `unresolved`.
`publisher_guids_json` is a JSON array of lowercased guids; `publisher_directory_json` is a JSON
array of `AddByRssDirectoryPublisherMatch` (below): the directory channels those guids resolved to
through plan 70's read, written by plan 82.

## Schema (`schema.ts`)

Edit by hand. In the `addByRssFeed` table, after `mayHaveLivestreams`:

```typescript
  /**
   * 0 when this row is held only because an Add by RSS artist on this device lists it. Such a
   * row is not a follow: Library, Home, and refresh-all skip it.
   */
  followed: integer('followed').notNull().default(1),
  podcastGuid: text('podcast_guid'),
  publisherGuidsJson: text('publisher_guids_json'),
  publisherDirectoryJson: text('publisher_directory_json'),
```

Add `addByRssListedFeed` after `addByRssFeed`, columns in the SQL order with camelCase names and
`primaryKey({ columns: [table.publisherFeedUrl, table.feedGuid] })`, plus the two indexes, matching
how this file declares other composite keys and indexes. Export `AddByRssListedFeedRow` and
`AddByRssListedFeedInsert` the way the file exports the other row types.

## Record type (`apps/mobile/src/prefs/addByRSSFeeds.ts`)

`MobileAddByRSSFeedRecord` gains:

```typescript
  /**
   * False when this device holds the feed only because an Add by RSS artist on it lists the
   * feed. Absent means followed.
   */
  followed?: boolean;
```

## Pure helpers

### `apps/mobile/src/lib/addByRss/publisherRefs.ts` (new)

```typescript
export type AddByRssPublisherPointer = { feedGuid: string; feedUrl: string | null };

export type AddByRssPublisherRefs = {
  podcastGuid: string | null;
  /** The feed's `podcast:publisher` pointers, guid lowercased, in feed order, each guid once. */
  publisherPointers: AddByRssPublisherPointer[];
};

/** A directory channel one of this feed's publisher pointers resolved to. A guid match only. */
export type AddByRssDirectoryPublisherMatch = {
  feedGuid: string;
  channelIdText: string;
  channelTitle: string | null;
  mediumId: number | null;
};

export const addByRssPublisherRefsFromMappedFeed = (
  mappedFeed: AddByRSSMappedFeed
): AddByRssPublisherRefs => …;

export const parseStoredPublisherGuids = (json: string | null): string[] => …;
export const parseStoredPublisherDirectoryMatches = (
  json: string | null
): AddByRssDirectoryPublisherMatch[] => …;
```

Read `mappedFeed.channel.channel.podcast_guid` and `mappedFeed.channel.publisherRemoteItems[]`
(`feed_guid`, `feed_url`); trim, lowercase guids, drop empty guids, keep the first pointer per
guid. `publisher_guids_json` stores only the guids. The two parsers return `[]` for null, bad
JSON, or a value that is not an array, and keep only entries that pass a type guard (strings;
objects with string `feedGuid` and `channelIdText`, `channelTitle` string or null, `mediumId`
number or null).

### `apps/mobile/src/data/repositories/addByRssListedFeeds.ts` (new, pure)

The decisions behind the SQLite half, so they test without a database:

```typescript
export type AddByRssListedFeedRecord = {
  publisherFeedUrl: string;
  feedGuid: string;
  position: number;
  kind: 'add_by_rss' | 'directory' | 'unresolved';
  feedUrl: string | null;
  title: string | null;
  listedAtChannelLevel: boolean;
  itemGuids: string[];
  channelIdText: string | null;
  channelTitle: string | null;
  mediumId: number | null;
  imageUrl: string | null;
  artworkChecked: boolean;
  pendingRequestId: string | null;
  unresolvedReason: string | null;
};

export const rowToListedFeedRecord = (row: AddByRssListedFeedRow): AddByRssListedFeedRecord => …;

/** Rows for one artist's new list, carrying over artwork and pending ids of unchanged entries. */
export const toListedFeedInserts = (
  publisherFeedUrl: string,
  listed: readonly AddByRSSPublisherListedFeed[],
  existing: readonly AddByRssListedFeedRecord[]
): AddByRssListedFeedInsert[] => …;

/** Whether any listing names this feed, by canonical URL or by its guid. */
export const isFeedListed = (
  feed: { feedUrl: string; podcastGuid: string | null },
  listings: readonly Pick<AddByRssListedFeedRecord, 'feedGuid' | 'feedUrl'>[]
): boolean => …;

/** URLs of listed-only rows (`followed` false) that no listing names any more. */
export const listedOnlyFeedUrlsToRemove = (
  feeds: readonly { feedUrl: string; followed: boolean; podcastGuid: string | null }[],
  listings: readonly Pick<AddByRssListedFeedRecord, 'feedGuid' | 'feedUrl'>[]
): string[] => …;
```

`toListedFeedInserts`:

- `position` is the index in `listed`; `feedGuid` lowercased; `itemGuids` stored as JSON.
- `directory`: `channelIdText`, `channelTitle`, `mediumId` from the entry. When an existing row
  has the same `feedGuid` and the same `channelIdText`, keep its `imageUrl` and `artworkChecked`.
- `add_by_rss`: `pendingRequestId = entry.requestId`.
- `unresolved`: `unresolvedReason = entry.reason`.

URL comparison in `isFeedListed` uses `canonicalAddByRSSFeedUrl` on both sides (fall back to the
trimmed string when it returns null). Guid comparison is lowercase.

## Repository (`addByRssRepository.ts`)

- `rowToRecord` sets `followed: row.followed === 1`.
- `listFeeds`: add `where(eq(schema.addByRssFeed.followed, 1))`. Its doc says it returns the
  member's followed Add by RSS feeds.
- New `listAllFeeds`: the old body (every row, newest `updatedAt` first).
- `listFeedsByCredentials` and `listParsedFeedUrls`: followed rows only.
- `upsertFeed(record, mappedFeed?)`:
  - Base values add `followed` only when `record.followed` is defined (`1`/`0`). An update with
    the field absent keeps the stored value; an insert with it absent gets the default 1.
  - When `mappedFeed` is non-null, the parsed values add `podcastGuid` and
    `publisherGuidsJson` from `addByRssPublisherRefsFromMappedFeed`.
  - Seed the auto-download rule for a new feed only when `record.followed !== false`.
- New `setPublisherDirectoryMatches(feedUrl, matches: AddByRssDirectoryPublisherMatch[])`: writes
  `publisher_directory_json`.
- New `getPublisherState(feedUrl): Promise<{ publisherGuids: string[]; directoryMatches: AddByRssDirectoryPublisherMatch[] | null } | null>`:
  the stored guids and, when `publisher_directory_json` is non-null, its parsed matches (null
  column means "never looked up"). Plan 82 uses it to skip a lookup when the guids are unchanged.
- New `setFollowed(feedUrl, followed: boolean)`: writes the column. When it sets `true`, seed the
  auto-download rule exactly as `upsertFeed` does for a new feed.
- New `listListedFeeds(publisherFeedUrl)`: records ordered by `position`.
- New `listAllListedFeeds()`: every record.
- New `replaceListedFeeds(publisherFeedUrl, listed: readonly AddByRSSPublisherListedFeed[])`: in one
  transaction, read that artist's rows, delete them, insert `toListedFeedInserts(...)`. Then call
  `pruneListedOnlyFeeds()` outside the transaction.
- New `setListedFeedPending(publisherFeedUrl, feedGuid, requestId: string | null)` and
  `setListedFeedArtwork(publisherFeedUrl, feedGuid, imageUrl: string | null)` (the second also
  sets `artwork_checked = 1`).
- New private `pruneListedOnlyFeeds()`: reads every feed's `feedUrl`, `followed`, `podcastGuid`
  and every listing, and removes each URL `listedOnlyFeedUrlsToRemove` returns with the private
  cleanup below.
- Move the body of `removeFeed` into a private `deleteStoredFeed(feedUrl)` (row, credentials, live
  status, seen state, auto-download rule). `removeFeed(feedUrl)` now calls it, then deletes
  `add_by_rss_listed_feed` rows whose `publisher_feed_url` is `feedUrl`, then
  `pruneListedOnlyFeeds()`.
- `clear()` also deletes every `add_by_rss_listed_feed` row.

Every write above that changes `followed`, `podcast_guid`, `publisher_guids_json`,
`publisher_directory_json`, or a listing must leave a single place to hook a reload: route them
through one private `afterArtistRelationsChanged()` that is empty in this plan. Plan 81 fills it.

## Unseen state (`channelSeenRepository.ts`)

`markAllSeen` (the `addByRssFeed` select near line 156) and `listUnseen` (near lines 226–229)
add `where(eq(schema.addByRssFeed.followed, 1))`, so a listed-only album never shows an unseen
badge or counts toward Home.

## One-time pass (`applyAddByRssPublisherRefs.ts`, new)

Rows parsed before this version have a bundle but no guid columns. Copy
`applyAddByRssResourceTypes.ts` and its pure half `lib/addByRss/storedResourceType.ts`: export
`ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY = 'add_by_rss_publisher_refs_v1'` and
`publisherRefUpdatesFromStoredRows(rows)` from `publisherRefs.ts`, read rows with a stored bundle,
write the two columns for each update, set the marker. Call it from
`initializeDatabase` in `data/db/index.ts` right after `applyAddByRssResourceTypes`.

## Must stay true

- A device with no Add by RSS artist sees no change anywhere: every existing row reads
  `followed = 1`, and no listing exists to prune against.
- Nothing here calls the network.
- No `as` beyond what `applyAddByRssResourceTypes.ts` already does to read the bundle.

## Tests

- `migrations.test.ts`: version 25 exists; its SQL contains the four `ALTER TABLE add_by_rss_feed`
  statements and `CREATE TABLE IF NOT EXISTS add_by_rss_listed_feed`, in the file's recording
  database style.
- `publisherRefs.test.ts`: guid and pointer guids lowercased and deduped; a bundle without either
  gives `{ podcastGuid: null, publisherGuids: [] }`; both parsers return `[]` for null, `'x'`, and
  `'{}'`, and drop malformed entries; `publisherRefUpdatesFromStoredRows` skips rows whose bundle
  JSON does not parse.
- `addByRssListedFeeds.test.ts`: `toListedFeedInserts` sets positions in order, carries over
  `imageUrl` only when guid and `channelIdText` both match, sets `pendingRequestId` for
  `add_by_rss`; `isFeedListed` matches by canonical URL (different case host, trailing slash as
  `canonicalAddByRSSFeedUrl` normalizes) and by guid; `listedOnlyFeedUrlsToRemove` keeps followed
  rows always, keeps a listed-only row two artists list when one artist's listings go, and returns
  it when both go.
- Add both new test paths to `include` in `apps/mobile/vitest.config.ts`.

## Release scratchpad

none
