**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 23 — Web: the audio tab obeys playback commands, and reports starts that fail

When another device (or another tab of this browser) sends `play`, `pause`, `seek`, `set_rate`,
`play_item`, `next`, or `previous`, the web tab holding audio carries it out (R10, R27). A
livestream pauses through the same path (R50). `next` and `previous` run this tab's own Next and
Previous button click handlers on this tab's own queue, exactly as a click there would (R77). A
commanded position that lands at or past the end of the file this tab loaded starts 5 s before
that file's end instead (R84). Only this tab fires playback events for what it plays (R87).

When a start this tab was asked to make cannot begin (the browser blocks audio without a tap, or
the media fails to load), the tab reports it so the sender can show it, and shows a tap-to-play
prompt (the prompt's visuals are area D's).

`take_over` is plan 24's. This plan ignores it, but owns the start-failure reporting, the
tap-to-play state, the loader, and the file-end clamp seam that plan 24 reuses.

Before editing, confirm plans 22 and 27 have landed (`apps/web/src/contexts/CrossDevicePlayback.tsx`,
`crossDevicePlaybackStore.subscribeToSignals`, `setPendingCommandStart`, `setTapToPlay`,
`notifyLocalPlayRejected`, and `clampCommandStartToFileEnd` exported from
`@podverse/playback-core`). If not, stop and report.

## Rows

R10, R27, R50, R77, R84, R87

## Runs after

22, 27

## Files

apps/web/src/lib/crossDevicePlayback/playbackCommandInbox.ts
apps/web/src/lib/crossDevicePlayback/playbackCommandInbox.test.ts
apps/web/src/lib/crossDevicePlayback/reportPlaybackStartFailed.ts
apps/web/src/lib/crossDevicePlayback/commandStartSeek.ts
apps/web/src/lib/crossDevicePlayback/commandStartSeek.test.ts
apps/web/src/lib/playback/index.ts
apps/web/src/hooks/usePlaybackResourceLoader.ts
apps/web/src/hooks/useCrossDevicePlaybackCommandExecutor.ts
apps/web/src/hooks/useMediaElementBridge.ts
apps/web/src/hooks/__tests__/useMediaElementBridge.test.tsx
apps/web/src/hooks/useTrackNextButtonActions.ts
apps/web/src/hooks/useTrackPreviousButtonActions.ts
apps/web/src/contexts/MediaPlayerControls.tsx
apps/web/src/contexts/CrossDevicePlayback.tsx
apps/web/src/components/CrossDevicePlayback/CrossDevicePlaybackTrackCommands.tsx
apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx
apps/web/src/components/MediaPlayer/Controller/MediaPlayerControllerLiveStreamAV.tsx

## Decisions this plan fixes

- **Who obeys.** Only the tab that holds audio (`thisTabHoldsAudio`) for the command's target
  session. Every other tab of that session receives the same event and ignores it. A tab with only
  a claim in flight does not obey.
- **Dedupe and freshness.** An inbox remembers the last 200 `command_id`s and ignores repeats.
  A command is dropped when it cannot start within `PLAYBACK_COMMAND_TTL_MS` of this tab's receive
  time (`receivedAtMs` from plan 20). Never compare with `issued_at_ms` or `expires_at_ms`; those
  are server clock.
- **Live.** Ignore a command that plan 11's `isPlaybackCommandAllowed(type, { isLive })` rejects
  for the loaded resource (`isPlayerResourceLive` from plan 21). `pause` and `play` are allowed and
  go through `setMPIsPlaying`, which `MediaPlayerControllerLiveStreamAV` already follows. `next`
  and `previous` are allowed for a live item and do what the local buttons do for one (below).
- **`set_rate`** snaps to the nearest web speed with plan 21's `nearestPlaybackSpeedValue`.
- **`play_item` with `start_seconds: null`** plays from the saved position (the normal load path,
  including its existing near-end restart), or the live point for a live item.
- **`next` and `previous` (R77) run this tab's own click handlers.** The playing tab calls
  `runLocalClick` from `useTrackNextButtonActions` and `useTrackPreviousButtonActions`: the
  same function a click on its own `TrackNextButton` or `TrackPreviousButton` runs, with no
  pointer or long-press state. So a remote Next or Previous:
  - with episode chapters loaded, moves to the next or previous chapter
    (`seekToAdjacentChapter`), as a click there does;
  - otherwise, Next moves now-playing to history and loads the next item of this tab's server
    queue (`useQueueResourcesMoveNowPlayingToHistory`, `useQueueResourcesLoadActive`), or the
    next Add by RSS item from its list context (`useAddByRSSPlayNext`);
  - Previous restarts the item when this tab's playhead is past 3 s, else loads the previous item
    (auto-queue row, playlist, pub date or season, or the previous Add by RSS item);
  - keeps playing or paused as this tab was (`setMPShouldPlay(mpIsPlaying)`, `shouldPlay:
    mpIsPlaying`);
  - for a live item does what a click does: Next advances the queue and Previous loads the
    previous item (a live item's playhead stays under the 3 s threshold).
  There is no long-press variant on the wire; the long-press action (skip a whole track while
  chapters are loaded) stays local-only. The command carries nothing about the sender's queue;
  the playing tab's queue is the only one consulted. Two `next` commands advance twice, as two
  clicks would.
- **Next and Previous run in a headless component.** `useTrackPreviousButtonActions` and
  `useEpisodeChapterNavigation` read `mpCurrentTime`, which changes on every time update.
  Calling them in the provider would re-render the provider on every tick, so a headless
  `CrossDevicePlaybackTrackCommands` component (rendered by the provider beside plan 22's
  publisher) calls both hooks and handles `next` and `previous` with its own inbox, the same way
  plan 24's transfer hook handles `take_over`. The executor ignores both types.
- **The file-end clamp (R84).** A commanded position is the playing device's position in its
  own file. This tab's copy of the same item can be shorter (dynamic ad insertion), so the
  position may land at or past the end of the file this tab loaded. Every commanded position
  goes through plan 27's `clampCommandStartToFileEnd({ seconds, fileDurationSeconds })`, with
  `fileDurationSeconds` the duration of the media element in this tab:
  - kept as is below that duration, including the last 5 s (a commanded position is not a
    finished saved position, so the near-end restart to 0 does not apply);
  - at or past it, `max(0, duration − 5)`;
  - kept as is when the file reports no usable duration (NaN, Infinity, 0), because then there is
    no end to land past.
  The positions it applies to: `seek`; `play_item` with a non-null `start_seconds`; and plan 24's
  `take_over` and "This device" starts (they go through this plan's loader). `play_item` with a
  null start, and a take-over whose estimate is null, load the saved position through the normal
  path and are not commanded positions.
- **When the duration is known.** The element's own duration exists only once it has metadata
  (`readyState >= 1`; the `loadedmetadata` event). `mpDuration` is not used: before metadata it
  can hold a hint (Add by RSS `resourceData.duration`, the abridged queue row, the hydrated
  snapshot) that is not this file's length.
  - **A position for a new load** (`play_item`, take-over): the file is never loaded when the
    command lands. The loader stages the position (`stageCommandStartSeek`), and
    `NonLiveMediaOrchestrator`'s `onLoadedMetadata(newDuration)` takes it and seeks to the
    clamped value in place of the load decision's initial seek. That is the first moment the
    duration is known, and it is before playback starts, so the item never seeks past its end.
  - **A `seek` on the loaded file**: when the bridge reports a duration
    (`controls.readDurationSeconds()` returns a number or `null`), clamp and seek at once. When it
    returns `undefined` (metadata not loaded yet), stage the position for the loaded item's ref
    and show it (`setMPCurrentTime`); `onLoadedMetadata` applies the clamped value when the
    duration arrives. Do not call `controls.seek` before metadata: the element would keep the
    raw position and could end the item as soon as it loads.
  - A staged position applies only to a load of the same resource ref, and only within
    `COMMAND_START_SEEK_MAX_AGE_MS` (30 s) of staging; a newer stage replaces it. The
    `PLAYBACK_COMMAND_TTL_MS` freshness check still governs whether a command starts at all;
    the staged seek may land later than that, when the file's metadata arrives.
  - A commanded start wins over the decision's initial seek for every target kind, including a
    music item, whose explicit play otherwise starts at 0.
- **Only the playing tab fires playback events (R87).** This is plan 11's contract rule; on web:
  - End reached (`onEnded`), auto-advance, history moves, now-playing and position writes, Add by
    RSS position saves, the anonymous and handoff snapshots, and play stats come only from the
    tab whose role is `active`, from its own media element, exactly as with no other device.
  - A tab in the `remote` role fires none of them: plan 22's stop effect clears its player (no
    loaded media, so no `timeupdate`, `ended`, or `loadedmetadata`), and its write guards block
    the save hooks. The executors in this plan act only while `thisTabHoldsAudio`.
  - The remote view (area D) is display only. It reads the duration for the bar, duration label,
    segment strip, and chapter highlight only from `displayState.duration_seconds`, never from
    `mpDuration` or the local file. Reaching that duration in the estimate fires nothing; the
    view waits for the playing device's next state.
  - The shared `duration_seconds` is the playing tab's own file length: plan 22's publisher
    sends `mpDuration`, which the orchestrator sets from the element at `loadedmetadata`.
- **Auto-advance needs no change.** At the end of an item, `NonLiveMediaOrchestrator`'s
  `onEnded` calls `queueResourcesLoadActive()`, which fetches the queue from the server before
  choosing the next item, so a "play next" another device added is honored. Do not edit
  `onEnded`.
- **Start reporting window.** After obeying `play` or `play_item` (and plan 24's `take_over`), the
  tab records the command as a pending start for 15 s. Within that window:
  - a `local_play_blocked` signal (the browser refused `play()` with `NotAllowedError`) → report
    `autoplay_blocked`, `setMPIsPlaying(false)`, and set `tapToPlay` to that command;
  - `mpPlaybackError` turning non-null → report `load_failed`;
  - a `play_item` whose resource cannot be resolved, or whose resolution outlasts the TTL →
    report `load_failed`.
  Reports are fire-and-forget; errors are ignored (the command record may have expired).
  `next` and `previous` are not starts and report nothing; a load they trigger fails the way a
  local click's would.
- **Tap-to-play.** `confirmTapToPlay()` clears `tapToPlay` and calls `setMPIsPlaying(true)`; area
  D calls it from the click handler so the browser sees the gesture. `dismissTapToPlay()` clears
  it, and when a claim is pending but this tab does not hold audio, calls `abandonClaim()` (the
  role then follows the server, and plan 22's stop effect clears a remote tab's player).
  `tapToPlay` older than 60 s is dismissed the same way.

## `playbackCommandInbox.ts`

```typescript
export function createPlaybackCommandInbox(options?: { capacity?: number }): {
  /** True the first time `commandIdText` is seen; false for a repeat. Evicts the oldest past capacity (default 200). */
  accept(commandIdText: string): boolean;
};
```

A `Map` or `Set` in insertion order is enough.

## `reportPlaybackStartFailed.ts`

```typescript
export function reportPlaybackStartFailed(commandIdText: string, reason: PlaybackStartFailedReason): void;
```

Calls `getApiRequestService().reqAccountPlaybackReportStartFailed({ commandIdText, body: { reason } })`
and swallows rejections (`.catch(() => {})` with a comment that the record may have expired).

## `lib/playback/index.ts`

Add `clampCommandStartToFileEnd` to the value re-export list from `@podverse/playback-core`
(beside `clampNearEndSeconds`). Web code imports it from `../lib/playback` (or the matching
relative path), as it does `clampNearEndSeconds`.

## `useMediaElementBridge.ts` and `MediaPlayerControls.tsx`

Add to the `MediaElementBridge` type, below `readCurrentTimeSeconds`:

```typescript
/**
 * The loaded file's duration. `undefined` when no element is mounted or it has no metadata yet
 * (`readyState < 1`); `null` when it reports no finite positive duration.
 */
readDurationSeconds: () => number | null | undefined;
```

Implementation beside `readCurrentTimeSeconds` (same `useCallback` on `mediaRef`): no element →
`undefined`; `media.readyState < 1` → `undefined`; `media.duration` finite and `> 0` → that value;
otherwise `null`. Add it to both the returned object and the `useMemo` dependency list.
`noopMediaElementBridge` in `MediaPlayerControls.tsx` gets `readDurationSeconds: () => undefined`.

## `commandStartSeek.ts`

Module-level state (one per tab), framework-free:

```typescript
import type { DTOPlaybackResourceRef } from '@podverse/helpers';

import type { MediaElementBridge } from '../../hooks/useMediaElementBridge';

export const COMMAND_START_SEEK_MAX_AGE_MS = 30_000;

/** Stages a commanded position for the next metadata load of `ref`; replaces any earlier stage. */
export function stageCommandStartSeek(params: { ref: DTOPlaybackResourceRef; seconds: number; nowMs: number }): void;

/**
 * For the file whose metadata just loaded: the staged position clamped to that file's end
 * (`clampCommandStartToFileEnd`), or null when nothing is staged for `ref` or the stage is older
 * than `COMMAND_START_SEEK_MAX_AGE_MS`. A returned value clears the stage; a different `ref`
 * leaves it staged (an older file can finish loading after a newer stage).
 */
export function takeCommandStartSeek(params: {
  ref: DTOPlaybackResourceRef | null;
  fileDurationSeconds: number;
  nowMs: number;
}): number | null;

export function clearCommandStartSeek(): void;

/** A commanded position on the file already loaded in this tab (see **When the duration is known**). */
export function applyCommandSeekToLoadedFile(params: {
  seconds: number;
  ref: DTOPlaybackResourceRef | null;
  controls: Pick<MediaElementBridge, 'seek' | 'readDurationSeconds'>;
  setMPCurrentTime: (seconds: number) => void;
  nowMs: number;
}): void;
```

- `takeCommandStartSeek`: an expired stage is cleared and returns null. Ref equality is plan
  21's `isSamePlaybackResourceRef`. A non-finite `fileDurationSeconds` (the bridge passes NaN
  when the element reports none) means no known end.
- `applyCommandSeekToLoadedFile`: `ref` null → do nothing. `readDurationSeconds()` is a number
  or null → `t = clampCommandStartToFileEnd({ seconds, fileDurationSeconds: duration })`,
  `controls.seek(t)`, `setMPCurrentTime(t)`. `undefined` → `stageCommandStartSeek({ ref,
  seconds, nowMs })` and `setMPCurrentTime(clampCommandStartToFileEnd({ seconds,
  fileDurationSeconds: undefined }))`, with no `controls.seek`.
- Tests reset the module with `clearCommandStartSeek` in `afterEach`; add no test-only export.

## `NonLiveMediaOrchestrator.tsx`

Anchors: the bridge options object passed to `useMediaElementBridge` (search
`onLoadedMetadata(newDuration)`), the staged branch (`const stagedDecision =
pendingPlaybackDecisionRef.current;`), and the fallback branch (`let newCurrentTime: number |
null = null;`).

1. In `onLoadedMetadata(newDuration)`, after the video aspect-ratio block and before
   `const stagedDecision`, take any staged command start:

   ```typescript
   const commandStartSeconds = takeCommandStartSeek({
     ref: buildPlaybackResourceRefFromPlayer({
       mpAddByRSS: mpAddByRSSRef.current,
       mpChannel: mpChannelRef.current,
       mpItem: mpItemRef.current,
       mpClip: mpClipRef.current,
       mpItemSoundbite: mpItemSoundbiteRef.current,
       mpItemChapter: mpItemChapterRef.current,
       mpItemChapters: null,
     }),
     fileDurationSeconds: newDuration,
     nowMs: Date.now(),
   });
   ```

   `buildPlaybackResourceRefFromPlayer` is plan 21's (`../../../lib/crossDevicePlayback/playbackResource`).
1. Staged branch: `const initialSeekSeconds = commandStartSeconds ?? (<the existing
   enclosure-switch ternary>);`. Everything after it (seek, `pauseAt`, `setMPDuration`,
   `setMPCurrentTime`, `updateNowPlaying`, stats) stays and uses that value.
1. Fallback branch: after the existing `if (mpClipRef.current) … else if (mpItemRef.current) …`
   chain, add `if (commandStartSeconds !== null) { newCurrentTime = commandStartSeconds; }`, and
   make the seek condition `(commandStartSeconds !== null || mpClipRef.current ||
   mpItemSoundbiteRef.current || mpItemRef.current) && newCurrentTime !== null`.
1. `onPlayRejected(error)`: first line
   `crossDevicePlaybackStore.notifyLocalPlayRejected(error);`. The existing handling stays.

Do not change `onEnded`, the near-end restart in the fallback branch, or
`resolvePlaybackLoadDecision`. With nothing staged, `commandStartSeconds` is null and every load
behaves as before.

## `MediaPlayerControllerLiveStreamAV.tsx`

The play/pause sync effect (near line 152): keep the call, and when `play()` returns a promise,
attach `.catch((error: unknown) => { crossDevicePlaybackStore.notifyLocalPlayRejected(error); })`.

## `usePlaybackResourceLoader.ts`

```typescript
export type LoadPlaybackResourceParams = {
  resource: DTOPlaybackResourceRef;
  addByRSSResourceData: AddByRSSResourceData | null;
  startSeconds: number | null;
};

/** Loads and starts `resource` in this tab's player. Resolves false when it could not be resolved. */
export function usePlaybackResourceLoader(): (params: LoadPlaybackResourceParams) => Promise<boolean>;
```

Uses `useMediaPlayer`, `useMediaPlayerControls`, `useMediaPlayerCurrentTime`,
`useMediaPlayerResourceUpdate`, `usePlayAddByRSS`, and `useAutoQueue` (config through a ref, as in
`useMediaPlayerControllerQueueHeadLoading`). Steps:

1. When `isSamePlaybackResourceRef(resource, buildPlaybackResourceRefFromPlayer(player))`: when
   `startSeconds !== null`, `applyCommandSeekToLoadedFile({ seconds: startSeconds, ref: resource,
   controls, setMPCurrentTime, nowMs: Date.now() })`; then `setMPIsPlaying(true)`; resolve true.
1. `item`: `reqItemGetByIdOrIdText(id)`, then `reqChannelGetByIdOrIdText(item.channel_id)`;
   target = `checkIsLiveItem(item) ? playbackTargetLivestream(channel, item) :
   playbackTargetFromStandardLoad({ channel, clip: null, item, itemChapter: null, itemSoundbite: null, musicIntent: 'explicit_play' })`.
1. `clip`: `reqClipGet(id)`, its `item.id_text` → item → channel, as `handleLoadQueueClip` does
   (`useMediaPlayerControllerQueueHeadLoading.ts` near line 489); target with `clip`.
1. `soundbite`: `reqItemSoundbiteGet(id)` → item → channel, as `handleLoadQueueItemSoundbite`
   does (near line 552); target with `itemSoundbite`.
1. Just before the load call in the next two steps, when `startSeconds !== null` and the target is
   not a livestream: `stageCommandStartSeek({ ref: resource, seconds: startSeconds, nowMs:
   Date.now() })`. This runs after the caller's last freshness check, so a stale command never
   stages.
1. For item, clip, and soundbite, call `mediaPlayerResourceUpdate` with the same options as
   `handleLoadQueueItem` (near line 445): `explicitPlaybackSeconds: startSeconds ?? undefined`,
   `itemChapterShouldSeek: false`, `enclosureSelectedParams: 'use-active-item-or-default'`,
   `skipMoveNowPlayingToHistory: false`, `newAutoQueueConfig` built from the auto-queue config
   ref exactly as there, `autoQueueShouldClear: true`, `isPlaying: true`, `shouldPlay: true`.
1. `add_by_rss`: `resolveAddByRSSIndexItemFromResourceData(addByRSSResourceData)` from
   `../utils/addByRSS/playFromQueueResource`; null data or null result → resolve false; else
   `await playAddByRSS(resolved.indexItem, startSeconds ?? undefined, undefined, { shouldPlay: true })`.
1. Any missing fetch result, or a thrown request → `clearCommandStartSeek()` and resolve false.

Plan 24 reuses this loader for `take_over` and "This device", so both get the file-end clamp.

## `useCrossDevicePlaybackCommandExecutor.ts`

```typescript
export function useCrossDevicePlaybackCommandExecutor(): {
  confirmTapToPlay: () => void;
  dismissTapToPlay: () => void;
};
```

Subscribes once to `crossDevicePlaybackStore.subscribeToSignals` and keeps player values in refs.

- `command` signal: type is not `take_over`, `next`, or `previous` → inbox accept → target is
  `thisSessionIdText` → `thisTabHoldsAudio` → fresh (`Date.now() − receivedAtMs <=
  PLAYBACK_COMMAND_TTL_MS`) → allowed for live. Then:
  - `play`: `setMPIsPlaying(true)`; note pending start.
  - `pause`: `setMPIsPlaying(false)`.
  - `seek`: `applyCommandSeekToLoadedFile({ seconds: command.position_seconds, ref:
    buildPlaybackResourceRefFromPlayer(playerRef.current), controls, setMPCurrentTime, nowMs:
    Date.now() })`.
  - `set_rate`: `setMPPlaybackSpeed(nearestPlaybackSpeedValue(command.rate))`.
  - `play_item`: note pending start; `await loader({ resource, addByRSSResourceData: command.add_by_rss_resource_data, startSeconds: command.start_seconds })`.
    When it resolves false, or more than `PLAYBACK_COMMAND_TTL_MS` passed since receipt before the
    load call began, report `load_failed` and clear the pending start. Check freshness after the
    fetches and before calling `mediaPlayerResourceUpdate` or `playAddByRSS`; when stale, do not
    load (and do not stage).
- `local_play_blocked` signal and the `mpPlaybackError` effect: as in **Start reporting window**.
- A 1 s interval while `tapToPlay` is set dismisses it at 60 s (track the set time in a ref).

`playerRef` holds the `PlayerResourceInput` fields from `useMediaPlayer()`. "Note pending start" =
`crossDevicePlaybackStore.setPendingCommandStart(command_id)`; clear it with
`setPendingCommandStart(null)` after a report or 15 s.

## `useTrackNextButtonActions.ts` and `useTrackPreviousButtonActions.ts`

Each hook returns one more field, the click action with no long-press state:

```typescript
/** What a click on the button runs. Cross-device `next` / `previous` commands call this. */
runLocalClick: () => Promise<void>;
```

`runLocalClick` is the existing `handleClick` callback, renamed; `useLongPress({ onClick:
runLocalClick, … })` keeps using it, so a click behaves exactly as before. Add `runLocalClick` to
the returned object and the return type. No other change in this plan; plan 25 adds the
remote-role routing to these hooks.

## `CrossDevicePlaybackTrackCommands.tsx`

```typescript
/** Runs cross-device `next` and `previous` commands through this tab's own Next and Previous click handlers. Renders nothing. */
export function CrossDevicePlaybackTrackCommands(): null;
```

- `const { runLocalClick: runNextClick } = useTrackNextButtonActions();` and
  `const { runLocalClick: runPreviousClick } = useTrackPreviousButtonActions();`; keep both in
  refs updated on every render.
- One `createPlaybackCommandInbox()` in a ref. A `useEffect` with no dependencies subscribes to
  `crossDevicePlaybackStore.subscribeToSignals` and returns the unsubscribe.
- On a `command` signal: `envelope.command.type` is `next` or `previous` → inbox accept
  `envelope.command_id` → `envelope.target_session_id_text === snapshot.thisSessionIdText` →
  `snapshot.thisTabHoldsAudio` → `Date.now() − receivedAtMs <= PLAYBACK_COMMAND_TTL_MS` →
  `isPlaybackCommandAllowed(type, { isLive })` for the loaded resource (always true for these
  two; keep the check so the rule has one home). `snapshot` is
  `crossDevicePlaybackStore.getSnapshot()` read at that moment.
- Then `void runNextClick().catch(() => {})` or `void runPreviousClick().catch(() => {})`, the
  same swallow `useLongPress` uses for a click. Nothing is reported to the sender.

## `CrossDevicePlayback.tsx`

- The provider calls `useCrossDevicePlaybackCommandExecutor()` and adds `confirmTapToPlay` and
  `dismissTapToPlay` to the context value (stable callbacks, so the memoized value stays stable).
- It renders `<CrossDevicePlaybackTrackCommands />` beside `<CrossDevicePlaybackPublisher />`,
  before `children`. Both sit under `AddByRSSListContextProvider`, `AutoQueueProvider`, Queues,
  and every MediaPlayer context (plan 22's mount point), which the track hooks need.

## Must stay true

- A tab that does not hold audio never acts on `play`, `pause`, `seek`, `set_rate`, `play_item`,
  `next`, or `previous`.
- A repeated `command_id` acts once.
- No command starts later than 5 s after this tab received it. A staged seek may land later, when
  the file's metadata arrives.
- A commanded position never seeks this tab's media at or past the end of its own file when that
  file reports a duration.
- A remote `next` or `previous` does exactly what a click on this tab's own button does, on this
  tab's queue.
- Only the tab in the `active` role fires end reached, auto-advance, history, and position
  events; the remote view reads duration only from `duration_seconds` in the shared state.
- With no other device, behavior is unchanged (no signals arrive, nothing is staged, and a click
  on Next or Previous runs the same code).

## Tests

Vitest:

- `playbackCommandInbox.test.ts`: a repeat is rejected; past capacity the oldest id is accepted
  again.
- `commandStartSeek.test.ts` (`clearCommandStartSeek` in `afterEach`):
  - stage 700 for an item ref, take with that ref and duration 600 → 595; a second take → null;
  - stage 120, take with duration 600 → 120; stage 597, take with duration 600 → 597;
  - stage 700, take with duration NaN → 700;
  - take with another ref → null, then take with the staged ref → its value;
  - take 30 001 ms after staging → null;
  - `applyCommandSeekToLoadedFile` with `readDurationSeconds` returning 600 and seconds 650 →
    `seek(595)` and `setMPCurrentTime(595)`; returning `null` and seconds 650 → `seek(650)`;
    returning `undefined` and seconds 650 → no `seek`, `setMPCurrentTime(650)`, and a later take
    with duration 600 → 595; `ref` null → nothing is called.
- `useMediaElementBridge.test.tsx` (existing file, beside the `readCurrentTimeSeconds` cases):
  `readDurationSeconds` is `undefined` with no element and before `loadedmetadata`; 600 after
  `loadedmetadata` with duration 600; `null` after `loadedmetadata` with duration `Infinity`.

Executor, loader, the orchestrator seam, and the Next and Previous commands are covered end to end
by area D's Playwright specs (two browser contexts on one account). Do not mount the full player
for unit tests here.

## Release scratchpad

```markdown
## Web player follows commands from other devices

- Surfaces: web
- Change: The web tab playing for an account carries out play, pause, seek, speed, next,
  previous, and "play this item" commands sent from another device or tab, including pause for
  livestreams. Next and previous do exactly what this tab's own Next and Previous buttons do, on
  its own queue: with chapters they move between chapters, Previous restarts the item when it is
  past 3 s, and otherwise they load the next or previous item. Speeds snap to the nearest speed
  the web player offers. A position from another device that lands at or past the end of this
  tab's copy of the file (dynamic ads can make copies differ in length) starts 5 s before the end
  instead of ending the item. When the browser blocks audio without a tap, or the media fails to
  load, the tab reports it to the sender and offers tap to play. Items started from another
  device's queue still auto-advance from the server queue, and only the playing tab records
  history and positions.
- Who notices: members controlling web playback from another device
- Operator steps: none
```
