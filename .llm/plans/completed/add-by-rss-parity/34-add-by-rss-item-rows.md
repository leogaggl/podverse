# 34 — Add by RSS item rows: open the page, show duration, add More

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R23, R24, R25, R26, R27, R28, R30, R54, R65 (Go to Track on track rows). Mobile only.

Runs after `33-add-by-rss-episode-detail.md` and `38-add-by-rss-track-detail.md` (the routes it
navigates to), after `37-add-by-rss-music-type-and-track-header.md` (without it no feed is
music), and after plans 10, 20, 21, and 22, which own the row's layout and its file. Area D
(plans 40–49) also edits `AddByRssRootScreen.tsx`, for channel rows only; run the two in
sequence, never together.

## Answers

**R26.** Add by RSS rows do carry a duration: `buildAddByRssHomeDetailData` sets `duration` from
the parsed `itemBundle.about.duration`, which is seconds (`compatItemAboutDto` stores
`duration.toFixed(2)`), or `null` when the feed gives none. The channel page never shows it: its
row passes `customActions` with `durationLabel={null}`. The Library's Add by RSS Episodes chip
already shows it, because that row uses `HomeFeedRow`'s own action band.

**R27.** Drop `customActions` on the channel page row. `HomeFeedRow`'s own band formats
`row.duration` with `useDurationLabel` and puts it right of play, as on podcast episode rows.

**R23, R25.** Today both lists play on row tap (`onPress={onPlay}` on the channel page;
`handleRowPress` plays for the Episodes chip in the Library). Podcast feeds change to the podcast
episode row's behavior (`PodcastEpisodesSection`): the row opens `AddByRssEpisodeDetail`, and the
play button plays.

**R24.** Music feeds (`isAddByRssMusicFeed` from plan 20) and the Library's Tracks chip keep the
row tap as play and render as tracks, matching album track rows (`AlbumDetailScreen`'s track row:
`mediaType="tracks"`, `onPress={onPlay}`). Track rows have no play button; More sits on the row.

**R65.** Album and artist track rows, and Home's Tracks chip, offer Go to Track in More
(`HomeFeedRow` adds it when `mediaType === 'tracks'` and `onGoToTrackPress` is passed). Add by
RSS track rows on the feed page (its Tracks and Downloaded sections share one renderer) and on the
Library's Tracks chip pass it too. It opens plan 38's `AddByRssTrackDetail`. The row tap still
plays.

**R28, R54.** Rows get a More menu built by `HomeFeedRow` from handlers, using plan 30's actions.
`HomeFeedRow` adds Add to Playlist and Mark as Played whenever their handlers are passed, for
tracks as well as episodes, so track rows get them by passing the same two handlers:

| Row             | More                                                              |
| --------------- | ----------------------------------------------------------------- |
| Podcast episode | Queue Next, Queue Last, Add to Playlist, Mark as Played, Download |
| Music track     | Go to Track and the five above                                    |

Track rows offer more than the album track row (Queue Next, Queue Last, Download, Go to Track):
the operator asked for Add to Playlist and Mark as Played on Add by RSS tracks (R54). Plan 30's
actions take the medium from the item, so a track goes to a music playlist and music history. No
Share (Add by RSS pages are not shareable).

Home's Add by RSS rows (plan 41) keep Home's own action set; this plan covers the feed page and
the Add by RSS library chips only.

**Active-row pause chrome is not added.** An Add by RSS playback target reports the feed's
`idText` as its media id (`playbackTargetRowMediaId` returns `resourceData.id_text`, which
`toAddByRssItemPlaybackResourceData` sets to the feed record's `idText`). Row ids never equal it,
so no row shows pause or progress, which is today's behavior. Fixing it means changing that shared
helper, which the queue screen and `PlaybackProvider` also call; it stays out of this set.

## Files

| File                                                      | Change                            |
| --------------------------------------------------------- | --------------------------------- |
| `src/screens/home/HomeFeedRow.tsx`                        | Optional `playTestID` prop        |
| `src/screens/home/addByRss/AddByRssEpisodesSection.tsx`   | Row and its renderer hook         |
| `src/screens/home/addByRss/AddByRssDownloadedSection.tsx` | Render the sheet (plan 21)        |
| `src/screens/rss/AddByRssRootScreen.tsx`                  | Item rows open the page, get More |
| `e2e/add-by-rss.yaml`                                     | Row opens the page; More menu     |

All paths are under `apps/mobile/`. The renderer hook is plan 21's
`useAddByRssEpisodeRowRenderer`.

## Implementation

### `HomeFeedRow.tsx`

Add an optional prop after `testID`:

```typescript
/** Play button testID in the default action band; defaults to `home-row-play-${row.id}`. */
playTestID?: string;
```

Destructure it and use `playTestID={playTestID ?? `home-row-play-${row.id}`}` on the default
band's `MediaRowActions`. Nothing else in the row changes; keep plan 10's props and styles.

### `AddByRssEpisodesSection.tsx`

`AddByRssEpisodeRow` props become:

```typescript
type AddByRssEpisodeRowProps = {
  index: number;
  isMusicFeed: boolean;
  itemLastSeenAtMs: number | null | undefined; // keep plan 10's prop and type as they are
  onAddToPlaylist: (row: HomeFeedRowData) => void;
  onGoToTrack: (row: HomeFeedRowData) => void;
  onMarkAsPlayed: (row: HomeFeedRowData) => void;
  onOpen: (row: HomeFeedRowData) => void;
  onPlay: (row: HomeFeedRowData) => void;
  onQueue: (row: HomeFeedRowData, position: QueueActionPosition) => void;
  row: AddByRssHomeEpisode;
};
```

Delete `noopQueuePress`, the `customActions` memo, and the `MediaRowActions` import if unused.
Render one `HomeFeedRow`:

- Common: `downloadItem={row.downloadItem ?? undefined}`,
  `downloadTestID={`add-by-rss-home-download-${index}`}`, `itemLastSeenAtMs`,
  `onAddToPlaylistPress={onAddToPlaylist}`, `onMarkAsPlayedPress={onMarkAsPlayed}`,
  `onPlayPress={onPlay}`, `onQueuePress={onQueue}`, `row`, `showChannelContext={false}`,
  `testID={`add-by-rss-home-episode-${row.id}`}`.
- Podcast feed (`!isMusicFeed`): `mediaType="episodes"`, `onPress={onOpen}`,
  `playTestID={index === 0 ? 'add-by-rss-home-play-first' : `add-by-rss-home-play-${row.id}`}`.
- Music feed: `mediaType="tracks"`, `onGoToTrackPress={onGoToTrack}`, `onPress={onPlay}`; no
  play testID (track rows have no play button).

`useAddByRssEpisodeRowRenderer` (plan 21) keeps its inputs and gains actions:

- `const rowsById = useMemo(() => new Map(detail.episodeRows.map((row) => [row.id, row])),
  [detail.episodeRows])`.
- A private `toTarget(row)` returns `{ feed: detail.feed, itemBundle, itemIndex, mappedFeed }` for
  the episode found by `row.id`, or `null` when the row is missing or `detail.mappedFeed` is
  `null`.
- `const { actionNoticeKey, addToPlaylist, addToPlaylistSheet, markAsPlayed, queue } =
  useAddByRssItemActions();` (plan 30).
- Stable `useCallback` handlers: `handleQueue(row, position)`, `handleAddToPlaylist(row)`,
  `handleMarkAsPlayed(row)` (each resolves the target, then calls the action), and
  `handleOpen(row)`:

```typescript
const episode = rowsById.get(row.id);
if (episode === undefined) {
  return;
}
navigation.navigate('AddByRssEpisodeDetail', {
  feedIdText: detail.feed.idText,
  itemKey: episode.itemKey,
});
```

  with `navigation = useNavigation<NativeStackNavigationProp<AddByRssDetailStackParamList>>()`
  (type from plan 33's `addByRssStackParams.ts`). `handleGoToTrack(row)` is the same lookup,
  navigating to `'AddByRssTrackDetail'` (plan 38) with the same two params. The existing play
  handler stays as is.
- Return `{ addToPlaylistSheet, noticeKey: actionNoticeKey ?? <existing playback notice>,
  renderRow }`; `renderRow` passes `isMusicFeed` and the handlers to `AddByRssEpisodeRow`.
- `AddByRssEpisodesSection` and `AddByRssDownloadedSection` render `addToPlaylistSheet` once, after
  their `PodcastSectionList` (wrap in a fragment).

### `AddByRssRootScreen.tsx`

Anchors: `function LibraryFeedListItem`, `const handleRowPress`, `const handlePlayPress`, the
`renderItem` callback that computes `isItemChip`, and the `rss-playback-notice` text.

- `LibraryFeedListItem` gains optional `downloadItem?: DTOItem`, `onAddToPlaylist?`,
  `onGoToTrack?` (as `onGoToTrackPress`), `onMarkAsPlayed?`, and `onQueue?` (same signatures as
  above), passed to `HomeFeedRow`;
  `onQueuePress={onQueue ?? noopQueuePress}`. Pass `downloadTestID={`rss-item-download-${index}`}`
  when `downloadItem` is set (add an `index` prop from `renderItem`).
- `handleRowPress`: for `selectedMediaType === 'episodes'`, look up `itemRowsById.get(row.id)` and
  `navigation.navigate(LIBRARY_STACK_ROUTES.AddByRssEpisodeDetail, { feedIdText: item.feed.idText,
  itemKey: item.itemKey })`. `'tracks'` keeps playing. Channel chips are unchanged.
- `handleGoToTrack(row)`: the same lookup, then `navigation.navigate(
  LIBRARY_STACK_ROUTES.AddByRssTrackDetail, { feedIdText: item.feed.idText, itemKey:
  item.itemKey })`. `renderItem` passes it as `onGoToTrack` on the `'tracks'` chip only.
- Add `useAddByRssItemActions()`. Handlers resolve `{ feed, itemBundle, itemIndex, mappedFeed }`
  from `itemRowsById.get(row.id)`.
- In `renderItem`, for both item chips (`'episodes'` and `'tracks'`) pass
  `downloadItem={item.downloadItem ?? undefined}`, `onAddToPlaylist`, `onMarkAsPlayed`, and
  `onQueue`. Channel chips pass none of them. Add the new handlers to that callback's dependency
  list.
- The notice text shows `actionNoticeKey ?? playbackNoticeKey`. Render `addToPlaylistSheet` once
  inside the root `View`, after the list.

## Tests

No unit test: the logic is handler wiring in React Native components; plan 30's hook and plan 33's
data helpers carry the unit coverage.

Maestro `e2e/add-by-rss.yaml`. Insert after `- takeScreenshot: add-by-rss-library-detail` and
before the `add-by-rss-home-play-first` tap, so the mini player does not yet show this episode's
title:

```yaml
# Tapping the row opens the episode page; only the play button plays.
- tapOn:
    id: "home-feed-row-title-.*"
    text: E2E Add-by-RSS Episode
- extendedWaitUntil:
    visible:
      id: add-by-rss-episode-detail-screen
    timeout: ${TIMEOUT_SLOW}
- assertVisible:
    id: add-by-rss-episode-detail-title
    text: E2E Add-by-RSS Episode
- assertVisible:
    id: add-by-rss-episode-detail-podcast-title
- assertVisible:
    id: add-by-rss-episode-detail-summary
- tapOn:
    id: "home-row-more-.*"
- extendedWaitUntil:
    visible:
      id: "media-row-menu-.*"
    timeout: ${TIMEOUT_FASTER}
- assertVisible:
    id: "media-row-action-queue-next-.*"
- assertVisible:
    id: "media-row-action-add-to-playlist-.*"
- assertVisible:
    id: "media-row-action-mark-as-played-.*"
- assertNotVisible:
    id: "media-row-action-share-.*"
- takeScreenshot: add-by-rss-episode-detail-more-menu
- tapOn:
    id: "media-row-menu-.*-cancel"
- takeScreenshot: add-by-rss-episode-detail
- runFlow: shared/stack-back.yaml
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-play-first
    timeout: ${TIMEOUT_SLOW}
```

The existing play step that follows proves the play button still plays from the list (R25).
Do not assert the Download action: whether the fixture enclosure is downloadable is not under test
here. Track rows (R54, R65) get no step in this flow: plan 39 adds a music fixture and
`e2e/add-by-rss-track.yaml`, which opens Go to Track from the Library's Tracks chip and proves a
track row tap plays.

## Release scratchpad

```markdown
## Mobile Add by RSS rows open the episode, show duration, and have More

- Surfaces: mobile
- Change: On an Add by RSS feed page and the Add by RSS library's Episodes chip, tapping an
  episode row opens its episode page instead of playing; the play button still plays. Rows on the
  feed page now show the episode duration beside play. Every Add by RSS episode and music track
  row has a More menu with Queue Next, Queue Last, Add to Playlist, Mark as Played, and Download.
  Tracks go to music playlists and music history. A track row tap still plays, and its More menu
  also has Go to Track, which opens the track's page. Rows also get the one-tap download button
  podcast episode rows have.
- Who notices: anyone who adds feeds by RSS on the phone
- Operator steps: none
```
