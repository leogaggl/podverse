**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 75 — Web: Your Add by RSS Albums and tracks on a directory artist page

A directory artist page (`/artist/[channel_id]`) shows, to the signed-in member on this browser
only, the Add by RSS albums whose `podcast:publisher` names the artist's guid, and their tracks
(R47). Rows carry an Add by RSS marker (R48). Nothing reaches server HTML or other members (R49).
Plan 30 already mounted three stub exports; this plan fills them and adds the marker.

## Rows

R47, R48, R49

## Runs after

30, 72, 73, 74

## Files

apps/web/src/app/artist/[channel_id]/ArtistPageAddByRssSections.tsx
apps/web/src/utils/addByRSS/artistPageAddByRss.ts
apps/web/src/utils/addByRSS/artistPageAddByRss.test.ts
apps/web/src/components/AddByRSS/AddByRSSRowMarker.tsx
apps/web/src/styles/components/AddByRSS/AddByRSSRowMarker.module.scss
apps/web/src/components/Common/Artist/Album/types.ts
apps/web/src/components/Common/Artist/Album/CommonAlbumRow.tsx
apps/web/src/components/Common/Artist/Album/CommonAlbumGridNode.tsx
apps/web/src/components/Common/Artist/Album/Track/CommonTrackRow.tsx
apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackRow.tsx
apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackNodes.tsx
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
release-notes/scratchpad.md

## Decisions this plan fixes

- **Which albums.** Add by RSS albums on this browser, followed or listed under a followed Add by
  RSS artist, whose `podcast:publisher` guid equals `channel.podcast_guid`
  (`addByRSSAlbumsNamingPublisher`, plan 72). Listing alone does not count here: a directory
  artist's own listing is directory data, already shown in Verified Albums and Not Yet Added.
- **Which tracks.** Every track on those albums. Item-level references by a directory artist to
  an Add by RSS album are not on the directory artist page (the request's directory-side rows do
  not cover them).
- **The marker.** The repo has no Add by RSS row marker, though plan 30's prose mentions one.
  This plan adds it: the `FaRss` icon (already used for Add by RSS in the web app) in a
  `role="img"` span whose accessible name is the existing `features.add_by_rss.label`
  ("Add by RSS"). It sits after the row title, on these two sections only.
- **One read per page.** The albums section, the tracks section, and the chip hook share one
  module-level promise per `podcast_guid`, cleared on any Add by RSS feed change.

## `utils/addByRSS/artistPageAddByRss.ts` (new)

```typescript
export type ArtistPageAddByRssData = {
  albums: AddByRSSAlbumSource[];
  tracks: AddByRSSItemIndexItem[];
};

/** Add by RSS albums on this browser naming the artist's guid, and their tracks. */
export const loadArtistPageAddByRssData = async (
  podcastGuid: string | null | undefined
): Promise<ArtistPageAddByRssData>;

/** Shared per guid until the next Add by RSS feed change. */
export const getArtistPageAddByRssData = (
  podcastGuid: string | null | undefined
): Promise<ArtistPageAddByRssData>;
```

- `loadArtistPageAddByRssData`: empty result when `normalizeAddByRSSGuid(podcastGuid)` is null.
  Otherwise read `getAllAddByRSSFeeds()` and `getAllListedAddByRSSFeeds()`,
  `albums = addByRSSAlbumsNamingPublisher(mergeAddByRSSAlbumSources(followed, listed), podcastGuid)`,
  `tracks = await loadAddByRSSAlbumTrackIndexItems(albums.map((source) => ({ source, itemGuids: null })))`.
  Sort albums by title (`localeCompare`), tracks by `pubDateMs` descending.
- `getArtistPageAddByRssData`: a module `Map<string, Promise<…>>` keyed by the normalized guid.
  Register `onAddByRSSFeedChanged(() => cache.clear())` once, lazily on first call, guarded by
  `typeof window !== 'undefined'`. A rejected promise is removed from the map and rethrown.

## `ArtistPageAddByRssSections.tsx`

Keep the three exports, the `{ channel: DTOChannel }` props, and plan 30's file comment. Drop the
`_` prefixes now that the bodies read `channel`.

Private hook `useArtistPageAddByRssData(channel)`:

- `const { loggedInAccount } = useAccount();` State `data: ArtistPageAddByRssData | null`, start
  `null`.
- Effect on `[loggedInAccount?.id_text, channel.podcast_guid, reloadKey]`: when logged out,
  `setData(null)`; else `getArtistPageAddByRssData(channel.podcast_guid)` then `setData`, with a
  `cancelled` flag; on error `console.error` and `setData(null)`.
- `useEffect(() => onAddByRSSFeedChanged(() => setReloadKey((k) => k + 1)), [])`.
- Because state starts `null` and only an effect sets it, server render and the first client
  render are empty.

`useArtistPageAddByRssPresence(channel)` returns
`{ hasAlbums: (data?.albums.length ?? 0) > 0, hasTracks: (data?.tracks.length ?? 0) > 0 }`.

`ArtistPageYourAddByRssAlbums`: `null` unless albums exist. Otherwise:

```tsx
<section aria-labelledby={headingId} data-testid="artist-your-add-by-rss-albums">
  <h2 id={headingId} className={styles.heading}>
    {tMedia('music.your_add_by_rss_albums')}
  </h2>
  <CommonAlbumListNodes items={albumItems} viewSelected="rows" />
</section>
```

`styles` is plan 30's `apps/web/src/styles/components/Artist/ArtistPageAlbumSections.module.scss`
(import last). `albumItems = data.albums.map((source) => ({ ...albumListItemFromAddByRSSFeed(source.feed), showAddByRssMarker: true }))`,
memoized.

`ArtistPageYourAddByRssTracks`: `null` unless tracks exist. Otherwise
`<section data-testid="artist-your-add-by-rss-tracks"><AddByRSSTrackNodes items={data.tracks} viewSelected="rows" showAddByRssMarker /></section>`.
No heading (plan 30: the Tracks tab has none).

## Marker

`components/AddByRSS/AddByRSSRowMarker.tsx`, `'use client'`, named export:

```tsx
export const AddByRSSRowMarker: React.FC = () => {
  const tFeatures = useTranslations('features');
  return (
    <span
      className={styles.marker}
      role="img"
      aria-label={tFeatures('add_by_rss.label')}
      title={tFeatures('add_by_rss.label')}
      data-testid="add-by-rss-row-marker"
    >
      <FaRss aria-hidden="true" focusable="false" />
    </span>
  );
};
```

`FaRss` from `react-icons/fa`. SCSS, tokens only, no `var()` fallback:
`.marker { display: inline-flex; align-items: center; margin-left: var(--spacing-xs); color: var(--text-color-secondary); font-size: var(--font-size-sm); vertical-align: middle; }`.
If `--spacing-xs` does not exist in `packages/ui` tokens, use the smallest spacing token that does.

Wiring:

- `AlbumListItem` (`Common/Artist/Album/types.ts`): add `showAddByRssMarker?: boolean;`.
- `CommonAlbumListRow` and `CommonAlbumListGridNode`: after `{item.title}` inside the title
  element, `{item.showAddByRssMarker ? <AddByRSSRowMarker /> : null}`.
- `CommonTrackRow`: new prop `titleMarker?: React.ReactNode`, passed to `trackContent` and
  rendered inside `<h3 className={styles.trackTitle}>` after `title`.
- `AddByRSSTrackRow`: new prop `showAddByRssMarker?: boolean`; pass
  `titleMarker={showAddByRssMarker ? <AddByRSSRowMarker /> : undefined}` to `CommonTrackRow`.
- `AddByRSSTrackNodes`: new prop `showAddByRssMarker?: boolean`, forwarded to each
  `AddByRSSTrackRow` (rows view only).

## Catalog

Insert `your_add_by_rss_albums` inside `media.music`, immediately after plan 30's
`not_yet_added_albums_note` (grep it; do not read the whole catalog). Do not edit `overrides/`
or `compiled/`.

| Locale | Value |
| --- | --- |
| en-US | Your Add by RSS Albums |
| es | Tus álbumes de Add by RSS |
| fr | Vos albums Add by RSS |
| el-GR | Τα άλμπουμ σας από Add by RSS |

Then run `npm run i18n:compile` from the repo root (generated output is gitignored).

## Must stay true

- `page.tsx`, `generateMetadata`, and server HTML never contain Add by RSS titles, the heading,
  or the marker.
- Logged-out visitors and other members never see these sections.
- The verified and Not Yet Added sections are unchanged; an album the member added by RSS that
  is also a directory album shows in the directory sections only as directory data.
- Rows elsewhere (library, Home, Add by RSS artist page) show no marker: the flags default off.

## Tests

`artistPageAddByRss.test.ts` (new; mock `./storage` and `./albumTracks` with `vi.hoisted` fns):

- A null or blank guid returns empty lists without reading storage.
- A followed album and a listed album naming the guid (any case, surrounding spaces) are both
  returned; an album naming another guid is not.
- Two calls with the same guid read storage once; after an emitted feed change, the next call
  reads again.

Plan 78 covers the rendered sections and marker.

## Release scratchpad

```markdown
## Directory artist pages show your Add by RSS albums by that artist

- Surfaces: web
- Change: on a Podverse artist page, a signed-in member now sees "Your Add by RSS Albums" and
  matching tracks: Add by RSS albums on this browser whose podcast:publisher names that artist.
  Rows carry an Add by RSS icon. The sections are built in the browser only; they are not in the
  page HTML and nobody else sees them.
- Who notices: members who add music albums by RSS
- Operator steps: none
```
