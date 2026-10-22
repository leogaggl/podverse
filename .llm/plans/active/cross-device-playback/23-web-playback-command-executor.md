**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 23 — Web: the audio tab obeys playback commands, and reports starts that fail

When another device (or another tab of this browser) sends `play`, `pause`, `seek`, `set_rate`, or
`play_item`, the web tab holding audio carries it out (R10, R27). A livestream pauses through the
same path (R50). When a start this tab was asked to make cannot begin (the browser blocks audio
without a tap, or the media fails to load), the tab reports it so the sender can show it, and
shows a tap-to-play prompt (the prompt's visuals are area D's).

`take_over` is plan 24's. This plan ignores it, but owns the start-failure reporting and
tap-to-play state that plan 24 reuses.

Before editing, confirm plan 22 has landed (`apps/web/src/contexts/CrossDevicePlayback.tsx`,
`crossDevicePlaybackStore.subscribeToSignals`, `setPendingCommandStart`, `setTapToPlay`,
`notifyLocalPlayRejected`). If not, stop and report.

## Rows

R10, R27, R50

## Runs after

22

## Files

apps/web/src/lib/crossDevicePlayback/playbackCommandInbox.ts
apps/web/src/lib/crossDevicePlayback/playbackCommandInbox.test.ts
apps/web/src/lib/crossDevicePlayback/reportPlaybackStartFailed.ts
apps/web/src/hooks/usePlaybackResourceLoader.ts
apps/web/src/hooks/useCrossDevicePlaybackCommandExecutor.ts
apps/web/src/contexts/CrossDevicePlayback.tsx
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
  go through `setMPIsPlaying`, which `MediaPlayerControllerLiveStreamAV` already follows.
- **`set_rate`** snaps to the nearest web speed with plan 21's `nearestPlaybackSpeedValue`.
- **`play_item` with `start_seconds: null`** plays from the saved position (the normal load path),
  or the live point for a live item.
- **Auto-advance needs no change.** At the end of an item, `NonLiveMediaOrchestrator`'s
  `onEnded` (near line 806) calls `queueResourcesLoadActive()`, which fetches the queue from the
  server before choosing the next item, so a "play next" another device added is honored. Do not
  edit `onEnded`.
- **Start reporting window.** After obeying `play` or `play_item` (and plan 24's `take_over`), the
  tab records the command as a pending start for 15 s. Within that window:
  - a `local_play_blocked` signal (the browser refused `play()` with `NotAllowedError`) → report
    `autoplay_blocked`, `setMPIsPlaying(false)`, and set `tapToPlay` to that command;
  - `mpPlaybackError` turning non-null → report `load_failed`;
  - a `play_item` whose resource cannot be resolved, or whose resolution outlasts the TTL →
    report `load_failed`.
  Reports are fire-and-forget; errors are ignored (the command record may have expired).
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
   `startSeconds !== null`, `controls.seek(startSeconds)` and `setMPCurrentTime(startSeconds)`;
   then `setMPIsPlaying(true)`; resolve true.
1. `item`: `reqItemGetByIdOrIdText(id)`, then `reqChannelGetByIdOrIdText(item.channel_id)`;
   target = `checkIsLiveItem(item) ? playbackTargetLivestream(channel, item) :
   playbackTargetFromStandardLoad({ channel, clip: null, item, itemChapter: null, itemSoundbite: null, musicIntent: 'explicit_play' })`.
1. `clip`: `reqClipGet(id)`, its `item.id_text` → item → channel, as `handleLoadQueueClip` does
   (`useMediaPlayerControllerQueueHeadLoading.ts` near line 489); target with `clip`.
1. `soundbite`: `reqItemSoundbiteGet(id)` → item → channel, as `handleLoadQueueItemSoundbite`
   does (near line 552); target with `itemSoundbite`.
1. For those three, call `mediaPlayerResourceUpdate` with the same options as
   `handleLoadQueueItem` (near line 445): `explicitPlaybackSeconds: startSeconds ?? undefined`,
   `itemChapterShouldSeek: false`, `enclosureSelectedParams: 'use-active-item-or-default'`,
   `skipMoveNowPlayingToHistory: false`, `newAutoQueueConfig` built from the auto-queue config
   ref exactly as there, `autoQueueShouldClear: true`, `isPlaying: true`, `shouldPlay: true`.
1. `add_by_rss`: `resolveAddByRSSIndexItemFromResourceData(addByRSSResourceData)` from
   `../utils/addByRSS/playFromQueueResource`; null data or null result → resolve false; else
   `await playAddByRSS(resolved.indexItem, startSeconds ?? undefined, undefined, { shouldPlay: true })`.
1. Any missing fetch result, or a thrown request → resolve false.

Plan 24 reuses this loader for `take_over`.

## `useCrossDevicePlaybackCommandExecutor.ts`

```typescript
export function useCrossDevicePlaybackCommandExecutor(): {
  confirmTapToPlay: () => void;
  dismissTapToPlay: () => void;
};
```

Subscribes once to `crossDevicePlaybackStore.subscribeToSignals` and keeps player values in refs.

- `command` signal: inbox accept → target is `thisSessionIdText` → type is not `take_over` →
  `thisTabHoldsAudio` → fresh (`Date.now() − receivedAtMs <= PLAYBACK_COMMAND_TTL_MS`) → allowed
  for live. Then:
  - `play`: `setMPIsPlaying(true)`; note pending start.
  - `pause`: `setMPIsPlaying(false)`.
  - `seek`: clamp to `[0, mpDuration]` when `mpDuration > 0`, else `max(0, …)`;
    `controls.seek(t)`; `setMPCurrentTime(t)`.
  - `set_rate`: `setMPPlaybackSpeed(nearestPlaybackSpeedValue(command.rate))`.
  - `play_item`: note pending start; `await loader({ resource, addByRSSResourceData: command.add_by_rss_resource_data, startSeconds: command.start_seconds })`.
    When it resolves false, or more than `PLAYBACK_COMMAND_TTL_MS` passed since receipt before the
    load call began, report `load_failed` and clear the pending start. Check freshness after the
    fetches and before calling `mediaPlayerResourceUpdate` or `playAddByRSS`; when stale, do not
    load.
- `local_play_blocked` signal and the `mpPlaybackError` effect: as in **Start reporting window**.
- A 1 s interval while `tapToPlay` is set dismisses it at 60 s (track the set time in a ref).

"Note pending start" = `crossDevicePlaybackStore.setPendingCommandStart(command_id)`; clear it with
`setPendingCommandStart(null)` after a report or 15 s.

## `CrossDevicePlayback.tsx`

The provider calls `useCrossDevicePlaybackCommandExecutor()` and adds `confirmTapToPlay` and
`dismissTapToPlay` to the context value (stable callbacks, so the memoized value stays stable).

## Media controllers

- `NonLiveMediaOrchestrator.tsx`, `onPlayRejected(error)` (near line 456): first line
  `crossDevicePlaybackStore.notifyLocalPlayRejected(error);`. The existing handling stays.
- `MediaPlayerControllerLiveStreamAV.tsx`, the play/pause sync effect (near line 152): keep the
  call, and when `play()` returns a promise, attach
  `.catch((error: unknown) => { crossDevicePlaybackStore.notifyLocalPlayRejected(error); })`.

## Must stay true

- A tab that does not hold audio never acts on `play`, `pause`, `seek`, `set_rate`, or `play_item`.
- A repeated `command_id` acts once.
- No command acts later than 5 s after this tab received it.
- With no other device, behavior is unchanged (no signals arrive).

## Tests

Vitest:

- `playbackCommandInbox.test.ts`: a repeat is rejected; past capacity the oldest id is accepted
  again.

Executor and loader behavior is covered end to end by area D's Playwright specs (two browser
contexts on one account). Do not mount the full player for unit tests here.

## Release scratchpad

```markdown
## Web player follows commands from other devices

- Surfaces: web
- Change: The web tab playing for an account carries out play, pause, seek, speed, and "play this
  item" commands sent from another device or tab, including pause for livestreams. Speeds snap to
  the nearest speed the web player offers. When the browser blocks audio without a tap, or the
  media fails to load, the tab reports it to the sender and offers tap to play. Items started from
  another device's queue still auto-advance from the server queue.
- Who notices: members controlling web playback from another device
- Operator steps: none
```
