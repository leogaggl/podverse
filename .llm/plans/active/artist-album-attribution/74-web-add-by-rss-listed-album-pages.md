**Cursor model:** Opus 5.5 · **Reasoning:** high

# 74 — Web: open, play, and follow an album an Add by RSS artist lists

Albums parsed because the member added an Add by RSS artist live in the `listedFeeds` store
(plan 71). Their rows link to the existing Add by RSS album, track, and credentials pages, which
today read only followed feeds and show "not found". This plan lets those pages read a listed
album, keeps listed data out of the followed stores, and lets the member follow the album from its
page without losing its URL or tracks (R46).

## Rows

R8, R46, R54

## Runs after

71

## Files

apps/web/src/utils/addByRSS/listedFeeds.ts
apps/web/src/utils/addByRSS/listedFeeds.test.ts
apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx
apps/web/src/app/add-by-rss/album/AddByRSSAlbumPageClient.tsx
apps/web/src/components/AddByRSS/Artist/Album/AddByRSSAlbumHeader.tsx
apps/web/src/app/add-by-rss/track/AddByRSSTrackItemPageClient.tsx
apps/web/src/app/add-by-rss/credentials/AddByRSSCredentialsPageClient.tsx
release-notes/scratchpad.md

## Decisions this plan fixes

- **Following keeps the album's idText.** The Subscribe button on a listed album passes the
  listed record as `seedRecord` (plan 71), so `/add-by-rss/album/<id>` and its tracks keep working
  and nothing re-renders empty while the follow's parse runs.
- **A listed album's Settings tab offers Check for Updates only.** The per-feed credentials
  section and the remove action are follow actions; they appear once the member follows. A listed
  album that needs credentials is reached from the artist page's Needs Username and Password
  section, whose rows open the credentials page, which works for listed albums.
- **Listed albums have no livestream rows** until followed (the live index is built from followed
  feeds).

## `listedFeeds.ts`

Add:

```typescript
/** A listed album's track by its idText, built in memory. Null when no listed album has it. */
export const findListedAddByRSSTrack = async (
  itemIdText: string
): Promise<{ feed: AddByRSSListedFeedRecord; item: AddByRSSItemIndexItem } | null>;
```

Scan `getAllListedAddByRSSFeeds()`; the first record whose `itemIdTextsByGuid` has a value equal to
`itemIdText`; build its items with `listedAddByRSSTrackIndexItems` and return the one with that
idText.

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

- Index effect (`buildAddByRSSItemsIndex([localFeed])` … `setLiveItems(livestreams)`): when
  `followed` is false, do not touch either index. Instead
  `setItemIdTextMap(new Map(listedAddByRSSTrackIndexItems(localFeed).map((item) => [item.id, item.idText])))`
  and `setLiveItems([])`. `localFeed` needs the listed fields there: keep a
  `listedFeed: AddByRSSListedFeedRecord | null` state set from the prop when `followed` is false
  (narrow with a type guard `isListedFeedRecord(record): record is AddByRSSListedFeedRecord` that
  checks `'itemIdTextsByGuid' in record`; add the guard to `listedFeeds.ts` and export it).
- `handleParseStatus`: when `followed` is false, call `applyListedAddByRSSParseStatus` with
  `fallbackRecord: listedFeed` and `onUpdated` that sets both `listedFeed` and `localFeed`;
  otherwise unchanged.
- `handleRefreshFeed`: the post-poll re-read uses `getListedAddByRSSFeedByUrl` when `followed` is
  false.
- Settings tab: render `AddByRSSCredentialsSettingsSection` only when `followed` is true.
- Boosts `resolveItemIdTextByGuid`: when `followed` is false, resolve from
  `listedAddByRSSTrackIndexItems(listedFeed)` by `itemGuid` before the index lookups.

The existing followed path keeps calling `buildAddByRSSItemsIndex([localFeed])`; changing that is
outside this plan.

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

## `AddByRSSCredentialsPageClient.tsx`

- Load with `getAddByRSSAlbumSourceByIdText(idText)`; keep `followed` in state beside `feed`.
- In `handleSaveAndCheck`, the poll applies with `applyListedAddByRSSParseStatus` (and
  `fallbackRecord` the listed record) when `followed` is false; the resource-type fix-up writes
  with `upsertListedAddByRSSFeed` in that case. `saveAddByRSSCredentialsAndQueue` already parses
  without following, so it is unchanged.
- Hide the remove-feed control when `followed` is false (it unfollows a feed the member never
  followed).

Credentials saved here are stored for the album's own URL, so its next parse sends them to that
album's domain only.

## Must stay true

- No page writes a listed album into `feeds`, `items`, or `liveItems`, except following it through
  `seedRecord`.
- Followed albums, tracks, and credentials pages behave as before.
- No `as`, no `any`, strict equality.

## Tests

`listedFeeds.test.ts`: add `findListedAddByRSSTrack` returns the record and the item with that
idText, and null for an unknown idText; `isListedFeedRecord` true for a listed record and false
for a followed one.

Page behavior is covered by plan 78 (open a listed album, play its track, follow it).

## Release scratchpad

```markdown
## Follow an album from an Add by RSS artist's page

- Surfaces: web
- Change: albums that appear only under an Add by RSS artist open, play, and show their tracks
  like any Add by RSS album. Subscribe on the album follows it and keeps the same page and track
  links. Until you follow, the album is not in your library lists or on Home, and its settings
  offer Check for Updates only.
- Who notices: members who add music artist feeds by RSS
- Operator steps: none
```
