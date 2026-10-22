**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 51 — Mini player shows what another device is playing

When another of the member's devices is playing, the mini player shows that device's item, its
progress, and "Playing on {device}". Its play button pauses and resumes that device. The mini player
appears even when the phone has nothing loaded itself, and the tab layout reserves its height in
that case too.

Before editing, confirm plan 50's `useCrossDevicePlayerDisplay`, `useRemotePlaybackPositionSeconds`,
`usePlaybackDeviceLabel`, and `remotePlaybackStatusLabelKey` exist, and that plan 34 routes the
session context's `pause` and `resume` (`routedPause`, `routedResume` in `PlaybackProvider.tsx`).
If not, stop and report.

## Rows

R5, R7, R17, R47, R59, R65

## Runs after

50, 34

## Files

apps/mobile/src/components/player/MiniPlayer.tsx
apps/mobile/src/components/player/MiniPlayerRemote.tsx
apps/mobile/src/components/player/useMiniPlayerVisible.ts
apps/mobile/src/components/player/NowPlayingSegmentBar.tsx
apps/mobile/src/navigation/useBottomChromeOverlayInsetSource.ts

## Decisions this plan fixes

- **Subtitle while remote.** The second line reads "Playing on {device}" (or "Paused on" /
  "Starting on") in place of the channel title. It is status text, so it uses
  `themeStyles.textSecondary.color`, not the link color the channel title uses. The weight, size,
  and nudge stay the same, so the row does not move.
- **Livestream (R17, R47).** A live remote item shows the title, the status line, and play/pause.
  The progress edge stays at its height with an empty fill.
- **Progress (R5).** The edge fills from the remote position estimate, updated once per second
  while the other device plays. It freezes while paused.
- **No segment strip while remote.** The now-playing segment strip (clip, chapter) describes this
  phone's item, so it hides while the player shows another device.
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

- Add `const display = useCrossDevicePlayerDisplay();` and `const deviceLabel =
  usePlaybackDeviceLabel();`. `const remote = display.kind === 'remote' ? display : null;`
- Replace the early return with: return null when `remote === null && (activeTarget === null ||
  nowPlaying === null)`.
- Progress: `remote !== null ? <MiniPlayerRemoteProgress durationSeconds={remote.durationSeconds}
  isLive={remote.isLive} /> : <MiniPlayerProgress />`.
- Artwork: `remote !== null ? <MiniPlayerRemoteArtwork accessibilityLabel={…same label…}
  imageUrl={remote.resource.image_url} /> : <MiniPlayerArtwork … />`.
- Title: `remote?.resource.title ?? nowPlaying.title` inside the same `MarqueeText`
  (`mini-player-title`). Narrow with an explicit branch rather than `!`; TypeScript needs
  `nowPlaying` non-null on the local branch.
- Subtitle: when remote, `<Text numberOfLines={1} style={[styles.subtitle, styles.remoteStatus]}
  testID="mini-player-remote-status">{t(remotePlaybackStatusLabelKey(remote.status), { device:
  deviceLabel(remote.activeDevice) })}</Text>`, where `remoteStatus` sets only `color:
  themeStyles.textSecondary.color`. Local keeps the channel title exactly as now.
- Transport: `state={remote !== null ? remote.transportState : transportState}`. `handlePlay` and
  `handlePause` stay as they are; plan 34 routes `resume` and `pause` to the other device.
  `handleErrorPress` is unchanged (a remote state never has the `error` transport state).
- Update the doc comment: the mini player shows this phone's session, or another device's playback
  when the cross-device display says so.

## `useBottomChromeOverlayInsetSource.ts`

Replace `miniPlayerOverlayHeight(activeTarget !== null && nowPlaying !== null)` with
`miniPlayerOverlayHeight(useMiniPlayerVisible())` (call the hook at the top with the others), and
drop the `usePlaybackSession` import when nothing else uses it.

## `NowPlayingSegmentBar.tsx`

Anchor: `export function NowPlayingSegmentBar`. Read `useCrossDevicePlayerDisplay()`. When
`display.kind === 'remote'`, treat the segment as absent: the value the component computes from
`resolveNowPlayingSegment` becomes null before the `useLayoutEffect` that calls
`setNowPlayingSegmentStripVisible`, so the strip reports itself hidden and renders nothing. Keep the
hook order unconditional.

## Tests

No new unit test: the visibility and display rules are plan 50's tested selectors, and this plan
is layout glue. Plan 57's Maestro flow asserts `mini-player`, `mini-player-title`, and
`mini-player-remote-status` with another device playing and nothing loaded on the phone.

## Release scratchpad

```markdown
## Mobile mini player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the mini player shows that item, its
  progress, and "Playing on {device}" (or Paused / Starting), even when nothing is loaded on the
  phone. Play and pause act on that device. Livestreams show the title, the status line, and
  play/pause with no progress. The clip and chapter strip hides while the mini player shows another
  device.
- Who notices: members signed in on more than one device
- Operator steps: none
```
