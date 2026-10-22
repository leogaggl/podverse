**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 85 — Mobile directory artist page: Your Add by RSS Albums and their tracks

Plan 40 mounted two empty slots on `ArtistDetailScreen`: Your Add by RSS Albums (after Verified
Albums) and Add by RSS tracks (after the verified tracks). This plan fills them with the Add by
RSS albums on this device whose `podcast:publisher` resolved to this directory artist (R47), and
their tracks (R49), each row with an Add by RSS marker. Everything is device-only. The rows open
Add by RSS screens, which today exist only on the Home and Library stacks; the artist page also
mounts on Browse and Search, so this plan registers those screens there too.

## Rows

R8, R40, R47, R49

## Runs after

40, 80, 81, 82, 84

## Files

apps/mobile/src/screens/artist/ArtistYourAddByRssAlbumsSection.tsx
apps/mobile/src/screens/artist/ArtistYourAddByRssTracksSection.tsx
apps/mobile/src/screens/artist/useArtistYourAddByRssTrackDetails.ts
apps/mobile/src/components/content/AddByRssRowMarker.tsx
apps/mobile/src/components/content/AlbumListRow.tsx
apps/mobile/src/components/content/index.ts
apps/mobile/src/screens/home/addByRss/AddByRssEpisodesSection.tsx
apps/mobile/src/navigation/index.tsx
apps/mobile/src/screens/home/addByRss/addByRssStackParams.ts
.cursor/rules/mobile-tab-stack-isolation.mdc
release-notes/scratchpad.md

## Reuses

- `addByRssAlbumsNamingDirectoryArtist(artistIdText)` and `useAddByRssArtistIndexVersion`
  (plan 81). Synchronous, so the albums hook answers `isEmpty` on first render.
- `AlbumListRow` (plan 84) for album rows.
- `useAddByRssEpisodeRowRenderer({ details, isMusicFeed: true, visitLastSeenAtMs: undefined })`
  (widened in plan 84) and `buildAddByRssHomeDetailData` for track rows, so play, queue, add to
  playlist, and Go to Track work as on the album.
- `addByRssRepository.getFeedByUrl` and `getMappedFeedByUrl`.
- `SectionHeading`, `useTheme` tokens, catalog keys `media.music.your_add_by_rss_albums` (plan 40)
  and `features.add_by_rss.label` ("Add by RSS"). No new keys.
- `Ionicons` from `@expo/vector-icons`, as `FullPlayerUtilityRow.tsx` uses it.

## Decisions this plan fixes

- **The marker** matches web plan 75: an RSS glyph (`Ionicons` `logo-rss`) whose accessible name
  is "Add by RSS", in each row's `trailing` slot. Mobile has no marker today; this adds one used
  only by these two sections.
- **Tracks order:** albums in the albums section's order, each album's tracks in feed order.
  Directory tracks come first (plan 40), so these follow them.
- **Register, do not jump tabs.** The five Add by RSS detail screens join the Browse and Search
  stacks, so a row opened from the artist page stays on the tab it was opened from
  (**mobile-tab-stack-isolation**).

## Marker (`components/content/AddByRssRowMarker.tsx`, new)

```typescript
type AddByRssRowMarkerProps = { testID: string };

/** Marks a row as one of the member's Add by RSS feeds, on screens that mix it with directory rows. */
export const AddByRssRowMarker = memo(function AddByRssRowMarker({ testID }: AddByRssRowMarkerProps) { … });
```

A `View` with `accessible`, `accessibilityRole="image"`, `accessibilityLabel={t('features.add_by_rss.label')}`,
and `testID`, wrapping `<Ionicons name="logo-rss" size={16} color={…} />` in the secondary text
color `HomeFeedRow` uses for its subtitle. Export from `components/content/index.ts`.

## Albums slot (`ArtistYourAddByRssAlbumsSection.tsx`)

Keep the exports and signatures plan 40 set. Replace the stub bodies:

```typescript
export function useArtistYourAddByRssAlbums(artistId: string): { isEmpty: boolean; albums: AddByRssArtistIndexFeed[] } {
  const version = useAddByRssArtistIndexVersion();
  const albums = useMemo(() => addByRssAlbumsNamingDirectoryArtist(artistId), [artistId, version]);
  return { albums, isEmpty: albums.length === 0 };
}
```

`ArtistYourAddByRssAlbumsSection({ artistId })`: call the hook; return `null` when empty.
Otherwise a `View` with a `SectionHeading` (`t(ARTIST_YOUR_ADD_BY_RSS_ALBUMS_LABEL_KEY)`,
`testID="artist-albums-your-add-by-rss-heading"`, `marginTop: tokens.spacing.lg`) and one
`AlbumListRow` per album. The index carries no artwork, so a `useEffect` keyed on the joined
album URLs reads the records
(`Promise.all(albums.map((album) => addByRssRepository.getFeedByUrl(album.feedUrl)))`) and each
row uses its record's `imageUrl` (`null` until loaded). `title` is the index title,
`addByRssFeedUrl` is the album URL,
`testID={\`artist-album-add-by-rss-row-${index}\`}`, `trailing` marker
`testID={\`artist-album-add-by-rss-marker-${index}\`}` (add an optional `trailing` prop to
`AlbumListRow` that it passes to `ListRow`). Press:
`navigation.navigate('AddByRssPodcastDetail', { feedIdText: album.feedIdText })` with the
navigation prop typed `NativeStackNavigationProp<AddByRssDetailStackParamList>`.

Update the file comment to describe the section as it now is (device-only albums naming this
artist; renders nothing when there are none).

## Tracks slot

`useArtistYourAddByRssTrackDetails(artistId)` (new file, `screens/artist/`): uses
`useArtistYourAddByRssAlbums(artistId).albums`; loads, for each album in order,
`getFeedByUrl` and `getMappedFeedByUrl`, skipping either null; returns
`{ details: AddByRssHomeDetailData[] }` built with `buildAddByRssHomeDetailData`. Reload when the
album URL list changes.

`ArtistYourAddByRssTracksSection.tsx`:

- `useArtistYourAddByRssTracks(artistId)` returns `{ isEmpty }`: true until the details load and
  while every detail has no `episodeRows`. It calls `useArtistYourAddByRssTrackDetails`. Plan 40's
  contract holds: `isEmpty` is true exactly when the component renders nothing, so the component
  calls the same hook and returns null on the same condition.
- The component renders every detail's `episodeRows` in order through
  `useAddByRssEpisodeRowRenderer(...).renderRow`, inside a plain `View` (it sits inside the
  screen's list, so no nested list). Pass each row's `trailing` marker
  (`testID={\`artist-track-add-by-rss-marker-${index}\`}`): add an optional
  `trailing?: (index: number) => ReactNode` input to `useAddByRssEpisodeRowRenderer` that
  `AddByRssEpisodeRow` forwards to `HomeFeedRow`'s `trailing`. Render `addToPlaylistSheet` and a
  notice line for `noticeKey` the way `AddByRssEpisodesSection` does.

## Navigation (`navigation/index.tsx`)

- `SEARCH_STACK_ROUTES` and `BROWSE_STACK_ROUTES` (lines 184 and 215) gain `AddByRssCredentials`,
  `AddByRssEpisodeDetail`, `AddByRssLivestreamDetail`, `AddByRssPodcastDetail`,
  `AddByRssTrackDetail` with the same string values `LIBRARY_STACK_ROUTES` uses.
- `SearchStackParamList` and `BrowseStackParamList` (near lines 500 and 535) add
  `& AddByRssDetailStackParamList`.
- `searchTabLinkScreens` and `browseTabLinkScreens` (near lines 375 and 359) gain the five paths
  `libraryTabLinkScreens` uses, with `search/` or `browse/` in place of `my-library/`
  (for example `AddByRssPodcastDetail: 'browse/add-by-rss/:feedIdText'`).
- In `SearchStackNavigator` (line 1077) and `BrowseStackNavigator` (line 1257), after the
  `AlbumDetail` screen, register the five screens with the same components and `options` titles as
  the Library block (lines 1153–1176), using each stack's route constant.

`addByRssStackParams.ts`: update its doc comment to say these screens are registered on the
Home, Library, Browse, and Search stacks.

## Guidance (`.cursor/rules/mobile-tab-stack-isolation.mdc`)

In **Add-by-RSS surface ownership**, add one bullet: the Add by RSS detail and credentials screens
are also registered on Browse and Search, because a directory artist page there lists the
member's Add by RSS albums; a row opened there pushes on that tab's stack.

## Must stay true

- With no Add by RSS album naming the artist, the page is exactly plan 40's (both hooks empty).
- Offline, the slots still render from the device.
- No request reaches the server for these sections.

## Tests

No new unit test: the selection is `addByRssAlbumsNamingDirectoryArtist`, covered in plan 81.
Plan 88 cannot reach this section (the E2E fixture album names an Add by RSS artist, not a
directory one); the operator checks it by hand with a feed that names a directory artist.

## Release scratchpad

```markdown
## Mobile directory artist pages show your Add by RSS albums

- Surfaces: mobile
- Change: a directory artist page lists, under Your Add by RSS Albums, the Add by RSS albums on
  this device whose publisher pointer names that artist, and adds their tracks after the verified
  tracks. Rows carry an RSS marker read as "Add by RSS". Only this device sees them. Add by RSS
  pages opened from Browse or Search now stay on that tab.
- Who notices: members with Add by RSS albums by directory artists
- Operator steps: none
```
