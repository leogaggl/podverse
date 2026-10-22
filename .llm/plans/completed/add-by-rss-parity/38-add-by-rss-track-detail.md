# 38 — Add by RSS track page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R65 (the page). Mobile only. Plan 34 adds Go to Track on the Library and feed page rows,
plan 41 on Home's Tracks chip, and plan 39 adds the Lyrics chip, the full-player link, and the
Maestro flow.

Runs after `33-add-by-rss-episode-detail.md` (the param list, loader, and header this reuses) and
`37-add-by-rss-music-type-and-track-header.md` (`TrackDetailHeader`), and after plans 20–22,
which own `AddByRssHomeDetailScreen.tsx`. Runs before `34-add-by-rss-item-rows.md`, which
navigates here. Plans 33, 39, 50, and 51 also edit `navigation/index.tsx`; never in one phase.

Parity source: `src/screens/track/TrackDetailScreen.tsx`. The web counterpart is
`apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackItemPageClient.tsx` (album
header, track header, More, Summary, and Lyrics); web's Boosts tab has no mobile track
counterpart, so it is not added.

## Locked decisions

1. **Route** `AddByRssTrackDetail`, params `{ feedIdText: string; itemKey: string }`, on the Home
   and My Library stacks, beside `AddByRssEpisodeDetail`. `itemKey` is plan 30's
   `AddByRssHomeEpisode.itemKey`.
2. **Stack header.** Title `t('media.music.track')`, as `TrackDetail`. No Share (Add by RSS pages
   are not shareable), so no `headerRight`.
3. **Album header.** `ChannelHeader` with the feed page's artwork (plan 20), the feed title, and
   the feed author as subtitle. The title press opens `AddByRssPodcastDetail`.
4. **Track header.** Plan 37's `TrackDetailHeader`, `testIDPrefix="add-by-rss-track-detail"`,
   with the feed title as the album link and plan 30's More actions (Queue Next, Queue Last, Add
   to Playlist, Mark as Played, Download). Duration is the parsed duration, as on plan 33's page.
5. **Chips.** Summary always; People when the item lists people. Labels from the track page.
   Plan 39 adds Lyrics between them. Funding is left out (parsed items carry no item funding,
   plan 33 decision 5).
6. **One loader and one More menu** for both Add by RSS item pages: extract plan 33's load into
   `useAddByRssItemDetail` and its More memo into `useAddByRssDetailMoreActions`.
7. **Tab choice** is screen state, default Summary, as on plan 33's page.

## Files

| File                                                           | Change                          |
| -------------------------------------------------------------- | ------------------------------- |
| `src/screens/track/trackTabs.ts`                               | New: `TRACK_TAB_LABEL_KEYS`     |
| `src/screens/track/TrackDetailScreen.tsx`                      | Import the labels               |
| `src/screens/home/addByRssHomeDetailData.ts`                   | `addByRssFeedHeaderArtwork`     |
| `src/screens/home/addByRssHomeDetailData.test.ts`              | Cover it                        |
| `src/screens/home/AddByRssHomeDetailScreen.tsx`                | Call it                         |
| `src/screens/home/addByRss/addByRssStackParams.ts`             | `AddByRssTrackDetail`           |
| `src/screens/home/addByRss/useAddByRssItemDetail.ts`           | New: plan 33's loader           |
| `src/screens/home/addByRss/useAddByRssDetailMoreActions.ts`    | New: plan 33's More memo        |
| `src/screens/home/addByRss/AddByRssEpisodeHeader.tsx`          | Use the More hook               |
| `src/screens/home/AddByRssEpisodeDetailScreen.tsx`             | Use the loader                  |
| `src/screens/home/addByRss/AddByRssTrackHeader.tsx`            | New                             |
| `src/screens/home/AddByRssTrackDetailScreen.tsx`               | New                             |
| `src/navigation/index.tsx`                                     | Routes, params, links, screens  |

All paths are under `apps/mobile/`. Large files: in `navigation/index.tsx` Grep
`AddByRssEpisodeDetail` and read a window around each hit; in `TrackDetailScreen.tsx` Grep
`TRACK_TAB_LABEL_KEYS`.

## Implementation

### `trackTabs.ts`

Move `TRACK_TAB_LABEL_KEYS` out of `TrackDetailScreen.tsx` unchanged and export it, with
`import type { TrackTab } from '../../prefs/detailListPrefs';`. The screen imports it from
`./trackTabs`. This mirrors `src/screens/episode/episodeTabs.ts`.

### `addByRssFeedHeaderArtwork`

In `addByRssHomeDetailData.ts`:

```typescript
/** Add by RSS page header artwork: a list-size image, and the largest one for the viewer. */
export const addByRssFeedHeaderArtwork = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed | null
): { listUrl: string | null; viewerUrl: string | null } => { … };
```

Body: the `headerArtwork` memo body in `AddByRssHomeDetailScreen.tsx` (anchor `const
headerArtwork`), minus the `detail === null` branch: `addByRSSFeedListArtworkCandidates({
channelImages: mappedFeed?.channel.images, comparison: 'lesser', feedImageUrl: feed.imageUrl,
sizeFindTarget: ARTWORK_LIST_SIZE_FIND_TARGET })[0] ?? null`, and the viewer from
`primaryChannelLightboxArtworkUrl(mappedFeed?.channel.images) ?? listUrl`. Move those imports.
The feed page memo becomes `detail === null ? { listUrl: null, viewerUrl: null } :
addByRssFeedHeaderArtwork(detail.feed, detail.mappedFeed)`.

### `addByRssStackParams.ts`

Add `AddByRssTrackDetail: { feedIdText: string; itemKey: string };` after `AddByRssPodcastDetail`.

### `useAddByRssItemDetail.ts`

```typescript
/** The feed, its parsed bundle, and one item of it, read from the device for an item page. */
export function useAddByRssItemDetail(input: { feedIdText: string; itemKey: string }): {
  errorKey: string | null;
  feed: MobileAddByRSSFeedRecord | null;
  isLoading: boolean;
  item: AddByRssHomeEpisode | null;
  mappedFeed: AddByRSSMappedFeed | null;
  reload: () => void;
};
```

Move plan 33's load from `AddByRssEpisodeDetailScreen.tsx` unchanged: the four steps, their error
keys, the request-id ref, and the effect keyed on the `feedIdText` and `itemKey` strings (never
on the `input` object, which is new each render). `reload` reruns it. The
episode screen calls `const { errorKey, feed, isLoading, item: episode, mappedFeed, reload: load }
= useAddByRssItemDetail(route.params);` so every later reference (plan 33's `onRetry={load}`,
plan 36's `episode` and `feed`) keeps its name. Delete the moved state and imports.

### `useAddByRssDetailMoreActions.ts`

```typescript
/** More menu for an Add by RSS item page: Queue Next, Queue Last, Add to Playlist, Mark as
 * Played, and Download when the item is downloadable. No Share. */
export function useAddByRssDetailMoreActions(input: {
  downloadItem: DTOItem | null;
  idSuffix: string;
  onAddToPlaylistPress: () => void;
  onMarkAsPlayedPress: () => void;
  onQueuePress: (position: QueueActionPosition) => void;
}): MediaRowMoreAction[];
```

Move from plan 33's `AddByRssEpisodeHeader.tsx`: `useDownloadAction(downloadItem ?? undefined)`,
`useActionError`, and the `moreActions` memo with its options. `AddByRssEpisodeHeader` calls it
with `idSuffix: `-${episode.id}`` and its three handlers; its output is unchanged.

### `AddByRssTrackHeader.tsx`

```typescript
type AddByRssTrackHeaderProps = {
  albumTitle: string;
  feedUrl: string;
  onAddToPlaylistPress: () => void;
  onAlbumPress: () => void;
  onMarkAsPlayedPress: () => void;
  onPlayPress: () => void;
  onQueuePress: (position: QueueActionPosition) => void;
  track: AddByRssHomeEpisode;
};
```

- `dateLabel`: `useMemo` of `itemDetailDateLabel(track.itemBundle.item.pub_date, i18n.language)`.
- `durationLabel`: `formatPlaybackDurationLabel(Number(track.duration), t)` when
  `track.duration !== null`, else `null` (plan 33's rule).
- `moreActions`: `useAddByRssDetailMoreActions({ downloadItem: track.downloadItem, idSuffix:
  `-${track.id}`, … })`.
- `artworkHeaders`: `useAddByRssArtworkHeaders(feedUrl, track.imageUrl)`.
- Render `TrackDetailHeader` with `albumTitle`, `artworkAddByRssFeedUrl={feedUrl}`,
  `artworkHeaders`, `artworkUri={track.imageUrl}`, `dateLabel`,
  `downloadItem={track.downloadItem}`, `durationLabel`, `mediaIdText={track.id}`, `moreActions`,
  `onAlbumPress`, `onPlayPress`, `testIDPrefix="add-by-rss-track-detail"`, `title={track.title}`.

### `AddByRssTrackDetailScreen.tsx`

Props: `NativeStackScreenProps<AddByRssDetailStackParamList, 'AddByRssTrackDetail'>`.

- `const { errorKey, feed, isLoading, item: track, mappedFeed, reload } =
  useAddByRssItemDetail(route.params);`
- `useAddByRssPlayback({ onNotice: setPlaybackNoticeKey })` and `useAddByRssItemActions()`, wired
  exactly as plan 33's screen: the target is `{ feed, itemBundle: track.itemBundle, itemIndex:
  track.itemIndex, mappedFeed }`; play is `playItem(feed, mappedFeed, track.itemBundle,
  track.itemIndex)`.
- `albumTitle`: `mappedFeed?.channel.channel.title ?? feed.title ?? feed.feedUrl` (plan 20's
  title order; use the same emptiness checks plan 20's code uses).
- `headerArtwork`: `useMemo` of `addByRssFeedHeaderArtwork(feed, mappedFeed)` when `feed !==
  null`; `headerArtworkHeaders = useAddByRssArtworkHeaders(feed?.feedUrl ?? null,
  headerArtwork.listUrl)`.
- `openFeed`: `navigation.navigate('AddByRssPodcastDetail', { feedIdText:
  route.params.feedIdText })`. Album header title and the track header's album link both use it.
- People: `useMemo(() => toAddByRssAboutPeople(track?.itemBundle.people ?? []), [track])`.
- Chips: `SectionChipItem<'people' | 'summary'>[]`, Summary then People when `people.length > 0`,
  `label: t(TRACK_TAB_LABEL_KEYS[key])`, `testID: `add-by-rss-track-detail-tab-${key}``. When
  `tab` is not in the list, show Summary (`const activeTab = …`, as plan 36 does on the episode
  page). A `listRef` scrolls to the top when `activeTab` changes, as `TrackDetailScreen` does.

Layout, copied from `TrackDetailScreen` (same style values: `container`, `content`, `chipRow`,
`notice`, `description`, `showMore`):

- Root `View` `testID="add-by-rss-track-detail-screen"`.
- `isLoading` → `LoadingSection testID="add-by-rss-track-detail-loading"`.
- `errorKey !== null` → `ListError messageKey={errorKey} onRetry={reload}
  testID="add-by-rss-track-detail-error"`.
- Otherwise `FillList` (`data={[]}`, `ListEmptyComponent={null}`, `ref={listRef}`,
  `contentContainerStyle={styles.content}`, `testID="add-by-rss-track-detail-list"`):
  - `ListHeaderComponent`: `ChannelHeader` (`artworkAddByRssFeedUrl={feed.feedUrl}`,
    `artworkHeaders={headerArtworkHeaders}`, `artworkUri={headerArtwork.listUrl}`,
    `onTitlePress={openFeed}`, `subtitle={mappedFeed?.channel.about?.author ?? null}`,
    `testID="add-by-rss-track-detail-album-header"`, `title={albumTitle}`), then
    `AddByRssTrackHeader`, then `actionNoticeKey ?? playbackNoticeKey` as `Text
    style={styles.notice}` when non-null, then `SectionChipRow`
    (`testID="add-by-rss-track-detail-sections"`) in `styles.chipRow`.
  - `ListFooterComponent`: Summary → `<View testID="add-by-rss-track-detail-summary">` with
    plan 33's `DescriptionText` props, ids renamed (`add-by-rss-track-detail-description`,
    `add-by-rss-track-detail-description-toggle`), `resetKey={track.id}`. People → `PeoplePane
    isLoading={false} layout="inline" people={people} testIDPrefix="add-by-rss-track-detail"`.
- Render `addToPlaylistSheet` once, after the list. No pull to refresh: the page reads the device,
  and feed refresh lives on the feed page.

Doc comment: the Add by RSS counterpart of `TrackDetailScreen`, built from the parsed feed on the
device; no Share (Add by RSS pages are not shareable) and no Funding (parsed items carry none).

### `navigation/index.tsx`

Follow plan 33's `AddByRssEpisodeDetail` entries exactly, beside each one:

- `HOME_STACK_ROUTES` and `LIBRARY_STACK_ROUTES`: `AddByRssTrackDetail: 'AddByRssTrackDetail'`
  (keys stay alphabetical).
- `HomeStackParamList` and `LibraryStackParamList`:
  `AddByRssTrackDetail: { feedIdText: string; itemKey: string };`.
- `homeTabLinkScreens`: `AddByRssTrackDetail:
  `${MOBILE_HOME_TAB_SEGMENT}/add-by-rss/:feedIdText/track/:itemKey``; `libraryTabLinkScreens`:
  `'my-library/add-by-rss/:feedIdText/track/:itemKey'`.
- Register `AddByRssTrackDetailScreen` on both stacks right after `AddByRssEpisodeDetail`, with
  `options={{ title: t('media.music.track') }}`.
- If a `src/navigation/` test lists every link path, add the two paths as plan 33 did.

## Tests

- `addByRssHomeDetailData.test.ts`: `addByRssFeedHeaderArtwork` returns the feed `imageUrl` for
  both URLs when the bundle has no channel images, and with `mappedFeed === null`.
- No hook or screen test: React Native wiring outside the vitest suite. Plan 39's Maestro flow
  opens this page from a track row and asserts its header, chips, and Lyrics.
- `e2e/add-by-rss.yaml` (plans 33, 34) proves the episode page still loads and its More menu
  after the two extractions.

## Release scratchpad

```markdown
## Mobile Add by RSS tracks get their own page

- Surfaces: mobile
- Change: Add by RSS music tracks now have a page laid out like a track page: the album header
  (tap the title to open the feed), then the track's artwork with a download button, the album
  name, title, date, and play, duration, and More. Below are Summary and, when the feed lists
  them, People. More offers Queue Next, Queue Last, Add to Playlist, Mark as Played, and
  Download. There is no Share or Funding.
- Who notices: anyone who adds music feeds by RSS on the phone
- Operator steps: none
```
