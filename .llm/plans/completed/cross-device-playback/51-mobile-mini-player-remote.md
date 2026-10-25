**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 51 — Mini player shows what another device is playing

When another of the member's devices is playing, the mini player shows that device's item, its
progress, and "Playing on {device}". Its play button pauses and resumes that device. The mini player
appears even when the phone has nothing loaded itself, and the tab layout reserves its height in
that case too. The segment strip above it names the chapter the other device is in. While a
transfer is on its way to another device, the second line reads "Sending to {device}…".

This plan also makes `useNowPlayingChapters` follow the item the player shows, so the mini strip
here and the full player band in plan 55 read the remote item's chapters from one place.

Before editing, confirm plan 50's `useCrossDevicePlayerDisplay`, `useRemotePlaybackPositionSeconds`,
`usePlayerStatusText`, and `useDisplayedAddByRssResourceData` exist, and that plan 34 routes the
session context's `pause` and `resume` (`routedPause`, `routedResume` in `PlaybackProvider.tsx`).
If not, stop and report.

## Rows

R5, R7, R17, R47, R59, R65, R83, R90

## Runs after

50, 34

## Files

apps/mobile/src/components/player/MiniPlayer.tsx
apps/mobile/src/components/player/MiniPlayerRemote.tsx
apps/mobile/src/components/player/useMiniPlayerVisible.ts
apps/mobile/src/components/player/NowPlayingSegmentBar.tsx
apps/mobile/src/navigation/useBottomChromeOverlayInsetSource.ts
apps/mobile/src/playback/nowPlayingSegment.ts
apps/mobile/src/playback/nowPlayingSegment.test.ts
apps/mobile/src/playback/useNowPlayingChapters.ts

## Decisions this plan fixes

- **Status line on the second line (R90).** The second line reads `usePlayerStatusText(display)`
  in place of the channel title whenever it is non-null: "Playing on {device}", "Paused on
  {device}", or "Starting on {device}" while remote, and "Sending to {device}…" while a transfer
  is on its way, in the local display too. It is status text, so it uses
  `themeStyles.textSecondary.color`, not the link color the channel title uses. The weight, size,
  and nudge stay the same, so the row does not move. With a null status line, a local display
  keeps the channel title exactly as now.
- **Livestream (R17, R47).** A live remote item shows the title, the status line, and play/pause.
  The progress edge stays at its height with an empty fill, and no segment strip shows.
- **Progress (R5).** The edge fills from the remote position estimate, updated once per second
  while the other device plays. It freezes while paused. The ratio's denominator is
  `display.durationSeconds`, which plan 50 sets from `state.duration_seconds`, the playing
  device's length (plan 11). This phone's duration store is never read on the remote path.
- **Segment strip while remote (R83).** The strip shows while the player shows another device. It
  names the chapter of the remote item at the remote position estimate (plan 11's
  `estimatePlaybackPositionSeconds`, read through plan 30's
  `getCrossDevicePlaybackPositionSeconds`). The status line stays on the mini player's second
  line; the strip is its own bar above the mini player, so the two never share a line.
- **Where the remote item's chapters come from (R83).** `useNowPlayingChapters` picks one item for
  every caller. While the display is remote: an `item` reference loads chapters by its
  `item_id_text` through the same `segmentsRepository.getChaptersByItemIdText` call and
  single-entry cache the local player uses; an `add_by_rss` reference reads the sections of the
  phone's own copy of that item (`useDisplayedAddByRssResourceData`, plan 50), and has none when
  the phone lacks the feed. Clip and soundbite references show no strip: the summary carries no
  clip range, and the mini player title already names the clip. A live item shows none.
- **Video.** While remote, the mini player shows the shared item's image, never this phone's video
  surface.

## `useMiniPlayerVisible.ts`

```typescript
/** True when the mini player draws: this phone has a session, or another device's playback shows. */
export function useMiniPlayerVisible(): boolean;
```

`usePlaybackSession()` for `activeTarget` and `nowPlaying`, and `useCrossDevicePlayerDisplay()`.
Return `display.kind === 'remote' || (activeTarget !== null && nowPlaying !== null)`.

## `MiniPlayerRemote.tsx`

Two leaf components, so the mini player shell stays off the once-per-second path:

- `MiniPlayerRemoteProgress({ durationSeconds, isLive }: { durationSeconds: number | null; isLive:
  boolean })`. Reads `useRemotePlaybackPositionSeconds()`. Ratio: 0 when `isLive`, when
  `durationSeconds` is null or not above 0, or when the position is null; else
  `clampRatio(position / durationSeconds)` (`@podverse/helpers/math`). Render the same
  `ProgressTrack` as `MiniPlayerProgress` (`flush`, height `MINI_PLAYER_PROGRESS_EDGE_HEIGHT`) with
  `fillTestID="mini-player-progress"`.
- `MiniPlayerRemoteArtwork({ accessibilityLabel, imageUrl }: { accessibilityLabel: string;
  imageUrl: string | null })`. A `CoverImage` with `opensViewer={false}`, sized
  `MINI_PLAYER_ARTWORK_SIZE` square, `uri={imageUrl}`. No `PodverseVideoSurfaceView`.

## `MiniPlayer.tsx`

Anchor: `export function MiniPlayer`.

- Add `const display = useCrossDevicePlayerDisplay();` and `const statusText =
  usePlayerStatusText(display);`. `const remote = display.kind === 'remote' ? display : null;`
- Replace the early return with: return null when `remote === null && (activeTarget === null ||
  nowPlaying === null)`.
- Progress: `remote !== null ? <MiniPlayerRemoteProgress durationSeconds={remote.durationSeconds}
  isLive={remote.isLive} /> : <MiniPlayerProgress />`.
- Artwork: `remote !== null ? <MiniPlayerRemoteArtwork accessibilityLabel={…same label…}
  imageUrl={remote.resource.image_url} /> : <MiniPlayerArtwork … />`.
- Title: `remote?.resource.title ?? nowPlaying.title` inside the same `MarqueeText`
  (`mini-player-title`). Narrow with an explicit branch rather than `!`; TypeScript needs
  `nowPlaying` non-null on the local branch.
- Subtitle: when `statusText !== null`, `<Text numberOfLines={1} style={[styles.subtitle,
  styles.remoteStatus]} testID="mini-player-remote-status">{statusText}</Text>`, where
  `remoteStatus` sets only `color: themeStyles.textSecondary.color`. Otherwise the channel title
  exactly as now.
- Transport: `state={remote !== null ? remote.transportState : transportState}`. `handlePlay` and
  `handlePause` stay as they are; plan 34 routes `resume` and `pause` to the other device.
  `handleErrorPress` is unchanged (a remote state never has the `error` transport state).
- Update the doc comment: the mini player shows this phone's session, or another device's playback
  when the cross-device display says so.

## `useBottomChromeOverlayInsetSource.ts`

Replace `miniPlayerOverlayHeight(activeTarget !== null && nowPlaying !== null)` with
`miniPlayerOverlayHeight(useMiniPlayerVisible())` (call the hook at the top with the others), and
drop the `usePlaybackSession` import when nothing else uses it.

## `nowPlayingSegment.ts`

Add, after `resolveNowPlayingSegment`:

```typescript
/** The chapter another device is in, by its estimated position; null when there is none to name. */
export const resolveRemoteNowPlayingSegment = ({
  chapters,
  isLive,
  positionSeconds,
  previewPositionSeconds = null,
  refKind,
}: {
  chapters: DTOItemChapter[];
  isLive: boolean;
  positionSeconds: number | null;
  previewPositionSeconds?: number | null;
  refKind: DTOPlaybackResourceRef['kind'];
}): NowPlayingSegment | null;
```

Null when `isLive`, when `refKind` is `clip` or `soundbite`, or when both the preview and the
position are null. Else `selectItemChapterForTime(chapters, previewPositionSeconds ??
positionSeconds)` through the same `named('chapter', …)` call the local path uses, so the title,
times, and web URL are built the same way. `DTOPlaybackResourceRef` is a type-only import from
`@podverse/helpers/accountPlaybackStream`.

## `useNowPlayingChapters.ts`

Anchor: `export function useNowPlayingChapters()`.

- Read `const display = useCrossDevicePlayerDisplay();` and replace the inline Add by RSS
  expression with `const addByRssResourceData = useDisplayedAddByRssResourceData();`.
- `const remoteRef = display.kind === 'remote' ? display.resource.ref : null;`
- `const item = remoteRef === null ? itemFromTarget(activeTarget) : null;` (the description warm-up
  stays local only).
- `chaptersItemIdText`: when `remoteRef !== null`, `remoteRef.kind === 'item' && !display.isLive ?
  remoteRef.item_id_text : null`; else `item?.id_text ?? null` as now.
- The Add by RSS branch at the end returns the sections' chapters when `remoteRef?.kind ===
  'add_by_rss'`, or when `remoteRef === null && activeTarget?.kind === 'add-by-rss'`.
- Update the doc comment: chapters follow the item the player shows, which is another device's
  item while the phone shows that device.

`useActiveNowPlayingChapter` stays local; it is mounted only in local chrome.

## `NowPlayingSegmentBar.tsx`

Anchor: `export function NowPlayingSegmentBar`.

- Read `useCrossDevicePlayerDisplay()` and `useRemotePlaybackPositionSeconds()` unconditionally
  with the other hooks.
- `segment`: when `display.kind === 'remote'`, `resolveRemoteNowPlayingSegment({ chapters, isLive:
  display.isLive, positionSeconds: remotePosition, previewPositionSeconds, refKind:
  display.resource.ref.kind })`; else `resolveNowPlayingSegment` exactly as now.
- Everything after (`setNowPlayingSegmentStripVisible`, render, test ids) is unchanged, so the
  strip reports its presence and reserves bottom chrome the same way in both modes.
- Update the doc comment: the playhead is this phone's, or the other device's estimate while
  remote.

`useRemotePlaybackPositionSeconds` returns whole seconds, so the strip re-renders at most once a
second while remote, the same rate as the local `usePlaybackProgress` path.

## Tests

`nowPlayingSegment.test.ts`, new cases for `resolveRemoteNowPlayingSegment`:

- An `item` reference names the chapter at the position, and the preview wins over the position.
- `add_by_rss` names the chapter the same way.
- `clip` and `soundbite` give null even with chapters.
- A live item gives null; a null position with no preview gives null.

The visibility and display rules are plan 50's tested selectors; the rest is layout glue. Plan
57's Maestro flow asserts `mini-player`, `mini-player-title`, `mini-player-remote-status`, and
`now-playing-segment-title` with another device playing a chaptered episode and nothing loaded on
the phone.

## Release scratchpad

```markdown
## Mobile mini player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the mini player shows that item, its
  progress, and "Playing on {device}" (or Paused / Starting), even when nothing is loaded on the
  phone. Play and pause act on that device. The chapter strip above the mini player names the
  chapter the other device is in, from the phone's estimate of its position. Livestreams show the
  title, the status line, and play/pause with no progress or strip. While playback is being sent
  to another device, the second line reads "Sending to {device}…".
- Who notices: members signed in on more than one device
- Operator steps: none
```
