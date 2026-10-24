**Cursor model:** Opus 5.5 · **Reasoning:** high

# 81 — Mobile answers "which artist" for Add by RSS from memory

The full player reserves its artist band when an item starts, the mini player and lock screen
build their lines synchronously, and the directory artist page decides whether a slot exists from
a hook (plan 40). None of them can wait on SQLite. This plan adds a small in-memory index of the
artist relations plan 80 stores, hydrated when the database opens and after every write, and the
`LineArtist` type that lets one artist line hold a directory artist or an Add by RSS artist.
Matching is by guid on the device with no verification (R40).

## Rows

R8, R40, R44, R47, R50, R51, R52

## Runs after

10, 80

## Files

apps/mobile/src/lib/playback/lineArtist.ts
apps/mobile/src/lib/playback/lineArtist.test.ts
apps/mobile/src/lib/addByRss/addByRssArtistIndex.ts
apps/mobile/src/lib/addByRss/addByRssArtistIndex.test.ts
apps/mobile/src/hooks/useAddByRssArtistIndexVersion.ts
apps/mobile/src/data/db/readAddByRssArtistIndex.ts
apps/mobile/src/data/db/index.ts
apps/mobile/src/data/repositories/addByRssRepository.ts
apps/mobile/vitest.config.ts

## Reuses

- `DTOVerifiedPublisher` (`@podverse/helpers/dto`, plan 10).
- `isAlbumMediumId`, `getChannelRouteKind` from `@podverse/helpers` / `@podverse/helpers/medium`
  (plan 60 imports `getChannelRouteKind` from the latter; use the same paths).
- `parseStoredPublisherGuids`, `parseStoredPublisherDirectoryMatches`, `rowToListedFeedRecord`,
  `AddByRssListedFeedRecord` (plan 80).
- The memory-map-plus-hydrate pattern of `apps/mobile/src/lib/sectionChromeFlags.ts`.
- `useSyncExternalStore` for the hook, as other mobile memory stores do.

## Decisions this plan fixes

- **One artist type for every line.** `LineArtist` is a union, not a widened
  `DTOVerifiedPublisher`: an Add by RSS idText is random and shares no id space with directory
  ids, so the kind must be explicit.
- **Order on an Add by RSS album's line** (same rule as web plan 72): Add by RSS artists the
  album's own publisher pointers name, in pointer order; then Add by RSS artists that list it at
  channel level, by title. Each artist once. Only when that is empty: the directory channels the
  album's pointers resolved to (plan 82 stores them) whose medium routes to an artist page. Else
  nothing (R50). Nothing is parsed to fill the line (R51).
- **R44:** an album two Add by RSS artists list resolves to both.
- **R52:** a directory album with no verified artist shows the Add by RSS artists on this device
  that list it at channel level, matched by the listing's `channelIdText` or by the album's guid.
- **R47:** a directory artist's "Your Add by RSS Albums" are Add by RSS albums on the device
  (followed or listed-only) whose stored directory matches include that artist's `channelIdText`.
  Web plan 75 counts the same set (followed or listed under a followed Add by RSS artist, named by
  guid); the section is device-only like the artist page itself, so R46's "only under that
  artist" is read as keeping them off Home and the library.
- **Directory listing rows count as albums only when `mediumId` is null or an album medium**
  (web plan 72's rule).

## `lib/playback/lineArtist.ts` (new)

```typescript
import type { DTOVerifiedPublisher } from '@podverse/helpers/dto';

/** An artist on a now-playing or track byline: a directory artist or one of the member's Add by RSS feeds. */
export type LineArtist =
  | { kind: 'directory'; publisher: DTOVerifiedPublisher }
  | { kind: 'add-by-rss'; feedIdText: string; feedUrl: string; title: string };

export const directoryLineArtist = (publisher: DTOVerifiedPublisher): LineArtist => …;

/** Stable React key: `directory:<id_text>` or `add-by-rss:<feedIdText>`. */
export const lineArtistKey = (artist: LineArtist): string => …;

/** Trimmed display title; '' when the directory artist has none. */
export const lineArtistTitle = (artist: LineArtist): string => …;

/** Non-empty titles joined with ', ' (the separator `joinVerifiedPublisherTitles` uses). */
export const joinLineArtistTitles = (artists: readonly LineArtist[]): string => …;
```

## `lib/addByRss/addByRssArtistIndex.ts` (new)

Pure module state: no SQLite, React, or network.

```typescript
export type AddByRssArtistIndexFeed = {
  feedUrl: string;
  feedIdText: string;
  title: string;
  resourceType: AddByRSSResourceType;
  followed: boolean;
  podcastGuid: string | null;
  publisherGuids: readonly string[];
  directoryMatches: readonly AddByRssDirectoryPublisherMatch[];
};

export type AddByRssArtistIndexListing = Pick<
  AddByRssListedFeedRecord,
  'publisherFeedUrl' | 'feedGuid' | 'feedUrl' | 'kind' | 'channelIdText' | 'mediumId' | 'listedAtChannelLevel'
>;

export const hydrateAddByRssArtistIndex = (input: {
  feeds: readonly AddByRssArtistIndexFeed[];
  listings: readonly AddByRssArtistIndexListing[];
}): void => …;

export const subscribeAddByRssArtistIndex = (listener: () => void): (() => void) => …;
export const getAddByRssArtistIndexVersion = (): number => …;

/** Artists for an Add by RSS album's line. */
export const addByRssAlbumArtists = (albumFeedUrl: string): LineArtist[] => …;

/** Add by RSS artists on this device listing a directory album at channel level. */
export const addByRssArtistsListingDirectoryAlbum = (album: {
  channelIdText: string;
  podcastGuid: string | null | undefined;
}): LineArtist[] => …;

/** Add by RSS albums on the device whose publisher pointer resolved to this directory artist, by title. */
export const addByRssAlbumsNamingDirectoryArtist = (
  artistIdText: string
): AddByRssArtistIndexFeed[] => …;

export const resetAddByRssArtistIndexForTests = (): void => …;
```

Rules:

- `hydrate` replaces both arrays, builds maps by canonical feed URL
  (`canonicalAddByRSSFeedUrl(url) ?? url.trim()`) and by `podcastGuid`, increments the version,
  and notifies listeners.
- An "Add by RSS artist" is a feed with `resourceType === 'artists'`.
- `addByRssAlbumArtists(albumFeedUrl)`: find the album feed; none → `[]`.
  1. Named: for each guid in `publisherGuids`, the artist feed whose `podcastGuid` equals it.
  2. Listing: listings with `listedAtChannelLevel` whose canonical `feedUrl` equals the album's or
     whose `feedGuid` equals the album's `podcastGuid`; their `publisherFeedUrl` feeds, artists
     only, sorted by title with `localeCompare`.
  3. Named then listing, each `feedIdText` once, never the album itself →
     `{ kind: 'add-by-rss', feedIdText, feedUrl, title }`. Non-empty → return.
  4. Else `directoryMatches` filtered to `mediumId !== null && getChannelRouteKind(mediumId) === 'artist'`,
     each `channelIdText` once →
     `directoryLineArtist({ id_text: channelIdText, title: channelTitle, medium_id: mediumId })`.
- `addByRssArtistsListingDirectoryAlbum`: listings with `listedAtChannelLevel` and
  `kind === 'directory'` whose `channelIdText` matches, or (any kind) whose `feedGuid` equals the
  lowercased `podcastGuid`; map to their artist feeds as in step 2.
- `addByRssAlbumsNamingDirectoryArtist`: feeds with `resourceType === 'albums'` (followed or not)
  and a directory match whose `channelIdText === artistIdText`; sorted by title.

## `hooks/useAddByRssArtistIndexVersion.ts` (new)

```typescript
/** Re-renders when Add by RSS artist relations change; use the value as a memo dependency. */
export const useAddByRssArtistIndexVersion = (): number =>
  useSyncExternalStore(subscribeAddByRssArtistIndex, getAddByRssArtistIndexVersion);
```

## `data/db/readAddByRssArtistIndex.ts` (new)

`reloadAddByRssArtistIndex(): Promise<void>` selects from `addByRssFeed` only `feedUrl`, `idText`,
`title`, `resourceType`, `followed`, `podcastGuid`, `publisherGuidsJson`,
`publisherDirectoryJson` (never `mappedFeedJson`), and every `addByRssListedFeed` row; maps with
the plan 80 parsers and `rowToListedFeedRecord`; calls `hydrateAddByRssArtistIndex`. A row whose
`title` is null uses its `feedUrl`.

Call it from `initializeDatabase` in `data/db/index.ts` right after the plan 80 publisher-refs pass.
In `addByRssRepository.ts`, plan 80's private `afterArtistRelationsChanged()` becomes
`await reloadAddByRssArtistIndex()`.

## Must stay true

- Every reader is synchronous and returns `[]` before hydration.
- A device with no Add by RSS artists and no stored matches returns `[]` from every reader, so
  every line reads as it did.
- No `as`, no `any`, strict equality.

## Tests

- `lineArtist.test.ts`: keys for both kinds; `joinLineArtistTitles` skips an empty directory
  title and joins with ', '.
- `addByRssArtistIndex.test.ts` (reset before each):
  - An album naming artist A by guid and listed by artist B gives `[A, B]`; listed by A as well
    gives A once.
  - An album two artists list (one by URL with a different host case, one by guid) gives both,
    by title.
  - No Add by RSS artist but a stored directory match with an artist medium gives one
    `directory` artist; a match with an album medium gives `[]`.
  - A podcast-only device (no artists, no matches) gives `[]`.
  - `addByRssArtistsListingDirectoryAlbum` matches by `channelIdText` and, separately, by guid;
    an item-level-only listing does not count.
  - `addByRssAlbumsNamingDirectoryArtist` returns a followed and a listed-only album naming the
    artist, by title, and skips non-album feeds and albums naming another artist.
  - `hydrate` increments the version and calls a subscribed listener; the unsubscribe stops it.
- Add both test paths to `include` in `apps/mobile/vitest.config.ts`.

## Release scratchpad

none
