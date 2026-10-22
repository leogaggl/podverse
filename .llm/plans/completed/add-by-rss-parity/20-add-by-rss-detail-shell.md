# 20 — Add by RSS channel detail on the shared channel shell

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R4, R40 (chip framework and the Episodes / Tracks chip), R41, R42, R43. Mobile only.

Runs after `10-item-row-type-and-dot.md`. Plans 21 and 22 build on the files this plan creates.

## Answers

**R43.** Mobile already layers its channel screens the way web does: `ChannelDetailShell` (pinned
identity, chip row, one pane), `ChannelHeader` (art, title, gear, action row), `SectionChipRow` with
a trailing `MenuSelectChip`, and `PodcastSectionList` (one virtualized list with the shared loading,
empty, error, and notice chrome). The Add by RSS detail uses none of them today: it builds its own
boxed header, a `SortSelectRow`, a section title, and a raw `FlatList`. This plan moves it onto
those layers. The non-Add-by-RSS podcast screen (`PodcastDetailScreen.tsx`) is the parity source.

**R41.** The chip→list seam comes from `SectionChipRow` (`listChipRowBottomGap`) and
`PodcastSectionList`'s own insets once the screen uses them. No screen-local spacing remains.

**R42.** The control becomes a trailing `MenuSelectChip` in the chip row, the same control as the
podcast sort chip.

## Locked decisions

1. **Header (R4).** `ChannelHeader`, same props as podcast detail:
   - `title`: `detail.mappedFeed?.channel.channel.title`, then `detail.feed.title`, then
     `detail.feed.feedUrl`.
   - `artworkUri` / `viewerUri`: today's `headerArtwork.listUrl` / `headerArtwork.viewerUrl`.
   - `actions`: one `Button`, `label={t('features.unsubscribe')}`, `size="sm"`, `variant="outline"`,
     `loading={isRemoving}`, `testID="add-by-rss-home-remove"`, `onPress` = today's
     `handleRemovePress`. Unsubscribe still removes the feed from the device and goes back; there is
     no Subscribe state on this screen because the feed record is gone after removal.
   - `settings`: `{ accessibilityLabel: t('settings.settings'), onPress: toggle settingsOpen,
     selected: settingsOpen, testID: 'add-by-rss-home-header-settings' }`. Plan 22 fills the pane.
   - `notice`: `t(removeErrorKey)` when an unsubscribe fails, else null.
   - `testID="add-by-rss-home-header"`.
   - No subtitle, no description, no feed URL line, no item count. The feed URL moves to About
     (plan 21).
2. **Private-feed artwork.** `ChannelHeader` gains two optional props forwarded to its `CoverImage`:
   `artworkAddByRssFeedUrl?: string | null` → `addByRssFeedUrl`, and
   `artworkHeaders?: Record<string, string>` → `headers`. The screen passes `detail.feed.feedUrl`
   and the `useAddByRssArtworkHeaders` result. Other callers pass nothing.
3. **Stack header.** `navigation.setOptions({ headerRight })` with `HeaderBarActions` holding one
   Boost `HeaderBarAction` when eligible, the same props as podcast detail
   (`icon="cash-outline"`, `iconColor={tokens.text.warning}`,
   `accessibilityLabel={t('value.boost')}`, `testID="add-by-rss-home-boost"`). Eligibility:
   `buildAddByRssBoostChannel({ ...detail.feed, mappedFeed: detail.mappedFeed ?? undefined })`
   from `@podverse/parser-mapping`, then `getBoostEligibilityForContent({ channel })` from
   `@podverse/v4v-metaboost`. Press calls `openBoost({ channel, item: null })` from
   `useBoostSheet`; render `{boostSheet}` beside the shell. When the channel is null or not
   eligible, `headerRight` renders nothing.
4. **No share, no bell.** Intentional divergence, recorded in the screen's doc comment: Add by RSS
   pages are not shareable (web **add-by-rss-parity-sync** says the same), and notifications are
   keyed to a server channel this feed does not have.
5. **Sections.** New `ADD_BY_RSS_DETAIL_TABS` in `prefs/detailListPrefs.ts`:
   `['episodes', 'tracks', 'downloaded', 'about', 'funding', 'people'] as const`, type
   `AddByRssDetailTab`. This plan offers only `episodes` (podcast feeds) or `tracks` (feeds whose
   `resourceType` is `artists`, `albums`, or `tracks`). Plan 21 adds the rest through the same
   resolver. The section is visit-local and is not stored (**filter-sort-persistence**).
6. **Sort (R42).** Replace `ADD_BY_RSS_EPISODE_SORT_OPTIONS` with `['recent', 'oldest']`
   (default `recent`) and add `ADD_BY_RSS_TRACK_SORT_OPTIONS = ['forward', 'backward']` (default
   `forward`). Alphabetical is dropped: the podcast screen and the web Add by RSS page both offer
   recent and oldest, and `top` needs server popularity. Music feeds use the album order pair.
   Labels: `filters.sort.recent`, `filters.sort.oldest`, `filters.sort.forward`,
   `filters.sort.backward`. Chip: `MenuSelectChip`, `heading={t('filters.screen.sort_heading')}`,
   `testID="add-by-rss-home-sort"`, rendered as `chipTrailing` only while the section is
   `episodes` or `tracks` and settings is closed.
7. **Prefs.** In `detailListPrefs.ts` replace `AddByRssDetailPrefs` / `readAddByRssDetailPrefs` /
   `writeAddByRssDetailSort` with:
   - `readAddByRssEpisodeSort(feedIdText): Promise<AddByRssEpisodeSort>`
   - `readAddByRssTrackSort(feedIdText): Promise<AddByRssTrackSort>`
   - `writeAddByRssDetailSort(feedIdText, sort: AddByRssEpisodeSort | AddByRssTrackSort)`
   All keep `channelScope(feedIdText)`. A stored `alphabetical` falls back to the default through
   `pickSortPrefToken`. No migration.
8. **Sorting.** `sortAddByRssHomeEpisodes(rows, sort)` takes
   `AddByRssEpisodeSort | AddByRssTrackSort | AddByRssLibrarySortOption` (the last from
   `prefs/addByRssListPrefs.ts`, a type-only import). The Add by RSS library's item chips keep
   passing their own `'alphabetical' | 'recent'` sort (`addByRssLibraryFeedData.ts`, unchanged):
   - `alphabetical`: today's rule (`articleStrippedTitle` order). Only the library passes it.
   - `recent`: today's rule (newest first, missing dates last, ties by `articleStrippedTitle`).
   - `oldest`: oldest first, missing dates last, ties by `articleStrippedTitle`.
   - `forward`: `itemIndex` ascending (feed order). `backward`: `itemIndex` descending.
9. **Title filter.** `ListFilterField` as the section `listHeader` on `episodes` and `tracks`,
   same props as podcast detail with `testID="add-by-rss-home-filter"`. The term is visit-local
   state on the screen. Rows match with `matchesTitleFilter` from `@podverse/helpers`.
10. **Loading and errors.** While the first read is out, render
    `<View style={flex: 1, screen background} testID="add-by-rss-home-detail-screen">` with
    `<LoadingSection testID="add-by-rss-home-loading" />`. A failed read (feed null or throw)
    renders the same container with `ListError` (`testID="add-by-rss-home-error"`,
    `onRetry` = reload). Once `detail` exists, render `ChannelDetailShell` with
    `testID="add-by-rss-home-detail-screen"`, `sectionsTestID="add-by-rss-home-sections"`,
    `loadingTestID="add-by-rss-home-section-loading"`, `isSectionHydrated` true after the sort pref
    is read. Chip testIDs: `add-by-rss-home-section-<tab>`.
11. **Seen timestamp.** Keep plan 10's contract: the visit's previous last-seen timestamp reaches
    every episode row as `itemLastSeenAtMs`. Move the `channelSeenRepository.markSeen` call out of
    `loadDetail` into its own effect keyed on `detail?.feed.feedUrl` (runs once per feed, not on a
    reload). Store the returned `number | null` in `visitLastSeenAtMs` state (initial `undefined`).
    `loadDetail` only reads, so plan 22's reload after a feed check does not re-stamp the channel.
12. **Delete `SortSelectRow`.** It has no other caller. Remove `components/form/SortSelectRow.tsx`
    and its two export lines in `components/form/index.ts`.

## Files

Paths are under `apps/mobile/` unless they start with `.cursor/`.

| File                                                       | Change                             |
| ---------------------------------------------------------- | ---------------------------------- |
| `src/screens/home/AddByRssHomeDetailScreen.tsx`            | Rewrite on `ChannelDetailShell`    |
| `src/screens/home/addByRss/addByRssDetailSections.ts`      | New. Resolver and labels           |
| `src/screens/home/addByRss/addByRssSectionPane.ts`         | New. `AddByRssSectionPaneProps`    |
| `src/screens/home/addByRss/AddByRssEpisodesSection.tsx`    | New. List and `AddByRssEpisodeRow` |
| `src/screens/home/addByRssHomeDetailData.ts`               | Sort union                         |
| `src/screens/home/addByRssHomeDetailData.test.ts`          | Sort cases                         |
| `src/screens/home/addByRss/addByRssDetailSections.test.ts` | New                                |
| `vitest.config.ts`                                         | Include the new test path          |
| `src/prefs/detailListPrefs.ts`                             | Tabs, sort unions, helpers         |
| `src/components/channel/ChannelHeader.tsx`                 | Two artwork props                  |
| `src/components/form/SortSelectRow.tsx`                    | Delete                             |
| `src/components/form/index.ts`                             | Drop `SortSelectRow` exports       |
| `e2e/add-by-rss.yaml`                                      | Header and chip asserts            |

`navigation/index.tsx` is not edited. `addByRssLibraryFeedData.ts` keeps calling
`buildAddByRssHomeDetailData`; its signature does not change.

## Implementation

### `addByRssDetailSections.ts` (pure, no React Native)

```typescript
export const ADD_BY_RSS_SECTION_LABEL_KEYS: Record<AddByRssDetailTab, string> = {
  about: 'info.about',
  downloaded: 'features.download.downloaded',
  episodes: 'media.podcast.episodes',
  funding: 'info.funding',
  people: 'info.people.people',
  tracks: 'media.music.tracks',
};

export const isAddByRssMusicFeed = (resourceType: AddByRSSResourceType): boolean =>
  resourceType === 'artists' || resourceType === 'albums' || resourceType === 'tracks';

export const addByRssItemsTab = (isMusicFeed: boolean): AddByRssDetailTab =>
  isMusicFeed ? 'tracks' : 'episodes';

export const isAddByRssSortableSection = (section: AddByRssDetailTab): boolean =>
  section === 'episodes' || section === 'tracks';

export const isAddByRssFilterableSection = isAddByRssSortableSection;

export const resolveAddByRssSections = ({ isMusicFeed }: { isMusicFeed: boolean }):
  AddByRssDetailTab[] => [addByRssItemsTab(isMusicFeed)];
```

Plan 21 widens the resolver input. Keep the function's shape so that change is additive. Import
`AddByRSSResourceType` from wherever `MobileAddByRSSFeedRecord` imports it.

### `addByRssSectionPane.ts`

```typescript
export type AddByRssSectionPaneProps = {
  detail: AddByRssHomeDetailData;
  filterTerm: string;
  isMusicFeed: boolean;
  listHeader: ReactNode;
  /** Re-read the feed from the device; plan 22 adds the network check. */
  onRefresh: () => Promise<void>;
  sort: AddByRssEpisodeSort | AddByRssTrackSort;
  /** Previous last-seen instant for this visit; undefined until read. */
  visitLastSeenAtMs: number | null | undefined;
};
```

### `AddByRssEpisodesSection.tsx`

Move `AddByRssEpisodeRow` here unchanged, including plan 10's `itemLastSeenAtMs` prop and today's
testIDs: `add-by-rss-home-play-first`, `add-by-rss-home-play-${row.id}`, and
`add-by-rss-home-episode-${row.id}`. Area C edits this row next; leave its tap and actions as
they are.

The section owns `useAddByRssPlayback({ onNotice: setNoticeKey })` and today's `handlePlay`
(lookup by `row.id` in `detail.episodeRows`, `status_processing` notice when missing). It renders
`PodcastSectionList` (import from `../../podcast/sections/PodcastSectionList`):

- `rows`: `sortAddByRssHomeEpisodes(detail.episodeRows, sort)` filtered by
  `matchesTitleFilter(row.title, filterTerm)`, memoized.
- `emptyMessageKey`: `features.add_by_rss.status_processing` when `detail.mappedFeed === null`;
  else `media.music.no_tracks_found` for music, `media.podcast.no_episodes_found` otherwise
  (confirm both paths with Grep `-C 3` on the consumer catalog).
- `hasFilterHiddenEverything`: rows exist and the filter hid all of them.
- `isInitialLoading={false}`, `errorKey={null}`, `onRetry` and `onRefresh` call `onRefresh`,
  `isRefreshing` local state around that await.
- `noticeKey`: the playback notice.
- `listHeader`, `keyExtractor` = `row.id`, `testID="add-by-rss-home-episode-list"`,
  `statusTestIDPrefix="add-by-rss-home"`.

### Screen

Keep: `loadDetail` reads (feed, mapped feed, `buildAddByRssHomeDetailData`), `handleRemove`,
`headerArtwork`, `useAddByRssArtworkHeaders`. Drop: the boxed header styles, `SettingsOptionNavRow`,
the section title, `SortSelectRow`, `listHeader`/`listFooter`/`listEmpty`, the raw `FlatList`,
`handleCredentialsPress` (plan 22 replaces it), and the playback hook (moved to the section).

State: `detail`, `isLoading`, `errorKey`, `removeErrorKey`, `isRemoving`, `section`,
`settingsOpen`, `sort`, `isSortHydrated`, `filterTerm`, `visitLastSeenAtMs`.

After `loadDetail` sets `detail`, read the sort for that feed with the reader that matches
`isAddByRssMusicFeed(detail.feed.resourceType)`, set it, then `isSortHydrated = true`. Reset
`section` to `addByRssItemsTab(isMusicFeed)` and `settingsOpen` to false when `feedIdText` changes.

`handleSectionSelect` closes settings and sets the section (podcast pattern). `handleSortSelect`
sets state and calls `writeAddByRssDetailSort(detail.feed.idText, next)`.

`sectionBody`: while `settingsOpen`, a placeholder `View` with `flex: 1` (plan 22 replaces it).
Otherwise `<AddByRssEpisodesSection … />` for `episodes` / `tracks`. Use a
`Record<AddByRssDetailTab, ComponentType<AddByRssSectionPaneProps>>` the way podcast detail uses
`SECTION_COMPONENTS`; until plan 21, map the other four tabs to `AddByRssEpisodesSection` too
(they are never offered by the resolver yet).

Doc comment on the screen: one column; identity and controls on the screen, each section owns its
list; Unsubscribe removes the device feed; no share or bell because the page is not shareable and
notifications need a server channel; credentials live in Settings.

## Tests

`addByRssHomeDetailData.test.ts`: keep the `alphabetical` assertion (the library still sorts that
way); add one case for `oldest`, one each for `forward` and `backward` (feed order and its
reverse), and one where a missing date sorts last under both `recent` and `oldest`.

`addByRssDetailSections.test.ts` (add to the vitest `include` array beside `HomeFeedRow.test.ts`):
podcast feed resolves `['episodes']`, music feed resolves `['tracks']`, sortable/filterable only on
`episodes` and `tracks`, `isAddByRssMusicFeed` for each resource type.

Maestro `apps/mobile/e2e/add-by-rss.yaml`, after `assertVisible: id: add-by-rss-home-detail-screen`:

```yaml
- assertVisible:
    id: add-by-rss-home-header
- assertVisible:
    id: add-by-rss-home-section-episodes
- assertVisible:
    id: add-by-rss-home-sort-button
```

`add-by-rss-home-play-first` and `add-by-rss-home-remove` keep their IDs, so both flows' later
steps stand. No Playwright spec. No API test.

## Release scratchpad

```markdown
## Mobile Add by RSS channel detail matches podcast detail

- Surfaces: mobile
- Change: The Add by RSS channel page uses the podcast page's header (artwork beside the title,
  Unsubscribe under it, settings gear), section chips, and list. Sorting moved from a row of pills
  into a Sort chip beside the section chips, with Recent and Oldest for podcasts and Forward and
  Backward for music feeds. A title filter sits above the episodes. Boost appears in the title bar
  when the feed carries value tags. The feed URL and item count left the header.
- Who notices: anyone who opens a feed they added by RSS on the phone
- Operator steps: none
```
