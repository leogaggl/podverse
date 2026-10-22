**Cursor model:** Opus 5.5 · **Reasoning:** high

# 74 — Web: open, play, and follow an album an Add by RSS artist lists

Albums parsed because the member added an Add by RSS artist live in the `listedFeeds` store
(plan 71). Their rows link to the existing Add by RSS album, track, livestream, and credentials
pages, which today read only followed feeds and show "not found". This plan lets those pages read
a listed album and lets the member follow it without losing its URL or tracks (R46).

Before follow, the album page matches a mobile listed-only album (plan 80, `followed = 0`): its
Tracks tab shows that album's livestream rows, and Settings shows
`AddByRSSCredentialsSettingsSection` as well as Check for Updates (R60). Web keeps the separate
listed stores (plan 71). Those rows and that credential save stay in `listedFeeds`. Home, the
library lists, and the global livestream lists stay on followed feeds.

## Rows

R8, R46, R54, R60

## Runs after

71

## Files

apps/web/src/utils/addByRSS/types.ts
apps/web/src/utils/addByRSS/itemIndex.ts
apps/web/src/utils/addByRSS/listedFeeds.ts
apps/web/src/utils/addByRSS/listedFeeds.test.ts
apps/web/src/utils/addByRSS/actions.ts
apps/web/src/utils/addByRSS/actions.publisherListedFeeds.test.ts
apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx
apps/web/src/app/add-by-rss/album/AddByRSSAlbumPageClient.tsx
apps/web/src/components/AddByRSS/Artist/Album/AddByRSSAlbumHeader.tsx
apps/web/src/components/Settings/AddByRSSCredentialsSettingsSection.tsx
apps/web/src/app/add-by-rss/track/AddByRSSTrackItemPageClient.tsx
apps/web/src/app/add-by-rss/livestream/AddByRSSLivestreamItemPageClient.tsx
apps/web/src/app/add-by-rss/credentials/AddByRSSCredentialsPageClient.tsx
release-notes/scratchpad.md

## Decisions this plan fixes

- **Following keeps the album's idText.** The Subscribe button on a listed album passes the
  listed record as `seedRecord` (plan 71), so `/add-by-rss/album/<id>` and its tracks keep working
  and nothing re-renders empty while the follow's parse runs. Plan 71's `seedRecord` copy list
  stays as written (it does not copy `itemIdTextsByGuid` or `liveItemIdTextsByGuid`). A livestream
  URL opened before follow still resolves through `findListedAddByRSSLivestream`, because the
  listed record stays after follow.
- **A listed album shows its own livestream rows.** The Tracks tab builds them in memory from the
  listed record, with the same order helper the followed album uses
  (`selectChannelOrderedLiveItems`). They are not written into the `liveItems` store.
- **Settings shows Check for Updates and the credentials section.** Render
  `AddByRSSCredentialsSettingsSection` whenever the member is logged in, followed or not. For a
  listed album its parse result goes through `applyListedAddByRSSParseStatus`, so saving a
  username and password does not create a followed feed. The credentials page still hides its
  remove control until the member follows (that control unfollows a feed). The Settings tab has
  no remove control; do not add one.
- **Home, the library lists, and the global livestream lists stay on followed feeds.** Mobile
  plan 80 keeps `followed = 0` rows out of `listFeeds`, `listFeedsByCredentials` (the library
  livestream chip and the Needs username and password section), Home, unseen badges, and
  refresh-all. On web those readers already use the followed `feeds` store:
  `useUpcomingAddByRSSLivestreams` (`apps/web/src/hooks/useUpcomingAddByRSSLivestreams.ts`, used by
  subscribed Home livestreams and `/add-by-rss?tab=livestreams`) calls `getAllAddByRSSFeeds()` and
  then `buildAddByRSSLivestreamIndex`. `AddByRSSListClient` partitions that same followed list.
  Do not pass a listed album into `buildAddByRSSItemsIndex` or `buildAddByRSSLivestreamIndex`:
  both clear the global store and rewrite it from the array they are given. Plan 73 step 5 keeps
  the artist page's livestream index on followed feeds only; leave that. A listed album's
  livestreams show on its own page, which is where mobile shows them.

## `types.ts`

On `AddByRSSListedFeedRecord` (plan 71), next to `itemIdTextsByGuid`:

```typescript
/** Livestream idTexts by item guid. Listed livestreams never enter the liveItems store. */
liveItemIdTextsByGuid: Record<string, string>;
```

Plan 71's ingest literal in `actions.ts` sets `itemIdTextsByGuid: {}`. Set
`liveItemIdTextsByGuid: {}` on that same object.

## `itemIndex.ts`

Rename the module-private `toLiveIndexItem` to `toAddByRSSLivestreamIndexItem` and export it.
Update its caller in `buildAddByRSSLivestreamIndex`. No behavior change. Plan 71 already does this
for `toIndexItem` / `toAddByRSSItemIndexItem`.

## `listedFeeds.ts`

Add, beside the track helpers plan 71 defines:

```typescript
/** The guid key a livestream has in the index: its item guid, else `${feed.idText}-${index}`. */
export const getAddByRSSLiveItemGuidKey = (
  feed: Pick<AddByRSSFeedRecord, 'idText'>,
  liveBundle: AddByRSSMappedFeed['liveItems'][number],
  index: number
): string;

/** Keeps every existing livestream idText and creates one for each new live item guid. */
export const assignListedLiveItemIdTexts = (
  record: AddByRSSListedFeedRecord
): AddByRSSListedFeedRecord;

/** Index-shaped livestreams for a listed album, built in memory with its stored idTexts. */
export const listedAddByRSSLivestreamIndexItems = (
  record: AddByRSSListedFeedRecord
): AddByRSSLivestreamIndexItem[];

/** A listed album's livestream by its idText, built in memory. Null when no listed album has it. */
export const findListedAddByRSSLivestream = async (
  itemIdText: string
): Promise<{ feed: AddByRSSListedFeedRecord; item: AddByRSSLivestreamIndexItem } | null>;
```

- `getAddByRSSLiveItemGuidKey` matches `getLiveItemGuid` in `itemIndex.ts`
  (`liveBundle.item.guid ?? \`${feed.idText}-${index}\``).
- `assignListedLiveItemIdTexts` walks `record.mappedFeed?.liveItems ?? []` the way
  `assignListedTrackIdTexts` walks items. A missing map is `{}`.
- `listedAddByRSSLivestreamIndexItems` maps those live items with
  `toAddByRSSLivestreamIndexItem(record, bundle, index, record.liveItemIdTextsByGuid[key])`.
- `findListedAddByRSSLivestream` scans `getAllListedAddByRSSFeeds()`. The first record whose
  `liveItemIdTextsByGuid` has a value equal to `itemIdText`; build its rows with
  `listedAddByRSSLivestreamIndexItems` and return the one with that idText.

`findListedAddByRSSTrack` (below) is unchanged.

```typescript
/** A listed album's track by its idText, built in memory. Null when no listed album has it. */
export const findListedAddByRSSTrack = async (
  itemIdText: string
): Promise<{ feed: AddByRSSListedFeedRecord; item: AddByRSSItemIndexItem } | null>;
```

Scan `getAllListedAddByRSSFeeds()`; the first record whose `itemIdTextsByGuid` has a value equal to
`itemIdText`; build its items with `listedAddByRSSTrackIndexItems` and return the one with that
idText.

## `actions.ts`

In `applyListedAddByRSSParseStatus` (plan 71), the next record is
`assignListedLiveItemIdTexts(assignListedTrackIdTexts(buildAddByRSSFeedRecordFromStatus(base, …)))`.
`buildAddByRSSFeedRecordFromStatus` spreads `base`, so both maps survive a status that has no new
items. Still never writes the feeds store.

## `AddByRSSDetailClient.tsx`

- State: replace `feed` with `source: AddByRSSAlbumSource | null` (keep a derived
  `const feed = source?.feed ?? null` so the rest of the component reads the same).
- Loader: a local `readSource = () => resourceType === 'albums' ? getAddByRSSAlbumSourceByIdText(idText) : getAddByRSSFeedByIdText(idText).then((record) => (record ? { followed: true, feed: record } : null))`.
  Use it for the stored read, the read after `syncAddByRSSFollowStubs`, and the
  `useAddByRSSFeedChanged` reload. Only albums fall back to the listed store.
- First parse: only when `source?.followed === true` and `addByRSSFeedNeedsFirstParse(source.feed)`.
- `useAddByRSSFeedChanged(feed?.feedUrl ?? null, …)` stays keyed by the feed URL; the reload uses
  `readSource`, so a listed album that the member follows switches to the followed record.
- Albums: `<AddByRSSAlbumPageClient feed={source.feed} followed={source.followed} />`.

## `AddByRSSAlbumPageClient.tsx`

New prop `followed: boolean` (required; the only caller passes it).

- Index effect (today `buildAddByRSSItemsIndex([localFeed])` … `setLiveItems(livestreams)`): when
  `followed` is false, do not call either index builder. Instead
  `setItemIdTextMap(new Map(listedAddByRSSTrackIndexItems(localFeed).map((item) => [item.id, item.idText])))`
  and `setLiveItems(listedAddByRSSLivestreamIndexItems(listedFeed))`. `localFeed` needs the listed
  fields there: keep a `listedFeed: AddByRSSListedFeedRecord | null` state set from the prop when
  `followed` is false (narrow with a type guard
  `isListedFeedRecord(record): record is AddByRSSListedFeedRecord` that checks
  `'itemIdTextsByGuid' in record`; add the guard to `listedFeeds.ts` and export it). When
  `listedFeed` is null, `setLiveItems([])`.
- The page already orders with `selectChannelOrderedLiveItems(liveItems)` and shows them on the
  Tracks tab when `currentPage === 1`. Leave that. A listed album therefore shows the same
  livestream rows a followed album shows.
- `handleParseStatus`: when `followed` is false, call `applyListedAddByRSSParseStatus` with
  `fallbackRecord: listedFeed` and `onUpdated` that sets both `listedFeed` and `localFeed`;
  otherwise unchanged.
- `handleRefreshFeed`: the post-poll re-read uses `getListedAddByRSSFeedByUrl` when `followed` is
  false. Check for Updates stays on the Settings tab for both.
- Settings tab: keep `RSSFeedSettingsSection`. Render `AddByRSSCredentialsSettingsSection` when
  `loggedInAccount` is set, for both values of `followed`. When `followed` is false, pass
  `applyStatus` (below) and an `onFeedUpdated` that, when `isListedFeedRecord(updated)`, sets
  `listedFeed` and `localFeed`. When `followed` is true, omit `applyStatus` and keep
  `onFeedUpdated={setLocalFeed}`.
- `applyStatus` for a listed album: if `isListedFeedRecord(params.fallbackRecord)`, use that as
  `fallbackRecord`; otherwise use the `listedFeed` state. When both are missing, return null.
  Call `applyListedAddByRSSParseStatus` with the same `cache`, `feedUrl`, `outcome`, `parsedFeed`,
  and `status` the section passes today. Do not call `applyAddByRSSParseStatus`.
- Boosts `resolveItemIdTextByGuid`: when `followed` is false, resolve a track from
  `listedAddByRSSTrackIndexItems(listedFeed)` by `itemGuid`, then a livestream from
  `listedAddByRSSLivestreamIndexItems(listedFeed)` by `itemGuid`, before the index lookups.

The existing followed path keeps calling `buildAddByRSSItemsIndex([localFeed])` and
`buildAddByRSSLivestreamIndex([localFeed])`; changing that is outside this plan.

## `AddByRSSCredentialsSettingsSection.tsx`

Optional prop `applyStatus`, same argument object and result as the
`applyAddByRSSParseStatus({ cache, fallbackRecord, feedUrl, outcome, parsedFeed, status })` call
inside `handleSaveAndCheck`. When the prop is omitted, call `applyAddByRSSParseStatus` as today.
When it is set, call it and do not call `applyAddByRSSParseStatus`.
`saveAddByRSSCredentialsAndQueue` already stores credentials by account and feed URL and does not
write the feeds store; leave it.

## `AddByRSSAlbumHeader.tsx`

In `toggleSubscribe`'s follow branch, pass `seedRecord: feed` to `followAddByRSSChannelAndQueue`,
then `emitAddByRSSFeedChanged(feedUrl)` after `setLoggedInAccount`. The detail page reloads its
source and becomes the followed album with the same idText. The unfollow branch is unchanged
(area J adds its prompt to the artist header, not here).

## `AddByRSSTrackItemPageClient.tsx`

In `load`, after `getAddByRSSItemByIdText(itemIdText)`:

- Found: `feedRecord = (await getAddByRSSAlbumSourceByIdText(found.channelIdText))?.feed ?? null`
  (the album may be listed even when the track was indexed earlier).
- Not found: `listed = await findListedAddByRSSTrack(itemIdText)`; when non-null,
  `setTrack(listed.item)` and `setFeed(listed.feed)`; else today's not-found path.

`syncAddByRSSCacheWithServer` stays first; it never removes listed albums whose artist is still
followed.

## `AddByRSSLivestreamItemPageClient.tsx`

In `load`, after `getAddByRSSLivestreamByIdText(itemIdText)`:

- Found: keep today's `getAddByRSSFeedByIdText(found.channelIdText)`.
- Not found: `listed = await findListedAddByRSSLivestream(itemIdText)`; when non-null,
  `setLivestream(listed.item)` and `setFeed(listed.feed)`; else today's not-found path.

`syncAddByRSSCacheWithServer` stays first. Play on the album row already calls `playAddByRSS`
with the in-memory item, so it does not read the `liveItems` store.

## `AddByRSSCredentialsPageClient.tsx`

- Load with `getAddByRSSAlbumSourceByIdText(idText)`; keep `followed` in state beside `feed`.
- In `handleSaveAndCheck`, the poll applies with `applyListedAddByRSSParseStatus` (and
  `fallbackRecord` the listed record) when `followed` is false; the resource-type fix-up writes
  with `upsertListedAddByRSSFeed` in that case. `saveAddByRSSCredentialsAndQueue` already parses
  without following, so it is unchanged.
- Hide the remove-feed control when `followed` is false (it unfollows a feed the member never
  followed).

Credentials saved here, and on the album Settings tab, are stored for the album's own URL, so its
next parse sends them to that album's domain only.

## Must stay true

- No page writes a listed album into `feeds`, `items`, or `liveItems`, except following it through
  `seedRecord`.
- A listed album's Tracks tab shows its livestream rows. Home, `/add-by-rss` (including
  `?tab=livestreams`), and subscribed livestreams do not.
- The artist page's Needs Username and Password section (plan 73) still lists a listed album that
  needs credentials. The library lists' section does not, because it only partitions followed
  feeds. That is mobile's split: the album's own settings hold credentials, and
  `listFeedsByCredentials` is followed rows only.
- Followed albums, tracks, livestreams, and credentials pages behave as before.
- No `as`, no `any`, strict equality.

## Tests

`listedFeeds.test.ts`:

- `findListedAddByRSSTrack` returns the record and the item with that idText, and null for an
  unknown idText. `isListedFeedRecord` is true for a listed record and false for a followed one.
- `assignListedLiveItemIdTexts` keeps an existing idText and adds one for a new guid. A live item
  with no item guid keys by `${idText}-${index}`.
- `listedAddByRSSLivestreamIndexItems` returns one item per live item with the stored idText and
  `channelIdText` the album's idText.
- `findListedAddByRSSLivestream` returns the record and the item, and null for an unknown idText.

`actions.publisherListedFeeds.test.ts`: extend plan 71's listed-album poll case so the stored
record's `liveItemIdTextsByGuid` has one entry per live item in the payload, and
`upsertAddByRSSFeed` is still not called for that album.

Page behavior is plan 78's spec `apps/web/e2e/add-by-rss-artist-albums.spec.ts`. This plan does
not create that file. Add these to that spec:

- `ALBUM_FEED` gains one `podcastLiveItems` entry in the shape
  `apps/web/e2e/media-list-chips.spec.ts` already stubs: `{ guid: 'e2e-rss-listed-live-1', title: 'Listed Live', status: 'live', start: '2025-07-02T15:00:00.000Z', enclosure: { url: 'http://localhost:2111/audio/audio-001.mp3', type: 'audio/mpeg', length: 0 } }`.
  Status `live` stays on the album page; `selectChannelOrderedLiveItems` only drops ended rows
  older than a day.
- On the listed album page, expect the text `Listed Live`.
- Open Settings (`?type=settings`). Expect a button named `Check Feed for Updates` and a heading
  `Feed Username and Password`.
- `page.goto('/add-by-rss?tab=livestreams')` and expect the text `Listed Live` to have count 0.
  The library Albums step already expects the album title to have count 0.
- Open the `Listed Live` link. Expect the URL to match `/\/add-by-rss\/music\/livestream\/[^/]+$/`
  and the heading `Listed Live`. Do not expect the not-found message.

## Release scratchpad

```markdown
## Follow an album from an Add by RSS artist's page

- Surfaces: web
- Change: albums that appear only under an Add by RSS artist open, play, and show their tracks
  and livestreams like any Add by RSS album. Settings on that album includes the username and
  password section. Subscribe on the album follows it and keeps the same page and track links.
  Until you follow, the album is not in your library lists, on Home, or in the livestream lists.
- Who notices: members who add music artist feeds by RSS
- Operator steps: none
```
