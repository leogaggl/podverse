**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 56 — List rows and the queue follow another device's playback

When another of the member's devices is playing, the row for that item shows as active, with the
pause icon while it plays. Tapping that row pauses or resumes the other device instead of starting
the item again. The queue screen hides the other device's now-playing row the way it hides this
phone's.

Before editing, confirm plan 50's `usePlaybackRowDisplay` exists and that plan 34 routes the row
context's `pause` and `resume` and the session context's `pause` and `resume`. If not, stop and
report.

## Rows

R65

## Runs after

50, 34

## Files

apps/mobile/src/components/player/MediaRowActions.tsx
apps/mobile/src/screens/home/useHomeRowPlayback.ts
apps/mobile/src/hooks/useAddByRssPlayback.ts
apps/mobile/src/screens/library/LibraryQueueScreen.tsx

## Decisions this plan fixes

- **Which views show remote state (R65).** Mini player (plan 51), full player (plan 55), list rows
  and the queue (this plan). The lock screen, the media notification, CarPlay, and Android Auto keep
  showing only this phone's own player: they read the native session and native cache, and pressing
  play there plays on the phone and takes playback over (plan 34). Area E changes nothing native.
- **Rows toggle the other device.** A tap on the active remote row sends pause or play to the other
  device, the same as the mini player's button. A tap on any other row is an item pick, which
  plan 34 sends as `play_item`.
- **No inline progress for a remote row.** The active row's thin progress track reads this phone's
  progress store. A remote active row shows the pause icon and no track.
- **What stays local.** The enclosure source picker and download enclosure selection
  (`MediaRowActions` `canOpenSourcePicker`, `HomeFeedRow`, `DownloadRowControl`,
  `EpisodePlayChrome`) and the stored-progress hook (`useEpisodeStoredProgress`) describe this
  phone's loaded media and keep reading `activeTarget`.

## `MediaRowActions.tsx`

Anchor: `MediaRowIconsLeading` (the block with `const { activeTarget } = usePlaybackRow();` and
`const isPlaying = usePlaybackIsPlaying();`, near line 551).

- Replace both reads with `const { activeMediaId, isPlaying, isRemote } = usePlaybackRowDisplay();`
  and drop the local `activeMediaId` computation.
- `isActiveRow` and `showPauseIcon` keep their formulas over the new values.
- `MediaRowActiveProgress` renders only when `isActiveRow && !isRemote && showActiveProgress &&
  hasDuration`.
- Remove imports that become unused. The `MediaRowActions` component (near line 283) keeps
  `usePlaybackRow()` for the source picker.

## `useHomeRowPlayback.ts`

Anchor: `const runPlayAction = useCallback(`.

- Add `const { activeMediaId, isPlaying } = usePlaybackRowDisplay();` and remove
  `usePlaybackIsPlaying()` and `activeTarget` from the `usePlaybackRow()` destructure when nothing
  else uses them.
- Inside, replace `const activeMediaId = activeTarget !== null ? playbackTargetRowMediaId(activeTarget)
  : null;` with the hook's value. The toggle branch (`pause()` / `await resume()`) and the pick
  branch (`playClipById` / `playItemById`) stay as they are.
- Dependencies: `[activeMediaId, isPlaying, pause, playClipById, playItemById, resume]`.

## `useAddByRssPlayback.ts`

Anchor: `const playLoadedResource = useCallback(`.

- Same change: `usePlaybackRowDisplay()` for `activeMediaId` and `isPlaying`, replacing
  `usePlaybackIsPlaying()` and the `activeTarget`-derived id. Keep `pause`,
  `playAddByRssResourceData`, and `resume` from `usePlaybackSession()`. A remote Add by RSS item's
  row id is its `add_by_rss_hash_id`, which equals `addByRssPlaybackMediaId(resourceData)`.
- Dependencies updated to match.

## `LibraryQueueScreen.tsx`

Anchor: `const playingContentId = activeTarget === null ? null : playbackTargetRowMediaId(activeTarget);`.

- Replace with `const { activeMediaId: playingContentId } = usePlaybackRowDisplay();`.
- Keep `activeTarget` in the `usePlaybackSession()` destructure only if something else in the file
  still reads it; keep `playQueueResourceFromQueue` (plan 34 routes it).

## Tests

No new unit test: the remote row id and is-playing selectors are plan 50's tested functions, and
these edits swap one hook for another. Plan 57's Maestro flow checks a row's pause icon while the
other device plays.

## Release scratchpad

```markdown
## Mobile lists follow another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, that item's row in episode, clip, track, and
  Add by RSS lists shows the pause icon, and tapping it pauses or resumes that device instead of
  restarting the item here. The queue screen hides the other device's now-playing item from the
  upcoming list. The lock screen, media notification, CarPlay, and Android Auto still show only the
  phone's own player.
- Who notices: members signed in on more than one device
- Operator steps: none
```
