**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 72 — Web: match Add by RSS artists and albums by guid

Pure functions that answer every "which albums / which artist" question for Add by RSS on the
web, from the stores plan 71 adds. Pages and the player (plans 73–77) call these; none of them
match by hand. Matching is by guid on the device, with no verification (R40): the member trusts
their own feeds.

## Rows

R8, R19, R40, R42, R43, R44, R45, R47, R50, R52, R54

## Runs after

50, 71

Plan 50 adds `ArtistLineLink` in `apps/web/src/lib/artistPublishers.ts`. Plan 71 adds the record
types and `normalizeAddByRSSGuid`, `toAddByRSSComparableFeedUrl`.

## Files

apps/web/src/utils/addByRSS/publisherLinks.ts
apps/web/src/utils/addByRSS/publisherLinks.test.ts
apps/web/src/utils/addByRSS/credentialsStatus.ts
apps/web/src/utils/addByRSS/credentialsStatus.test.ts

## Decisions this plan fixes

- **"Albums by an Add by RSS artist" = albums it lists at channel level, plus Add by RSS albums
  whose `<podcast:publisher>` names its guid.** R45 names the first; area J's unsubscribe rule and
  the artist line (R50) name both. One rule for the page, the line, and the prompt. Listing only
  was the other choice, which would make an album show the artist in the player but not appear on
  that artist's page.
- **Directory rows count as albums only when their medium is an album medium or unknown.**
- **Item-level references add only the referenced tracks**, and only when that album is on this
  browser (followed or listed). That is plan 20's reading of R19 ("once the member has its
  album"). References into directory albums are not shown on the Add by RSS artist page; the
  directory album row links to its own track list.
- **Artist line order:** artists the album's pointer names come first, in pointer order, then
  artists that list it, in stored order. Each artist once.

## `publisherLinks.ts` (new)

Pure: no storage, network, or React. Import `isAlbumMediumId`, `parseMediumId` from
`@podverse/helpers`; `ArtistLineLink` with `import type` from `../../lib/artistPublishers`; record
types from `./types`; `normalizeAddByRSSGuid`, `toAddByRSSComparableFeedUrl` from `./listedFeeds`.

```typescript
export const addByRSSArtistPath = (idText: string): string => `/add-by-rss/artist/${idText}`;

/** The album's own `podcast:guid`, normalized. */
export const getAddByRSSFeedGuid = (feed: AddByRSSFeedRecord): string | null;

/** Guids the feed's `<podcast:publisher>` pointers name, normalized, in order, each once. */
export const getAddByRSSFeedPublisherRefs = (
  feed: AddByRSSFeedRecord
): { feedGuid: string; feedUrl: string | null }[];

/** True when the mapped feed is an album medium. A record not parsed yet is not. */
export const isAddByRSSAlbumFeed = (feed: AddByRSSFeedRecord): boolean;

/** Followed records, then listed records whose comparable URL no followed record has. */
export const mergeAddByRSSAlbumSources = (
  followed: readonly AddByRSSFeedRecord[],
  listed: readonly AddByRSSListedFeedRecord[]
): AddByRSSAlbumSource[];

export type AddByRSSArtistAlbumEntry =
  | { kind: 'add_by_rss'; source: AddByRSSAlbumSource }
  | { kind: 'directory'; channelIdText: string; title: string; feedGuid: string };

export const resolveAddByRSSArtistAlbums = (input: {
  artist: AddByRSSFeedRecord;
  link: AddByRSSPublisherLinkRecord | null;
  sources: readonly AddByRSSAlbumSource[];
}): AddByRSSArtistAlbumEntry[];

export type AddByRSSArtistTrackRef = {
  source: AddByRSSAlbumSource;
  /** Null: every track. Otherwise only these item guids. */
  itemGuids: ReadonlySet<string> | null;
};

export const resolveAddByRSSArtistTrackRefs = (input: {
  link: AddByRSSPublisherLinkRecord | null;
  albums: readonly AddByRSSArtistAlbumEntry[];
  sources: readonly AddByRSSAlbumSource[];
}): AddByRSSArtistTrackRef[];

/** Add by RSS albums on this browser whose publisher pointer names `publisherGuid`. */
export const addByRSSAlbumsNamingPublisher = (
  sources: readonly AddByRSSAlbumSource[],
  publisherGuid: string | null | undefined
): AddByRSSAlbumSource[];

export type AddByRSSAlbumArtistResolution =
  | { kind: 'add_by_rss'; links: ArtistLineLink[] }
  | { kind: 'directory_lookup'; refs: { feedGuid: string; feedUrl: string | null }[] }
  | { kind: 'none' };

export const resolveAddByRSSAlbumArtists = (input: {
  album: AddByRSSFeedRecord;
  links: readonly AddByRSSPublisherLinkRecord[];
}): AddByRSSAlbumArtistResolution;

/** Add by RSS artists on this browser that list a directory album. */
export const resolveDirectoryAlbumAddByRSSArtists = (input: {
  channelIdText: string;
  podcastGuid: string | null | undefined;
  links: readonly AddByRSSPublisherLinkRecord[];
}): ArtistLineLink[];
```

Rules, in the order the functions appear:

- `getAddByRSSFeedGuid`: `normalizeAddByRSSGuid(feed.mappedFeed?.channel?.channel?.podcast_guid)`.
- `getAddByRSSFeedPublisherRefs`: `feed.mappedFeed?.channel?.publisherRemoteItems ?? []`; for each,
  `feedGuid = normalizeAddByRSSGuid(item.feed_guid)` (skip null), `feedUrl = item.feed_url ?? null`;
  first occurrence of a guid wins.
- `isAddByRSSAlbumFeed`: `isAlbumMediumId(parseMediumId(feed.mappedFeed?.channel?.channel?.medium_id))`.
- `mergeAddByRSSAlbumSources`: compare with `toAddByRSSComparableFeedUrl`.
- `resolveAddByRSSArtistAlbums`:
  1. `artistGuid = getAddByRSSFeedGuid(artist)`; `artistUrl` = comparable URL of the artist.
     `findSource(row)` = the source whose comparable URL equals the row's comparable `feedUrl`
     (when non-null), else the first whose `getAddByRSSFeedGuid` equals
     `normalizeAddByRSSGuid(row.feedGuid)`.
  2. For each `link.listedFeeds` row with `listedAtChannelLevel`, in order:
     - `directory`: when `row.mediumId === null || isAlbumMediumId(row.mediumId)`, push
       `{ kind: 'directory', channelIdText, title: row.channelTitle ?? row.title ?? row.channelIdText, feedGuid: row.feedGuid }`
       once per `channelIdText`.
     - `add_by_rss`: `findSource(row)`; push when found, its feed is not the artist itself, and it
       is not parsed yet (`mappedFeed === undefined`) or `isAddByRSSAlbumFeed`.
     - `unresolved`: nothing.
  3. Then, when `artistGuid !== null`, every source with `isAddByRSSAlbumFeed` whose
     `getAddByRSSFeedPublisherRefs` contains `artistGuid`.
  4. Each `add_by_rss` source once (comparable URL); the first push wins.
- `resolveAddByRSSArtistTrackRefs`: every `add_by_rss` album entry gives `{ source, itemGuids: null }`.
  Then each `link.listedFeeds` row with `!listedAtChannelLevel`, `itemGuids.length > 0`, and
  `kind !== 'directory'`: `findSource(row)` as above; skip when not found or when that source
  already has `null`; otherwise add the row's item guids (trimmed) to that source's set. One ref
  per source.
- `addByRSSAlbumsNamingPublisher`: `normalizeAddByRSSGuid(publisherGuid)`; null → `[]`. Keep
  sources with `isAddByRSSAlbumFeed` whose refs contain it.
- `resolveAddByRSSAlbumArtists`:
  1. Not `isAddByRSSAlbumFeed(album)` → `{ kind: 'none' }`.
  2. `albumGuid`, `albumUrl` (comparable), `refs = getAddByRSSFeedPublisherRefs(album)`.
  3. Named: for each ref, links with `publisherGuid === ref.feedGuid`.
  4. Listing: links with a row `listedAtChannelLevel` whose comparable `feedUrl` equals `albumUrl`
     or whose normalized `feedGuid` equals `albumGuid` (non-null).
  5. Named then listing, each `publisherFeedUrl` once; map to
     `{ idText: link.publisherIdText, title: link.publisherTitle.trim(), href: addByRSSArtistPath(link.publisherIdText) }`,
     dropping empty titles. Non-empty → `add_by_rss`.
  6. Else `refs.length > 0` → `{ kind: 'directory_lookup', refs }`. Else `none`.
     Never return an artist the device has not stored; never parse anything (R51).
- `resolveDirectoryAlbumAddByRSSArtists`: links with a row `listedAtChannelLevel` that is
  `kind === 'directory' && row.channelIdText === channelIdText`, or whose normalized `feedGuid`
  equals `normalizeAddByRSSGuid(podcastGuid)` (non-null). Same link mapping and dedupe as above.

## `credentialsStatus.ts`

Add, beside `getAddByRSSCredentialsNeed`:

```typescript
/**
 * Listed albums also need credentials when the server withheld the artist's credentials from
 * them (another domain, or plain HTTP) and the album asked for some.
 */
export const getListedAddByRSSCredentialsNeed = (
  feed: Pick<AddByRSSFeedRecord, 'requiresCredentials' | 'lastFailureReason'>,
  hasLocalCredentials: boolean
): AddByRSSCredentialsNeed | null;
```

`credentials_withheld_other_domain` and `credentials_withheld_insecure` give `'missing'`; anything
else defers to `getAddByRSSCredentialsNeed`. Do not change `getAddByRSSCredentialsNeed`: followed
feeds keep today's rules.

## Must stay true

- Guids compare trimmed and case-insensitive; feed URLs compare through
  `toAddByRSSComparableFeedUrl`; item guids compare trimmed and case-sensitive.
- No function returns directory content as an Add by RSS album, or the reverse.
- No `as`, no `any`, strict equality. Named exports only.

## Tests

`publisherLinks.test.ts` (new). Build records with small factories at the top of the file
(`albumRecord({ idText, feedUrl, guid, publisherGuids, mediumId, items })`, `listedRecord(…)`,
`link({ …, listedFeeds })`). One `it` each:

- An artist lists album A at channel level (`add_by_rss`) and directory album D: entries are A
  then D, D with its `channelIdText`.
- A followed and a listed record for the same URL (one `http`, one `https`): one entry, the
  followed one.
- Album B is not listed but names the artist's guid in upper case: B is appended.
- Two artists both list A: A resolves for each (R44).
- A directory row with a podcast medium is left out; an `unresolved` row adds nothing.
- Track refs: A listed at channel level gives `itemGuids: null`; an item-level-only row into
  listed album C gives C with exactly those guids; an item-level row into a directory album adds
  nothing; an item-level row whose album is not on the browser adds nothing.
- `addByRSSAlbumsNamingPublisher` keeps only album-medium records naming the guid.
- `resolveAddByRSSAlbumArtists`: named artist first, then listing artist, each once; an album
  with no stored artist but a pointer gives `directory_lookup` with that guid and URL; no pointer
  and no lister gives `none`; a podcast-medium feed gives `none`.
- `resolveDirectoryAlbumAddByRSSArtists` matches by `channelIdText` and, separately, by guid.

`credentialsStatus.test.ts`: add a `describe('getListedAddByRSSCredentialsNeed')` with the two
withheld reasons → `'missing'`, `credentials_rejected` → `'rejected'`, and a parsed record → `null`.

## Release scratchpad

none
