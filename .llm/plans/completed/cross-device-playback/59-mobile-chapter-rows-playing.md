**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 59 — Mobile chapter rows mark the chapter that is playing

A chapter list marks the chapter under the playhead when the list's episode is the one playing:
the full player's Chapters pane, the episode screen's Chapters tab, and the Add by RSS episode
screen's Chapters tab. The playhead is this phone's own, or, while another device plays, that
device's estimated position. Mobile has no such mark today, local or remote; web marks the
playing chapter's title (`ListItemChapterRow`, class `highlighted-text`), so this plan adds the
local mark for parity and the remote mark for R83 in one change.

Before editing, confirm these exist. If any is missing, stop and report:

- Plan 50: `selectRemoteRowMediaId` in
  `apps/mobile/src/playback/crossDevice/crossDevicePlayerDisplay.ts`.
- Plan 30: `getCrossDevicePlaybackView`, `subscribeCrossDevicePlaybackView`,
  `getCrossDevicePlaybackPositionSeconds`, and `subscribeCrossDevicePlaybackPositionClock` in
  `crossDevicePlaybackStore.ts`.
- `getPlaybackPositionClockSeconds` and `subscribePlaybackPositionClock` in
  `apps/mobile/src/playback/playbackProgressStore.ts`.
- `tokens.text.highlighted` in `@podverse/design-tokens` (the token web's
  `--text-color-highlighted` comes from).

## Rows

R83

## Runs after

50, 55

## Files

apps/mobile/src/playback/playingChapter.ts
apps/mobile/src/playback/playingChapter.test.ts
apps/mobile/src/playback/usePlayingChapterIdText.ts
apps/mobile/src/components/primitives/ListRow.tsx
apps/mobile/src/components/content/ChapterListRow.tsx
apps/mobile/src/components/content/ItemChapterRow.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx
apps/mobile/src/screens/home/AddByRssEpisodeDetailScreen.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **Local and remote both mark the row.** The review asked for the remote mark. A remote-only mark
  would light rows only while another device plays and never for the phone's own playback, so the
  local mark comes with it, matching web's local chapter list.
- **A separate plan from the row play state (plan 56).** Plan 56 changes which media row shows
  Pause. This is a new mark on chapter rows that also changes local playback, touches the
  full player after plan 55 does, and could ship on its own.
- **What the mark looks like.** The chapter title takes `tokens.text.highlighted`, the color web's
  `highlighted-text` uses, and the row reports `accessibilityState.selected`. Nothing else
  changes: no icon, no background, no layout shift.
- **Which chapter.** The same `selectItemChapterForTime` choice the strip and band use, at whole
  seconds. A local chapter target marks its own chapter, as `useActiveNowPlayingChapter` names it.
  A clip, an official clip, or a livestream marks nothing, locally or remotely. A remote position
  is plan 11's estimate through plan 30's clock; a live remote item has no position and marks
  nothing. The scrubber preview does not move the mark.
- **Render cost (mobile-row-render-cost).** Rows never subscribe to the clock. Each screen reads
  one primitive, the playing chapter's `id_text` or null, through `useSyncExternalStore`, so a
  screen re-renders only when the playing chapter changes, and each row gets `isPlaying` as a
  boolean prop.
- **The remote full player has no pane**, so while another device plays the mark shows on the
  episode screens only.

## `playingChapter.ts` (pure)

```typescript
export type PlayingChapterSource = {
  /** Row media id of the playing item, comparable with a screen's item id or Add by RSS hash. */
  mediaId: string;
  /** Set when the target is one chapter; that chapter is marked whatever the position. */
  chapterIdText: string | null;
};

/** What this phone's own target plays, in chapter terms; null for clips, official clips, livestreams. */
export function playingChapterSourceFromTarget(
  target: PlaybackTarget | null
): PlayingChapterSource | null;

export function selectPlayingChapterIdText(params: {
  chapters: readonly DTOItemChapter[];
  itemMediaId: string | null;
  positionSeconds: number | null;
  source: PlayingChapterSource | null;
}): string | null;
```

- `playingChapterSourceFromTarget`: exhaustive `switch` on `target.kind`, no `default`: `chapter` →
  `{ mediaId: target.item.id_text, chapterIdText: target.chapter.id_text }`; `item-podcast`,
  `item-video`, `item-music` → `{ mediaId: target.item.id_text, chapterIdText: null }`;
  `add-by-rss` → null when `isAddByRssLivestreamResourceData(target.resourceData)`, else `{
  mediaId: addByRssPlaybackMediaId(target.resourceData), chapterIdText: null }`; `clip`,
  `soundbite`, `livestream` → null. Null target → null.
- `selectPlayingChapterIdText`: null when `itemMediaId` or `source` is null, or when
  `source.mediaId !== itemMediaId`. Then `source.chapterIdText` when non-null. Then null when
  `positionSeconds` is null. Else `selectItemChapterForTime(chapters, positionSeconds)?.id_text ??
  null`.

## `usePlayingChapterIdText.ts`

```typescript
/** The `id_text` of the chapter playing in this list's item, or null. */
export function usePlayingChapterIdText(params: {
  chapters: readonly DTOItemChapter[];
  itemMediaId: string | null;
}): string | null;
```

- `remoteMediaId = useSyncExternalStore(subscribeCrossDevicePlaybackView, () =>
  selectRemoteRowMediaId(getCrossDevicePlaybackView()), same)`.
- `localSource = useMemo(() => playingChapterSourceFromTarget(activeTarget), [activeTarget])`,
  with `activeTarget` from `usePlaybackRow()`.
- When `remoteMediaId !== null`: source `{ mediaId: remoteMediaId, chapterIdText: null }`, subscribe
  `subscribeCrossDevicePlaybackPositionClock`, position `getCrossDevicePlaybackPositionSeconds(
  Date.now())` floored (null stays null). Otherwise: the local source, subscribe
  `subscribePlaybackPositionClock`, position `getPlaybackPositionClockSeconds()`.
- One `useSyncExternalStore` whose `subscribe` and `getSnapshot` are `useCallback`s over that
  choice, the source, `chapters`, and `itemMediaId`; the snapshot is
  `selectPlayingChapterIdText(…)`, a string or null.
- When `itemMediaId` is null, return null without subscribing to any clock (a `subscribe` that
  returns a no-op unsubscribe).

## `ListRow.tsx`

Add `isHighlighted?: boolean` to `ListRowProps`, documented as "Marks the row as the current one:
highlighted title color and the selected accessibility state." Add a `titleHighlighted` style with
`color: tokens.text.highlighted`, apply `[styles.title, styles.titleHighlighted]` when set, and pass
`accessibilityState={{ selected: true }}` on the row's root (the `View` or the `Pressable`) when
set. Unset renders exactly as today.

## `ChapterListRow.tsx` and `ItemChapterRow.tsx`

- `ChapterListRow` gains `isPlaying?: boolean`, passed to `ListRow` as `isHighlighted`. Update its
  doc comment: the playing chapter's title is highlighted.
- `ItemChapterRow` gains `isPlaying?: boolean` and passes it through.

## Screens

- **`FullPlayerScreen.tsx`** (anchor `<ChapterListRow` in the Chapters pane): after `const
  paneChapterRows =` (a `DTOItemChapter[]`), add `const playingChapterIdText =
  usePlayingChapterIdText({ chapters: paneChapterRows, itemMediaId: paneItemMediaId })`, where
  `paneItemMediaId` is `useMemo(() => playingChapterSourceFromTarget(activeTarget)?.mediaId ??
  null, [activeTarget])`. Pass `isPlaying={row.chapter.id_text === playingChapterIdText}` to each
  `ChapterListRow`, and add `playingChapterIdText` to whatever memo or callback renders the rows.
  The pane is hidden while remote (plan 55), so it shows only the local mark.
- **`EpisodeDetailScreen.tsx`** (anchor `const renderItem = useCallback(`): `const
  playingChapterIdText = usePlayingChapterIdText({ chapters: chapterRows, itemMediaId:
  episode?.id_text ?? null })`. Pass `isPlaying={row.chapter.id_text === playingChapterIdText}`
  to `ItemChapterRow`, add `playingChapterIdText` to the `renderItem` dependencies, and append it
  to the `FillList` `extraData` string.
- **`AddByRssEpisodeDetailScreen.tsx`** (anchor `const renderChapterRow = useCallback(`):
  `itemMediaId` is `addByRssPlaybackMediaId(toAddByRssItemPlaybackResourceData(feed, mappedFeed,
  episode.itemBundle, episode.itemIndex))` when `feed`, `mappedFeed`, and `episode` are non-null,
  else null, in a `useMemo`; that is the id the screen's Play compares in `useAddByRssPlayback`.
  Then the same hook over `chapterRows`, the `isPlaying` prop, the `renderChapterRow` dependency,
  and `playingChapterIdText` appended to the list's existing `extraData` string.

## `apps/mobile/vitest.config.ts`

Add `src/playback/playingChapter.test.ts` to `include` in alphabetical position, and one header
clause: "which chapter row is marked as playing (`src/playback/playingChapter.ts`)".

## Tests

`playingChapter.test.ts`:

- `playingChapterSourceFromTarget`: a chapter target gives its item id and chapter id; an item
  target gives the item id; an Add by RSS episode gives its hash; an Add by RSS livestream, a clip,
  a soundbite, a livestream, and null give null.
- `selectPlayingChapterIdText`: marks the chapter at the position when the ids match; null when
  they differ, when the source or item id is null, or when the position is null; a chapter source
  wins over the position; a position between chapters gives null.

Plan 57's Maestro flow asserts the selected chapter row on the episode screen while another device
plays it.

## Release scratchpad

```markdown
## Mobile chapter lists mark the playing chapter

- Surfaces: mobile
- Change: the full player's Chapters pane and the Chapters tab of an episode (directory and Add by
  RSS) now color the title of the chapter that is playing, and screen readers hear it as selected.
  While another of the member's devices plays that episode, the episode screens mark the chapter
  at that device's estimated position.
- Who notices: listeners of chaptered episodes; members signed in on more than one device
- Operator steps: none
```
