**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 40 — Mobile Home Clips: no A-Z sort, Recent by default

## Rows

R13, R14, R15

## Runs after

38

Plan 38 rewrites the `clips` branch of `fetchHomeFeed`, the clips cache repository, and the
`loadFeed` / `listFooter` parts of `HomeScreen.tsx`. This plan edits `homeFeedData.ts`,
`homeFeedData.localPaint.test.ts`, and `HomeScreen.tsx` after it. No other plan in the set edits
`homeListPrefs.ts`, `homeListPrefs.test.ts`, `HomeSortChip.tsx`, `syncJobs.ts`, or
`apps/mobile/e2e/home.yaml`.

## Operator decision

D9: "Clips should never have an A-Z sorting. this should not even be an option in the api, web, or
mobile, or anywhere." Clip lists default to Recent. A saved A-Z preference for clips falls back to
Recent when read. Podcasts, episodes, and channels keep A-Z.

## Where clip lists offer a sort today (R13 answer)

| Surface | Clip list | Sort options | A-Z? |
| --- | --- | --- | --- |
| API | `/clip/public/{recent,oldest,top}`, `category/*`, `channel/*/:id`, `item/*/:id`, `subscribed/{recent,top}`, `/clip/private`, profile `clips/recent` | one route per order | No route |
| `@podverse/helpers-requests` | `reqClipGetManyPublic` takes `QueryParamsGetManyPartial.sort` (`recent`, `oldest`, `top`); channel and item clip helpers take `SORT_RECENT_OLDEST_TOP` | — | No |
| Web | Browse and Subscribed Clips (`getEpisodesPageSortOptions`: Recent, Top); podcast Clips tab (Recent, Oldest, Top); episode Clips tab (Recent, Oldest, Top) and Official Clips (Recent, Oldest); profile Clips tab (Recent) | — | No |
| Web stored prefs | `local-settings` cookie `fd.clips`, `fd['subscribed-clips']` are read through `getEpisodesPageFilterParams` → `getValidQueryParam`; detail `sp` entries through `resolveStoredToken` → `pickSortPrefToken`. Both fall back to Recent for any token they do not offer. | — | Falls back already |
| Mobile Browse, podcast Clips / Official Clips, episode and full player Clips, My Clips | Channel sort (`recent`, `oldest`, `top`), `EPISODE_CLIP_SORT_OPTIONS` (`recent`, `oldest`), or none | — | No |
| Mobile Add by RSS | No clip list (the library chips are podcasts, episodes, artists, albums, tracks, livestreams) | — | No |
| **Mobile Home Clips** | `HomeSortChip` with `HOME_SORT_OPTIONS` (`alphabetical`, `recent`, `popularity`), default `alphabetical`; `applyHomeSort` sorts the stored page by title | — | **Yes** |

So the only change is mobile Home Clips. Plan 41 adds API and web regression tests that lock in
the other rows. The stored Home clips snapshot never records A-Z: `createHomeClipsJob` maps A-Z to
`recent` before the request, and plan 38's window records `sort: 'recent' | 'top'`.

R15: Home Podcasts, Episodes, Artists, Albums, and Tracks keep `HOME_SORT_OPTIONS` and the A-Z
default. `homeItemMerge.ts` (episodes and tracks), `subscriptionsMerge.ts`, the Add by RSS library
(`addByRssListPrefs.ts`), and `detailListPrefs.ts` are not changed.

## Changes

### 1. `apps/mobile/src/prefs/homeListPrefs.ts`

Below `DEFAULT_HOME_SORT`, add:

```ts
/**
 * Clips order by Recent or Popularity. The clip endpoints have no title order, and a page window
 * sorted by title on the device would reshuffle as more pages arrive.
 */
export const HOME_CLIP_SORT_OPTIONS = ['recent', 'popularity'] as const satisfies readonly HomeSortOption[];

export const DEFAULT_HOME_CLIP_SORT: HomeSortOption = 'recent';

/** The orders the sort chip offers for this media type. */
export const homeSortOptionsFor = (mediaType: HomeMediaType): readonly HomeSortOption[] => {
  return mediaType === 'clips' ? HOME_CLIP_SORT_OPTIONS : HOME_SORT_OPTIONS;
};

/** The order this media type opens on when nothing usable is stored. */
export const defaultHomeSortFor = (mediaType: HomeMediaType): HomeSortOption => {
  return mediaType === 'clips' ? DEFAULT_HOME_CLIP_SORT : DEFAULT_HOME_SORT;
};

/**
 * A stored or carried order, or this media type's default when the token is missing or not one
 * the chip offers for it. A Clips A-Z written by an older build reads as Recent.
 */
export const resolveHomeSort = (
  mediaType: HomeMediaType,
  sort: string | undefined
): HomeSortOption => {
  return pickSortPrefToken(sort, homeSortOptionsFor(mediaType), defaultHomeSortFor(mediaType));
};
```

If `satisfies` on the `as const` tuple does not compile with the repo's TypeScript, drop the
`satisfies` clause; `homeSortOptionsFor`'s return type already checks assignability.

Replace `homeSortToApiSort` with a clips-only mapping (its only caller is the `home-clips` job):

```ts
/** API `sort` for the Home clips request. Popularity is the directory's `top` ranking. */
export const homeClipSortToApiSort = (sort: HomeSortOption): 'recent' | 'top' => {
  return sort === 'popularity' ? 'top' : 'recent';
};
```

Delete `homeSortToApiSort`, and delete `isHomeSortOption` once nothing uses it.

`readHomeListPrefs`: replace the `const sort = stored?.sort !== undefined && isHomeSortOption(...)`
expression with `const sort = resolveHomeSort(mediaType, stored?.sort);`.

`writeHomeSort`: return without writing when `!homeSortOptionsFor(mediaType).includes(sort)`, so
Clips can never store A-Z even from a programmatic call.

Update the `isHomeSortableMediaType` doc comment to: "Every Home list except Livestreams has a sort
chip. Clips offers Recent and Popularity; the others add A-Z."

### 2. `apps/mobile/src/screens/home/HomeSortChip.tsx`

- Add a required prop `options: readonly HomeSortOption[]` to `HomeSortChipProps`, and build the
  `MenuSelectChip` options from `options.map(...)` instead of `HOME_SORT_OPTIONS.map(...)`. Add
  `options` to that `useMemo`'s dependencies. Remove the `HOME_SORT_OPTIONS` import.
- `SORT_LABEL_KEYS` stays a full `Record<HomeSortOption, string>`.
- Doc comment: replace "otherwise A-Z or Recent" with "otherwise the order's name".

### 3. `apps/mobile/src/screens/home/HomeScreen.tsx` (large file; edit only these anchors)

- Import block from `'../../prefs/homeListPrefs'`: remove `DEFAULT_HOME_SORT`; add
  `defaultHomeSortFor`, `homeSortOptionsFor`, `resolveHomeSort`.
- `resolvedPrefs` fallback object (the `: { mediaType: selectedMediaType, range: DEFAULT_HOME_RANGE, sort: DEFAULT_HOME_SORT, ... }`
  literal under the comment "Defaults until AsyncStorage catches up"): `sort: defaultHomeSortFor(selectedMediaType)`.
- The prefs effect's `catch` branch (`perfMark('home.prefs.end', 'fallback')` then `setListPrefs({...})`):
  `sort: defaultHomeSortFor(selectedMediaType)`.
- The `HomeSortChip` element inside `MediaTypeSelector`'s `trailing` prop: pass
  `options={homeSortOptionsFor(displayedMediaType)}` and change `sort={resolvedPrefs.sort}` to
  `sort={resolveHomeSort(displayedMediaType, resolvedPrefs.sort)}`. While a chip switch is pending,
  `resolvedPrefs` still belongs to the previous chip; resolving against the displayed chip keeps
  the Clips face from showing a raw `alphabetical` token.

`handleSortChange` and `handleRangeChange` stay as they are; the chip only offers valid orders, and
`writeHomeSort` refuses the rest.

### 4. `apps/mobile/src/screens/home/homeFeedData.ts`

- Delete `applyHomeSort`.
- In the `clips` branch as plan 38 leaves it, replace
  `homeFeedReadFromRows(applyHomeSort(normalizeClipRows(snapshot.items), sort))` with
  `homeFeedReadFromRows(normalizeClipRows(snapshot.items))`. Keep plan 38's `hasMore`.
- Remove `articleStrippedTitle` from the `@podverse/helpers` import (its only use was
  `applyHomeSort`). Remove the `HomeSortOption` type import only if nothing else in the file uses it
  (`HomeFeedOptions.sort` still does).
- `HomeFeedOptions.sort` doc comment: "List order. Channel and item chips apply it locally. Clips
  keep the server order the stored pages were fetched in."

### 5. `apps/mobile/src/sync/syncJobs.ts`

In `createHomeClipsJob`:

```ts
const clipsPrefs = await readHomeListPrefs('clips');
await homeClipsCacheRepository.refreshFromAccount(deps.getAuthContext(), {
  range: homeSortToApiRange(clipsPrefs.sort, clipsPrefs.range),
  sort: homeClipSortToApiSort(clipsPrefs.sort),
});
```

Replace the `homeSortToApiSort` import with `homeClipSortToApiSort`.

## Files

apps/mobile/src/prefs/homeListPrefs.ts
apps/mobile/src/prefs/homeListPrefs.test.ts
apps/mobile/src/screens/home/HomeSortChip.tsx
apps/mobile/src/screens/home/HomeScreen.tsx
apps/mobile/src/screens/home/homeFeedData.ts
apps/mobile/src/screens/home/homeFeedData.localPaint.test.ts
apps/mobile/src/sync/syncJobs.ts
apps/mobile/e2e/home.yaml

## Tests

`apps/mobile/src/prefs/homeListPrefs.test.ts` (Vitest, the existing in-memory AsyncStorage mock;
stored keys look like `sort.clips`):

- Clips opens on Recent when nothing is stored: `readHomeListPrefs('clips')` resolves to
  `{ range: DEFAULT_HOME_RANGE, sort: 'recent', viewMode: DEFAULT_HOME_VIEW_MODE }`.
- A stored A-Z on Clips reads as Recent: seed `sort.clips` with `{ sort: 'alphabetical' }`.
- `writeHomeSort('clips', 'alphabetical')` stores nothing: after `writeHomeSort('clips', 'popularity')`
  then `writeHomeSort('clips', 'alphabetical')`, the read is still `popularity`.
- Clips remembers Popularity and its window: `writeHomeRange('clips', 'month')` reads
  `{ range: 'month', sort: 'popularity' }`.
- `homeSortOptionsFor('clips')` is `['recent', 'popularity']`; for `podcasts`, `episodes`,
  `artists`, `albums`, and `tracks` it is `['alphabetical', 'recent', 'popularity']`.
- `resolveHomeSort('clips', 'alphabetical')` is `recent`; `resolveHomeSort('podcasts', 'alphabetical')`
  is `alphabetical`; `resolveHomeSort('episodes', undefined)` is `DEFAULT_HOME_SORT`.
- `homeClipSortToApiSort`: `recent` → `recent`, `popularity` → `top`, `alphabetical` → `recent`.
- The existing podcasts and episodes A-Z default tests stay as they are (R15).

`apps/mobile/src/screens/home/homeFeedData.localPaint.test.ts`: add "keeps clips in the stored
order even when the carried sort is A-Z". Mock `homeClipsCacheRepository.readSnapshot` with
`{ items: [{ id_text: 'clip-z', title: 'Zebra clip', podcast_title: 'Show' }, { id_text: 'clip-a', title: 'Apple clip', podcast_title: 'Show' }], window: null }`,
call `fetchHomeFeed('clips', { sort: 'alphabetical' })`, and expect `read.rows.map((row) => row.id)`
to equal `['clip-z', 'clip-a']`.

`apps/mobile/e2e/home.yaml`, right after `- takeScreenshot: home-media-type-clips` and before the
"Artists is the next chip" comment, insert:

```yaml
# Clips sorts by Recent or Popularity and opens on Recent. It never offers A-Z.
- runFlow:
    file: shared/reveal-chip-row-trailing.yaml
    env:
      CHIP_ROW_ID: home-media-type-selector
      TRAILING_ID: home-sort-button
- assertVisible:
    id: home-sort-button
- assertVisible: "Sort: Recent"
# The sort chip counts as visible while its center is still past the trailing edge, so a tap
# there never opens the sheet.
- swipe:
    from:
      id: home-media-type-selector
    direction: LEFT
- tapOn:
    id: home-sort-button
- assertVisible:
    id: home-sort-menu
- assertVisible:
    id: home-sort-recent
- assertVisible:
    id: home-sort-popularity
- assertNotVisible:
    id: home-sort-alphabetical
- takeScreenshot: home-sort-clips
- tapOn:
    id: home-sort-menu-cancel
- runFlow:
    file: shared/restore-chip-row-start.yaml
    env:
      CHIP_ROW_ID: home-media-type-selector
```

Also update the comment above the first Podcasts sort block (line "A-Z, Recent, and Popularity. …
A-Z is the default.") to say that Podcasts, Episodes, Artists, Albums, and Tracks offer A-Z,
Recent, and Popularity with A-Z as the default, and Clips offers Recent and Popularity. The rest of
the flow is unchanged; the Clips chip follows `restore-chip-row-start`, so the Artists swipe starts
from the same row position as before.

## Release scratchpad

## Mobile Home Clips no longer offers an A-Z sort

- Surfaces: mobile
- Change: Home's Clips chip sorts by Recent or Popularity only, and opens on Recent. A-Z is gone
  from its sort menu. A Clips A-Z choice saved by an earlier build reads as Recent. Clips now show
  in the server's order instead of being re-sorted by title on the device. Podcasts, Episodes,
  Artists, Albums, and Tracks keep A-Z as their default.
- Who notices: signed-in users who had Home Clips set to A-Z (it opens on Recent), and anyone who
  opens the Clips sort menu
- Operator steps: none
