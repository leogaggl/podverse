**Cursor model:** Opus 5.5 · **Reasoning:** high

# 84 — Mobile Add by RSS artist screen: Albums and Tracks

An Add by RSS artist feed opens on `AddByRssHomeDetailScreen`, which today offers Tracks and
About for any music feed. An artist gets an Albums tab first: the albums it lists, Add by RSS and
directory, then Add by RSS albums on the device that name it. Its Tracks tab gathers the tracks
of those Add by RSS albums plus the single tracks it references. Everything reads the device
(plans 80–82); nothing is fetched to draw the screen.

## Rows

R8, R19, R42, R43, R44, R45, R46, R54

## Runs after

80, 81, 82, 83

Plan 83 edits the same screen (`AddByRssHomeDetailScreen.tsx`) and repository.

## Files

apps/mobile/src/prefs/detailListPrefs.ts
apps/mobile/src/screens/home/addByRss/addByRssDetailSections.ts
apps/mobile/src/screens/home/addByRss/addByRssDetailSections.test.ts
apps/mobile/src/screens/home/addByRss/addByRssArtistAlbums.ts
apps/mobile/src/screens/home/addByRss/addByRssArtistAlbums.test.ts
apps/mobile/src/screens/home/addByRss/useAddByRssArtistAlbums.ts
apps/mobile/src/screens/home/addByRss/AddByRssArtistAlbumsSection.tsx
apps/mobile/src/screens/home/addByRss/AddByRssArtistTracksSection.tsx
apps/mobile/src/screens/home/addByRss/AddByRssEpisodesSection.tsx
apps/mobile/src/screens/home/addByRss/AddByRssDownloadedSection.tsx
apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx
apps/mobile/src/components/content/AlbumListRow.tsx
apps/mobile/src/components/content/index.ts
apps/mobile/src/data/repositories/addByRssRepository.ts
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Reuses

- `PodcastSectionList` for both panes, as `AddByRssEpisodesSection` uses it.
- `useAddByRssEpisodeRowRenderer` for track rows (widened below), so play, queue, add to playlist,
  mark as played, and Go to Track behave as on an album.
- `buildAddByRssHomeDetailData(feed, mappedFeed)` and `sortAddByRssHomeEpisodes` for track rows.
  A row's `subtitle` is already its album title, and its `id` is prefixed by the album's `idText`,
  so rows from several albums never collide.
- `AddByRssNeedsCredentialsSection` (`components/content/AddByRssNeedsCredentialsSection.tsx`) and
  `partitionAddByRssFeedsByCredentials` with `addByRssCredentialStore.listFeedUrlsForCurrentAccount()`,
  as `useAddByRssFeeds` partitions the library (R54).
- `useAddByRssArtistIndexVersion` (plan 81) to reload when relations change.
- `CoverImage`, `ListRow`, `LIST_ROW_ARTWORK_SIZE`, `createContentListRowStyles`, and
  `useAddByRssArtworkHeaders(feedUrl | null, uri)` for album rows.
- `buildAlbumDetailParams` and `CHANNEL_BROWSE_STACK_ROUTES.AlbumDetail` from `navigation` for
  directory albums, opened on the current stack.
- Catalog keys `media.music.albums`, `media.music.no_albums_found`, `media.music.no_tracks_found`,
  `features.add_by_rss.status_processing`. No new keys.

## Decisions this plan fixes

- **Albums, in order:** (1) channel-level listings in the artist's order: a `directory` row whose
  `mediumId` is null or an album medium (once per `channelIdText`), or an `add_by_rss` row whose
  album is stored (by canonical URL, else by guid); (2) Add by RSS albums on the device whose
  publisher pointers name the artist's guid and that (1) did not include, by title. Each album
  once; never the artist itself. `unresolved` rows and albums not stored yet are not shown.
- **Albums that need a username and password** (R54) leave the list and show above it, under the
  filter, with the existing Needs Username and Password heading; tapping one opens
  `AddByRssCredentials`. Above, not below: `PodcastSectionList` has no footer slot, and the
  member has to act on these.
- **Tracks:** the artist's own items first, then each Add by RSS album in Albums order with all
  its tracks, then the tracks item-level listings reference in albums stored on the device that
  are not already included (R19). Tracks of directory albums are not listed; their album row
  opens the directory album (web plan 72 makes the same call).
- **Sort** reuses the track sort chip: Forward keeps that order; Backward reverses it.
- **A pending album** (listed, parse not stored yet) adds a processing notice instead of a row.

## Repository (`addByRssRepository.ts`)

```typescript
export type AddByRssFeedWithRefs = {
  feed: MobileAddByRSSFeedRecord;
  podcastGuid: string | null;
  publisherGuids: string[];
};

/** Every stored Add by RSS row (followed or listed-only) with its guid columns. No bundles. */
listFeedsWithRefs: async (): Promise<AddByRssFeedWithRefs[]> => …,
```

## `addByRssArtistAlbums.ts` (new, pure)

```typescript
export type AddByRssArtistAlbumEntry =
  | { kind: 'add-by-rss'; feed: MobileAddByRSSFeedRecord }
  | { kind: 'directory'; channelIdText: string; title: string; imageUrl: string | null };

export type AddByRssArtistTrackSource = {
  feed: MobileAddByRSSFeedRecord;
  /** Null: every track. Otherwise only items with these guids. */
  itemGuids: ReadonlySet<string> | null;
};

export const buildAddByRssArtistAlbums = (input: {
  artist: AddByRssFeedWithRefs;
  listings: readonly AddByRssListedFeedRecord[];
  feeds: readonly AddByRssFeedWithRefs[];
}): { albums: AddByRssArtistAlbumEntry[]; hasPending: boolean } => …;

export const buildAddByRssArtistTrackSources = (input: {
  artist: AddByRssFeedWithRefs;
  albums: readonly AddByRssArtistAlbumEntry[];
  listings: readonly AddByRssListedFeedRecord[];
  feeds: readonly AddByRssFeedWithRefs[];
}): AddByRssArtistTrackSource[] => …;
```

- Directory title: `channelTitle ?? title ?? channelIdText`. Image: the row's `imageUrl`.
- "Stored album" lookup: canonical URL (`canonicalAddByRSSFeedUrl(url) ?? url.trim()`), else
  `podcastGuid === listing.feedGuid`. An `add_by_rss` row with `pendingRequestId` and no stored
  album sets `hasPending`.
- Named albums: `resourceType === 'albums'` and `publisherGuids` includes the artist's
  `podcastGuid` (non-null).
- Track sources: the artist itself (`itemGuids: null`), then every `add-by-rss` album entry
  (`null`), then each `!listedAtChannelLevel` listing with item guids whose stored album is not
  already a `null` source, merged per album into one guid set.

## Data hook (`useAddByRssArtistAlbums.ts`, new)

`useAddByRssArtistAlbums(artistFeedUrl: string)` returns
`{ albums, needsCredentials, trackDetails, hasPending, isLoading, reload }`:

- Loads `listListedFeeds(artistFeedUrl)` and `listFeedsWithRefs()`; finds the artist entry;
  builds albums. Splits `add-by-rss` entries with `partitionAddByRssFeedsByCredentials` into
  shown entries and `needsCredentials` items.
- `trackDetails`: for each track source, `getMappedFeedByUrl`; skip null; build
  `buildAddByRssHomeDetailData(feed, mappedFeed)` and keep only `episodeRows` whose
  `itemBundle.item.guid` is in `itemGuids` when it is a set.
- Reloads when `useAddByRssArtistIndexVersion()` changes and when `reload` is called (pull to
  refresh). Load the bundles only when the Tracks pane is mounted: the hook takes
  `{ includeTracks: boolean }`.

## Shared row (`components/content/AlbumListRow.tsx`, new)

```typescript
type AlbumListRowProps = {
  /** Add by RSS albums pass their feed URL so artwork can carry the feed's credentials. */
  addByRssFeedUrl: string | null;
  imageUrl: string | null;
  onPress: () => void;
  subtitle?: string;
  testID: string;
  title: string;
};
export const AlbumListRow = memo(function AlbumListRow(props: AlbumListRowProps) { … });
```

`ListRow` with a `CoverImage` leading (`decodeEdge={LIST_ROW_ARTWORK_SIZE}`, `opensViewer={false}`,
`headers` from `useAddByRssArtworkHeaders(addByRssFeedUrl, imageUrl)`, `addByRssFeedUrl` when
non-null), inside the `createContentListRowStyles` row view, the way `ArtistAddedAlbumRow` in
`ArtistDetailScreen.tsx` draws it. Export from `components/content/index.ts`. Leave the rows in
`ArtistDetailScreen.tsx` as they are.

## Panes

- `AddByRssArtistAlbumsSection` (`AddByRssSectionPaneProps`): `PodcastSectionList` with the album
  entries filtered by `matchesTitleFilter(filterTerm)`, `emptyMessageKey="media.music.no_albums_found"`,
  `noticeKey` = `features.add_by_rss.status_processing` when `hasPending`, else `refreshNoticeKey`,
  rows `AlbumListRow` with `testID={\`add-by-rss-artist-album-row-${index}\`}`. `listHeader` is
  the filter (`listHeader` prop) followed, when `needsCredentials` is non-empty, by
  `AddByRssNeedsCredentialsSection` (`testIDPrefix="add-by-rss-artist"`, `showDivider={false}`).
  Pull to refresh calls `onRefresh` then `reload`.
  - `add-by-rss` row: `navigation.navigate('AddByRssPodcastDetail', { feedIdText: feed.idText })`.
  - `directory` row: `navigation.navigate(CHANNEL_BROWSE_STACK_ROUTES.AlbumDetail, buildAlbumDetailParams({ albumId: channelIdText, previewTitle: title, previewImageUrl: imageUrl }))`.
    Type the navigation prop as
    `NativeStackNavigationProp<AddByRssDetailStackParamList & ChannelBrowseStackParamList>`.
  - Credentials row: `navigation.navigate('AddByRssCredentials', { feedIdText: feed.idText })`.
- `AddByRssArtistTracksSection`: `trackDetails` rows concatenated in source order, filtered by
  title, reversed when `sort === 'backward'`; `useAddByRssEpisodeRowRenderer({ details: trackDetails, isMusicFeed: true, visitLastSeenAtMs })`;
  `emptyMessageKey="media.music.no_tracks_found"`; `testID="add-by-rss-artist-track-list"`.

## Renderer widening (`AddByRssEpisodesSection.tsx`)

`useAddByRssEpisodeRowRenderer` takes `details: readonly AddByRssHomeDetailData[]` instead of
`detail`. `rowsById` maps each row id to `{ detail, episode }` across all details; `toTarget`,
`handleOpen`, `handleGoToTrack`, and `handlePlay` use the row's own `detail` (feed, mapped feed,
`idText`). `AddByRssEpisodesSection` and `AddByRssDownloadedSection` pass `[detail]`. No other
behavior changes.

## Sections (`addByRssDetailSections.ts`, `detailListPrefs.ts`)

- `ADD_BY_RSS_DETAIL_TABS` gains `'albums'` (first). `ADD_BY_RSS_SECTION_LABEL_KEYS.albums = 'media.music.albums'`.
- `resolveAddByRssSections` takes `isArtistFeed`; an artist gets `['albums', 'tracks', 'about']`
  then funding and people as today.
- `resolveAddByRssInitialSection` takes `isArtistFeed`; an artist starts on `'albums'`, offline
  or not.
- `isAddByRssFilterableSection` includes `'albums'`; `isAddByRssSortableSection` does not.
- Update the two doc comments to describe artists.

## Screen (`AddByRssHomeDetailScreen.tsx`)

- `const isArtistFeed = detailForRoute?.feed.resourceType === 'artists';` Pass it to
  `resolveAddByRssSections` (near line 284) and `resolveAddByRssInitialSection` (the section init
  effect near lines 220–253).
- `SECTION_COMPONENTS` (line 82) gains `albums: AddByRssArtistAlbumsSection`. Where the pane is
  chosen (near lines 524–544), use `AddByRssArtistTracksSection` when `isArtistFeed && section === 'tracks'`.

## Must stay true

- Podcast, album, and track feeds show exactly today's tabs and rows.
- A listed-only album never appears on Home or in the library from this screen's reads.
- The screen works offline from what is stored.

## Tests

- `addByRssArtistAlbums.test.ts`: listing order with a directory and an Add by RSS album;
  directory podcast-medium row skipped; album found by guid under another URL; named-not-listed
  album appended by title; two artists listing one album each show it (R44); pending row sets
  `hasPending` without a row; track sources with an item-level reference into an album already
  listed at channel level add nothing, and into another stored album give exactly those guids;
  a reference into a directory album adds nothing.
- `addByRssDetailSections.test.ts` (exists): artist sections and initial section; podcast and
  album unchanged.
- Add `addByRssArtistAlbums.test.ts` to `include` in `apps/mobile/vitest.config.ts`.

## Release scratchpad

```markdown
## Mobile Add by RSS artist pages list their albums and tracks

- Surfaces: mobile
- Change: an Add by RSS artist feed opens on a new Albums tab: the albums the artist lists
  (directory albums open their directory page; Add by RSS albums open on the device), then Add by
  RSS albums on the device that name the artist. Albums that need their own username and password
  show at the end under Needs Username and Password. The Tracks tab lists the tracks of those Add
  by RSS albums and any single tracks the artist references. Albums still being fetched show a
  processing notice.
- Who notices: members with Add by RSS artist feeds
- Operator steps: none
```
