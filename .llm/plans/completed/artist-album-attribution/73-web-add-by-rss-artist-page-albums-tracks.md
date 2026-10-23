**Cursor model:** Opus 5.5 · **Reasoning:** high

# 73 — Web: Add by RSS artist page Albums and Tracks by guid

The Add by RSS artist page (`/add-by-rss/artist/[id]`) matches albums today by comparing author
and title text among followed album feeds, and it rebuilds the global items index from only those
albums, which empties the library Tracks list until the next rebuild. This plan replaces both:

- **Albums tab:** albums the artist lists at channel level, in feed order (directory albums link
  to `/album/[id]`, R43; Add by RSS albums link to `/add-by-rss/album/[id]` whether followed or
  only listed, R46), plus Add by RSS albums on this browser that name the artist's guid (plan 72's
  rule). An album two artists list shows under both (R44).
- **Needs Username and Password:** listed albums the artist's credentials could not open (another
  domain, or the album rejected them) appear in the existing section, above the album list (R54).
- **Tracks tab:** every track on those Add by RSS albums, plus the tracks the artist credits
  item-level when that album is on this browser (R19).
- **Freshness:** the page re-parses the artist with no cache hints when its stored list is
  missing or older than 24 hours, and resumes polls of listed albums still parsing.

The library Albums list, Home, and the items index never show listed albums.

## Rows

R8, R19, R42, R43, R44, R45, R46, R54

## Runs after

71, 72

## Files

apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageClient.tsx
apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageList.tsx
apps/web/src/components/AddByRSS/List/AddByRSSNeedsCredentialsSection.tsx
apps/web/src/app/add-by-rss/artist/addByRSSArtistAlbumListItems.ts
apps/web/src/app/add-by-rss/artist/addByRSSArtistAlbumListItems.test.ts
apps/web/src/utils/addByRSS/albumTracks.ts
apps/web/src/utils/addByRSS/albumTracks.test.ts
release-notes/scratchpad.md

## Reuses

- `resolveAddByRSSArtistAlbums`, `resolveAddByRSSArtistTrackRefs`, `mergeAddByRSSAlbumSources`
  (plan 72) for every match. Delete `normalizeKey`, `getArtistMatchKey`, and `matchesArtist`.
- `CommonAlbumListNodes` (`apps/web/src/components/Common/Artist/Album/CommonAlbumNodes.tsx`) for
  album rows and grid, fed `AlbumListItem`s. `albumListItemFromAddByRSSFeed`
  (`apps/web/src/utils/subscribed/channelListItems.ts`) for Add by RSS albums.
- `buildAlbumPath` from `@podverse/helpers` for directory rows, and
  `buildDTOChannelImageLoadCandidates(channel.channel_images, IMAGES.LIST.PODCASTS.SIZE_FIND_TARGET, 'lesser')`
  the way `ListAlbumRow.tsx` builds album artwork.
- `AddByRSSNeedsCredentialsSection` and `getListedAddByRSSCredentialsNeed` (plan 72) with
  `listFeedsWithCredentials` for the needs-credentials rows.
- `AddByRSSTrackNodes` for tracks, unchanged.
- `toAddByRSSItemIndexItem`, `listedAddByRSSTrackIndexItems`, `refreshAddByRSSPublisherLinks`,
  `resumeListedAddByRSSPolls`, `addByRSSPublisherLinksNeedRefresh` (plan 71).
- `useAddByRSSFeedChanged` / `onAddByRSSFeedChanged` to reload when a listed album finishes.

## `utils/addByRSS/albumTracks.ts` (new)

```typescript
/**
 * Track rows for Add by RSS albums. Followed albums use the items index idTexts (building the
 * index from every followed feed when one is missing); listed albums use their stored idTexts
 * and never enter the index.
 */
export const loadAddByRSSAlbumTrackIndexItems = async (
  refs: readonly AddByRSSArtistTrackRef[]
): Promise<AddByRSSItemIndexItem[]>;
```

1. `map = await buildItemIdTextMap()`. When any followed ref has an item whose
   `${feed.idText}-${getAddByRSSItemGuidKey(feed, bundle, index)}` is not in `map`, run
   `await buildAddByRSSItemsIndex(await getAllAddByRSSFeeds())` once, then rebuild `map`. Always
   pass every followed feed, never a subset: a subset empties the index for the rest.
2. Followed: `toAddByRSSItemIndexItem(feed, bundle, index, map.get(compositeId))`. Listed:
   `listedAddByRSSTrackIndexItems(feed)`.
3. Keep an item when the ref's `itemGuids` is null or contains `item.itemGuid.trim()`.
4. Return in ref order; the page sorts.

## `app/add-by-rss/artist/addByRSSArtistAlbumListItems.ts` (new)

Pure mapping from plan 72's entries to rows:

```typescript
export type DirectoryAlbumChannels = ReadonlyMap<string, DTOChannel>;

export const toAddByRSSArtistAlbumListItems = (input: {
  entries: readonly AddByRSSArtistAlbumEntry[];
  directoryChannels: DirectoryAlbumChannels;
  /** Hidden from the list because they sit in the needs-credentials section. */
  needsCredentialsIdTexts: ReadonlySet<string>;
  statusLabel: (status: AddByRSSParseStatus) => string;
  imageSize: number;
}): AlbumListItem[];
```

- `add_by_rss`: skip when `needsCredentialsIdTexts` has the feed's idText. Otherwise
  `albumListItemFromAddByRSSFeed(source.feed)`; when the feed has no `mappedFeed` and a status,
  set `subtitle` to `statusLabel(status)` (parsing or failed albums still show their title).
- `directory`: `{ id: \`directory-${channelIdText}\`, title: channel?.title ?? entry.title, href: buildAlbumPath(channelIdText), imageCandidates: channel ? buildDTOChannelImageLoadCandidates(channel.channel_images, imageSize, 'lesser') : undefined, subtitle: channel?.channel_about?.author ?? null }`
  where `channel = directoryChannels.get(channelIdText)`.

## `AddByRSSArtistPageClient.tsx`

State: replace `albumFeeds: AddByRSSFeedRecord[]` with
`albumEntries: AddByRSSArtistAlbumEntry[]`, add `link: AddByRSSPublisherLinkRecord | null`,
`directoryChannels: Map<string, DTOChannel>`, `needsCredentials: AddByRSSNeedsCredentialsFeed[]`.
Keep `trackItems` and `liveItems`.

Replace the `loadRelated` effect body (from `const albums = await getAddByRSSFeedsByResourceType('albums')`
through `setLiveItems(livestreams)`):

1. Read in parallel: `getAllAddByRSSFeeds()`, `getAllListedAddByRSSFeeds()`,
   `getAddByRSSPublisherLink(toAddByRSSComparableFeedUrl(feed.feedUrl))`, and (when logged in)
   `listFeedsWithCredentials(accountId)` as a comparable-URL set.
2. `sources = mergeAddByRSSAlbumSources(followed, listed)`;
   `entries = resolveAddByRSSArtistAlbums({ artist: feed, link, sources })`.
3. Needs credentials: listed sources among the entries whose
   `getListedAddByRSSCredentialsNeed(feed, hasCredentials)` is non-null →
   `{ feed, need }` (the section's `AddByRSSNeedsCredentialsFeed` shape). Followed albums keep
   their own section on the library page; do not repeat them here.
4. `refs = resolveAddByRSSArtistTrackRefs({ link, albums: entries, sources })`, dropping refs
   whose feed is in the needs-credentials list; `setTrackItems(await loadAddByRSSAlbumTrackIndexItems(refs))`.
5. Livestreams: `const live = await buildAddByRSSLivestreamIndex(followed)` (all followed feeds,
   never a subset), then keep items whose `channelIdText` is a followed album entry's idText.
   Listed albums show tracks only until followed.
6. Guard every `set…` with the existing `cancelled` flag.

Reload triggers: the effect depends on `feed` and a `reloadKey` counter. Bump `reloadKey` from
`onAddByRSSFeedChanged` when the changed URL is the artist's URL or a URL in the current entries
or listed records (compare comparable URLs). Debounce bumps with a 300 ms timer so a burst of
album polls reloads once.

Directory artwork: a separate effect on the set of directory `channelIdText`s (sorted, joined as
the dependency key). Fetch each one not yet in `directoryChannels` with
`getApiRequestService().reqChannelGetByIdOrIdText(id)`, five at a time; store successes; ignore
failures after `console.error` (the row keeps its title from the list).

Freshness, once per mount after `feed` loads and the account is known: when
`addByRSSPublisherLinksNeedRefresh(link, Date.now())`, `void refreshAddByRSSPublisherLinks({ accountId, publisher: feed })`.
Otherwise `void resumeListedAddByRSSPolls(listed records in the entries)`. Use a ref so it runs
once per artist idText.

Sorting: `sortedAlbums` becomes `sortedAlbumItems` over `toAddByRSSArtistAlbumListItems(…)`.
Keep the recent / oldest dropdown: sort entries before mapping, using
`getFeedLastPubDateMs(source.feed)` for Add by RSS rows and the directory channel's
`channel_about?.last_pub_date` (via `Date.parse`, 0 when absent or invalid) for directory rows;
ties by title.
`statusLabel` maps each `AddByRSSParseStatus` to the existing `features.add_by_rss.status_queued`,
`status_processing`, `status_parsed`, `status_not_modified`, and `status_failed` keys with a
`switch` and literal keys (no template-literal key), so the catalog types still check.
`imageSize` is `IMAGES.LIST.PODCASTS.SIZE_FIND_TARGET`.

`hasAlbums` is `sortedAlbumItems.length > 0 || needsCredentials.length > 0`. Keep the tab
fallback effect as it is.

Remove the now-unused imports (`getAddByRSSFeedsByResourceType`, `buildAddByRSSItemsIndex`,
`isAlbumMediumId`, `parseMediumId`, `createAddByRSSIdText`, and any other the old body used).
The boosts `resolveItemIdTextByGuid` stays.

## `AddByRSSNeedsCredentialsSection.tsx`

Doc comment only: replace "Followed feeds this browser cannot read yet." with "Feeds this
browser cannot read yet: followed feeds, or albums an Add by RSS artist lists." The rest of the
sentence stays. The component and its type (`AddByRSSNeedsCredentialsFeed` from
`credentialsStatus.ts`, `{ feed, need }`) are unchanged.

## `AddByRSSArtistPageList.tsx`

- Props: replace `albumFeeds: AddByRSSFeedRecord[]` with `albumItems: AlbumListItem[]` and add
  `needsCredentials: AddByRSSNeedsCredentialsFeed[]`.
- Albums branch: `<AddByRSSNeedsCredentialsSection feeds={needsCredentials} />` then
  `<CommonAlbumListNodes items={albumItems} viewSelected={viewSelected} />`. Drop the
  `AddByRSSAlbumNodes` import if nothing else here uses it (the component stays in the repo).

## Must stay true

- The page never calls `buildAddByRSSItemsIndex` or `buildAddByRSSLivestreamIndex` with a subset
  of followed feeds.
- Listed albums never appear in the library lists (`/add-by-rss` chips), on Home, or in the items
  index.
- A directory album row never links to an Add by RSS route, and an Add by RSS row never links to
  a directory route.
- Opening the page while logged out shows today's not-found state; nothing is fetched.
- Area J edits `AddByRSSArtistHeader.tsx` for the unsubscribe prompt; this plan does not touch it.

## Tests

`albumTracks.test.ts` (new; mock `./storage` and `./itemIndex` partially with `vi.hoisted` fns,
keeping `toAddByRSSItemIndexItem` real via `importOriginal`):

- A followed album whose items are all in the map does not rebuild the index.
- A followed album with a missing item rebuilds once, with every followed feed.
- A listed album returns its stored idTexts and never calls the index builder.
- A ref with `itemGuids` returns only those tracks.

`addByRSSArtistAlbumListItems.test.ts` (new):

- A directory entry without a loaded channel has its list title and `/album/<id>` href; with a
  channel it has the channel title and artwork.
- An Add by RSS entry links to `/add-by-rss/album/<idText>`; a queued one with no mapped feed has
  the status label as subtitle.
- An entry in `needsCredentialsIdTexts` is left out.

Playwright coverage is in plan 78.

## Release scratchpad

```markdown
## Add by RSS artists list their albums, including ones you have not followed

- Surfaces: web
- Change: adding an Add by RSS artist now brings in every album its feed lists. Albums already in
  the Podverse directory link to the directory album. The others are parsed for you and shown
  only on that artist's page until you follow one. Albums that name the artist's guid show there
  too, an album two artists list shows under both, and tracks the artist credits one by one show
  in Tracks once their album is on this browser. Albums on another site that need a username and
  password appear under Needs Username and Password on the artist page. Matching is by feed guid
  on this browser; nothing is shared with other members.
- Who notices: members who add music artist feeds by RSS
- Operator steps: none
```
