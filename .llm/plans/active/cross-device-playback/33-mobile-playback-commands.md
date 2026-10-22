**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 33 — Mobile obeys playback commands and takes over

When the phone is the active device, other devices control it: play, pause, seek, rate, next,
previous, and "play this item". When another device picks the phone in its device menu, the phone
resumes the shared item where it is now, or at the live point, and becomes active. A commanded
start or seek that lands at or past the end of the phone's own file starts 5 s before that end.
When the phone cannot start, it says so, and the sender shows the failure. Only the phone that
plays fires playback events.

Before editing, confirm plan 32's publisher and `stopPlaybackForOtherDevice` exist, and that plan
27's `clampCommandStartToFileEnd` is exported from `@podverse/playback-core/clampNearEndSeconds`.
If not, stop and report.

## Rows

R11, R22, R28, R42, R49, R51, R78, R85, R88

## Runs after

32, 27

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlaybackCommandRunner.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackCommandRunner.test.ts
apps/mobile/src/playback/crossDevice/commandedStartClamp.ts
apps/mobile/src/playback/crossDevice/commandedStartClamp.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/lib/addByRss/localResourceData.ts
apps/mobile/src/lib/addByRss/localResourceData.test.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **Commands run through the normal local paths.** `play` is `resume`, `pause` is `pause`, `seek`
  is `seekTo` (with the end clamp below), `set_rate` is `setRate`, `next` and `previous` are the
  Next and Previous button handlers, and `play_item` and `take_over` start through the same start
  functions a tap uses. So a command on the active device writes the same now-playing, position,
  and history events a tap would. That is correct: the audio really plays there. Commands never
  edit the queue beyond what that play path already does (plan 13).
- **Next and previous (R78).** The phone runs `next` as a tap on its own Next button,
  `skipToNext`, and `previous` as a tap on its own Previous button, `skipToPrevious`, on its own
  queue. These are the tap handlers, not the hold handlers (`skipToNextTrack`,
  `skipToPreviousTrack`): the command names the button, and a tap is the button's action. So a
  remote Next goes to the next chapter when the item has chapters ahead, otherwise to the next
  queue item when one is ahead, otherwise does nothing; a remote Previous goes to the previous
  chapter, restarts the item, or plays the previous queue item, by the same `resolvePreviousAction`
  rules a tap uses. On a live item both handlers return without doing anything, exactly as a tap
  does on the phone (plan 11: a remote press does what a press there does, including nothing). The
  runner never drops `next` or `previous` for a live item or a missing target, and never reports
  them as a start failure; the handler decides.
- **Livestream pause (R51).** A `pause` command on a live item calls the same `pause` a local tap
  calls, and `play` calls the same `resume`, so a remote pause behaves exactly like a local one on
  that device. Live items accept no `seek` or `set_rate` (plan 11); the runner drops them even
  though the server already refuses them.
- **Take-over position (R22, R49).** The target resumes `envelope.state.resource` at
  `resolvePlaybackTakeOverStart`, measured when the command runs, not when it was sent. A live item
  starts at the live point: `resolveItemPlaybackStart` already turns an item with `live_item` into a
  livestream target that ignores the requested seconds, and an Add by RSS livestream has no seek
  either.
- **A commanded start position is used as given (R22, R49, R85).** When `take_over`, `play_item`
  with a `start_seconds`, or take-over-here (plan 34) starts a non-live item at a position, the load
  starts at that position. It skips the two playback-core rules a local resume applies: the
  near-end rule (`clampNearEndSeconds`, which turns a start within 5 s of the duration into 0) and
  the music rule (`item-music` with `explicit_play` always starts at 0). A take-over moves playback
  that is already under way, so restarting the item would lose the listener's place, and the
  near-end rule would also turn the R85 start (duration minus 5 s) back into 0. The end clamp below
  is the only adjustment. A `play_item` with a null `start_seconds` is an ordinary explicit play
  and keeps every playback-core rule.
- **Landing past the end (R85).** When a `take_over`, `play_item`, or `seek` command, or a
  take-over-here, lands at or past the duration of the file this phone loaded, playback starts at
  that duration minus 5 s, never below 0. A position before the duration is used as is, even inside
  the last 5 s. The duration is always this phone's own engine duration, never the shared
  `duration_seconds` and never the feed's `item_about.duration` hint: dynamic ad insertion can give
  the same enclosure a different length on each device.
- **When the phone knows the duration (R85).** Neither engine knows the file length before the
  item is prepared. iOS reports it when the `AVPlayerItem` reaches `readyToPlay`; Android when
  ExoPlayer reaches `STATE_READY`. Each sends a `ready` state event and one `progress` sample
  carrying `durationSeconds` at that moment, and `nativePlaybackBridge.getDuration()` returns 0
  until then. Both engines apply `initialSeekSeconds` at that same moment (iOS seeks right after
  `readyToPlay`; Android passes it as the media item's start position), so a past-the-end start
  reaches the engine before JS can compare it with the duration. Until then `durationRef` holds the
  feed's hint (`resolveMediaFileDurationHintSeconds`), which this clamp never reads. So:
  - **Duration already known** (a `seek` command on a loaded, prepared item): clamp before seeking.
  - **Duration not known yet** (every commanded load, and a `seek` that arrives while the item is
    still loading): seek or load at the requested position and arm a commanded-start guard. The
    first `progress` sample for this item that carries a duration resolves it: when the request was
    at or past the duration, seek to duration minus 5 s (through `seekTo`, so the corrected
    position is written and published like any seek); otherwise drop the guard.
  - **The engine ends first.** A start past the end can make the engine report `ended` before that
    sample is handled. While the guard is armed, `ended` does not advance the queue: the phone reads
    `getDuration()`, seeks to duration minus 5 s, and plays. With the duration still 0 at `ended`,
    the guard drops and `ended` advances as usual.
- **Add by RSS take-over.** The state carries only the hash. The target looks for it in its own
  Add by RSS feeds first (`findLocalAddByRssResourceDataByHash`, new), then in its server queues'
  now-playing rows, which the previous active device wrote. An Add by RSS livestream is never in
  the queue, so it can be taken over only by a device that has that feed locally; elsewhere it
  fails as `load_failed`. A `play_item` for Add by RSS carries the data, so it never needs the
  lookup.
- **Start failure (R42).** The phone never reports `autoplay_blocked` and never shows a
  tap-to-play prompt: a native app starts audio when told, and a phone that could not (in the
  background, not playing) has its stream closed and is not in the device list, so the server
  answers the sender with `playback_device_not_connected` instead. It reports `load_failed` when
  the start path fails: the item, clip, or soundbite lookup throws, Add by RSS data cannot be
  resolved, there is no playable media (`media_player.no_media`), the native load throws, or the
  engine reports an error within `PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS` of a commanded start.
- **Order and expiry.** Commands run one at a time in arrival order. Each is dropped when it
  waited longer than `PLAYBACK_COMMAND_TTL_MS` on this device's clock before it could run, and
  repeats of a `command_id` are ignored (the last 100 ids).

## Only the playing device fires playback events (R88)

Plan 11 states the contract rule. This is how the phone enforces it.

- **The phone fires end reached, auto-advance, history, playback journal, and position events only
  while it is the playing device**, from its own engine, exactly as it does with no other device
  connected. That covers `advance('complete')` from `ended`, `writePlaybackEvent` (now-playing and
  history through the outbox, position samples, seeks), the car playback journal drain, and the
  throttled device-local last-playback snapshot.
- **A phone in role `remote` fires none of them.** When another device claims, plan 32's
  `stopPlaybackForOtherDevice` pauses the engine and writes nothing to the outbox. A paused engine
  sends no `progress` while paused, and the `progress` handler writes a position event only while
  `isPlayingRef` is true (`playbackEventFromProgressSample`). The one write at that moment is the
  stop's own last-playback snapshot: the phone's final position from its own engine, taken as its
  audio stops. Nothing after that.
- **A late `ended` never advances a remote phone.** If the engine reaches the end in the instant
  another device claims, the `ended` handler and `completeNowPlaying` read
  `getCrossDevicePlaybackView()` at call time and do nothing when `role === 'remote'`. Advancing
  would start the next item locally, and that local start would claim playback back (plan 32).
- **Commands are the playing device's own playback.** The runner acts only on commands addressed to
  this session, which the server sends only to the active device, so every event a command writes
  is written by the device whose audio plays.
- **Remote display reads `duration_seconds` from the shared state.** The phone's remote progress
  (area E, through plan 30's `getCrossDevicePlaybackPositionSeconds` and the store's `state`) uses
  `state.duration_seconds` for the bar, the duration label, the segment band, and the chapter
  highlight. It never reads `playbackProgressStore`, `durationRef`, the engine, or
  `item_about.duration` for the item another device plays. The estimate stopping at that duration
  fires nothing; the remote view waits for the playing device's next `playback.state`.
- **The R85 clamp uses the local duration on purpose.** It runs only on the device that loads the
  file, which is the playing device, so it is the one place a device's own file length decides a
  position.

## The shared rule (plan 27)

Plan 27 adds `clampCommandStartToFileEnd({ seconds, fileDurationSeconds })` and
`COMMAND_START_FILE_END_BACKOFF_SECONDS` (5) to `packages/playback-core/src/clampNearEndSeconds.ts`.
Web plan 23 applies the same function in the browser. Mobile imports it from
`@podverse/playback-core/clampNearEndSeconds` (the existing subpath export) and never keeps a copy.
Below the duration it keeps the position, inside the last 5 s too; at or past it, it returns
duration minus 5 s, never below 0; with no known duration it keeps the position.

## `commandedStartClamp.ts` (pure)

```typescript
export type CommandedStartGuard = {
  requestedSeconds: number;
  /** Set once the correcting seek was issued. */
  clampedSeconds: number | null;
  clampIssuedAtMs: number | null;
};

export const COMMANDED_START_LANDED_TOLERANCE_SECONDS = 2;
export const COMMANDED_START_SETTLE_MS = 5_000;

export function createCommandedStartGuard(requestedSeconds: number): CommandedStartGuard;

export type CommandedStartProgressAction =
  | { kind: 'keep'; guard: CommandedStartGuard }
  | { kind: 'seek'; seconds: number; guard: CommandedStartGuard }
  | { kind: 'clear' };

export function resolveCommandedStartOnProgress(params: {
  guard: CommandedStartGuard;
  positionSeconds: number;
  durationSeconds: number;
  nowMs: number;
}): CommandedStartProgressAction;

export function resolveCommandedStartOnEnded(params: {
  guard: CommandedStartGuard;
  durationSeconds: number;
}): { kind: 'restart_before_end'; seconds: number } | { kind: 'advance' };
```

- `resolveCommandedStartOnProgress`:
  - `durationSeconds <= 0` or not finite → `keep` (the duration is not known yet).
  - `clampedSeconds === null`: `clampCommandStartToFileEnd({ seconds: requestedSeconds,
    fileDurationSeconds: durationSeconds })`. Equal to the request → `clear`. Otherwise → `seek` to it, with the guard's `clampedSeconds`
    and `clampIssuedAtMs: nowMs` set.
  - `clampedSeconds !== null`: `clear` when the position is within
    `COMMANDED_START_LANDED_TOLERANCE_SECONDS` of it, or when `nowMs - clampIssuedAtMs >
    COMMANDED_START_SETTLE_MS`; otherwise `keep`.
- `resolveCommandedStartOnEnded`: `durationSeconds > 0` → `restart_before_end` at
  `clampCommandStartToFileEnd({ seconds: durationSeconds, fileDurationSeconds: durationSeconds })`;
  otherwise `advance`.

## `crossDevicePlaybackCommandRunner.ts` (pure, injected I/O)

```typescript
export type LocalPlaybackStartResult = 'started' | 'failed';

export type CrossDevicePlaybackLocalPort = {
  resume: () => Promise<void>;
  pause: () => void;
  /** Applies the R85 end clamp; resolves once the seek is issued. */
  seekTo: (seconds: number) => Promise<void>;
  setRate: (rate: number) => void;
  /** The Next button's tap handler. */
  skipToNext: () => Promise<void>;
  /** The Previous button's tap handler. */
  skipToPrevious: () => Promise<void>;
  playResource: (params: {
    ref: DTOPlaybackResourceRef;
    addByRssResourceData: AddByRSSResourceData | null;
    /** Null plays from the saved position, or the live point. */
    startSeconds: number | null;
  }) => Promise<LocalPlaybackStartResult>;
  hasLoadedTarget: () => boolean;
  isLoadedTargetLive: () => boolean;
};

export type CrossDevicePlaybackCommandRunnerDeps = {
  port: CrossDevicePlaybackLocalPort;
  reportStartFailed: (commandIdText: string, reason: PlaybackStartFailedReason) => Promise<void>;
  readThisSessionIdText: () => string | null;
  now: () => number;
};

export function createCrossDevicePlaybackCommandRunner(deps: CrossDevicePlaybackCommandRunnerDeps): {
  receive: (envelope: DTOPlaybackCommandEnvelope) => void;
  /** The local player reported an error. */
  notePlaybackError: () => void;
  dispose: () => void;
};
```

Behavior:

- `receive`: drop it when `target_session_id_text !== readThisSessionIdText()` or its id was
  seen; otherwise record the id and enqueue `{ envelope, receivedAtMs: now() }`. Start draining
  when idle.
- Drain: take the next entry; when `isPlaybackCommandStale`, drop it and continue. Otherwise
  dispatch and await it before the next. A thrown dispatch is caught and goes to `console.warn`;
  for a start type (`play_item`, `take_over`) it also counts as failed.
- Dispatch by `command.type` (an exhaustive `switch`):
  - `play`: when `hasLoadedTarget()`, `await port.resume()` and watch it; otherwise drop it.
  - `pause`: `port.pause()`.
  - `seek`: drop when `isLoadedTargetLive()` or no target; otherwise
    `await port.seekTo(Math.max(0, position_seconds))`.
  - `set_rate`: drop when live or no target; otherwise `port.setRate(rate)`.
  - `next`: `await port.skipToNext()`. `previous`: `await port.skipToPrevious()`. Neither is
    dropped for a live or missing target, and neither is watched or reported.
  - `play_item`: `port.playResource({ ref: resource, addByRssResourceData:
    add_by_rss_resource_data, startSeconds: start_seconds })`.
  - `take_over`: `resolvePlaybackTakeOverStart({ state: envelope.state, receivedAtMs, nowMs:
    now() })`. When the state is null or the result is null, report `load_failed`. Otherwise
    `port.playResource({ ref, addByRssResourceData: null, startSeconds })`.
  - A `'failed'` result reports `load_failed`. A `'started'` result watches the command.
- Watch: keep one `{ commandIdText, untilMs: now() + PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS }`; a
  newer start replaces it. `notePlaybackError()` before `untilMs` reports `load_failed` for it once
  and clears it.
- `reportStartFailed` rejections go to `console.warn`; nothing retries them.
- `dispose` empties the queue and ignores later results.

## `localResourceData.ts`

```typescript
export type LocalAddByRssFeedListLookup = {
  listFeeds: () => Promise<MobileAddByRSSFeedRecord[]>;
  getMappedFeedByUrl: (feedUrl: string) => Promise<AddByRSSMappedFeed | null>;
};

/** The local Add by RSS episode, track, or livestream whose playback hash is `hashId`, or null. */
export async function findLocalAddByRssResourceDataByHash(
  hashId: string,
  lookup: LocalAddByRssFeedListLookup
): Promise<AddByRSSResourceData | null>;
```

For each feed from `listFeeds()`, read its mapped bundle and build resource data for each item
with `toAddByRssItemPlaybackResourceData` and for each live item with
`toAddByRssLiveItemPlaybackResourceData` (both in `./domain`). Return the first whose
`addByRssPlaybackMediaId` equals `hashId`. Skip feeds with no bundle. `addByRssRepository` already
has both methods.

## `PlaybackProvider.tsx`

- **Start results.** `playTarget` returns `Promise<boolean>`: false in its load-failure `catch`,
  true after a successful load. `startItemPlayback`, `startClipPlayback`,
  `startSoundbitePlayback`, and `startAddByRssPlayback` return `Promise<boolean>`: false where they
  set `media_player.no_media` and return, otherwise `playTarget`'s result. Every existing caller
  ignores the value, and the public `PlaybackSessionContextValue` signatures do not change.
- **Commanded start in `playTarget`.**
  - Add `const commandedStartGuardRef = useRef<CommandedStartGuard | null>(null);` and
    `const seekToRef = useRef<(seconds: number) => void>(() => {});` near the other refs. Assign
    `seekToRef.current = seekTo;` directly after `seekTo`'s `useCallback`, because
    `useNativePlaybackBridge` is called above `seekTo`.
  - `playTarget`'s params gain `commandedStartSeconds?: number`. Next to `clearSeekHold()` at the
    top, set `commandedStartGuardRef.current = null`. Then, when `params.commandedStartSeconds !==
    undefined` and `!isLivePlaybackTarget(target)` (plan 30), set the guard to
    `createCommandedStartGuard(params.commandedStartSeconds)` before `applyLoad`, and pass
    `params.playbackDecisionOverride ?? commandedStartDecision(target,
    params.commandedStartSeconds)` as the decision override. In the load-failure `catch`, set the
    guard back to null.
  - `commandedStartDecision` is module-level: `{ ...resolvePlaybackLoadDecision({ target }, {
    abridged: EMPTY_ABRIDGED_INDEX }), initialSeekSeconds: seconds }`. It keeps the target's
    `pauseAtSeconds` (clip, soundbite, and chapter ends), autoplay, stats, and auto-queue flags,
    and replaces only the start. Import `resolvePlaybackLoadDecision` from
    `@podverse/playback-core/resolvePlaybackLoadDecision` and `EMPTY_ABRIDGED_INDEX` from
    `../lib/addByRss/domain`.
  - `startItemPlayback`, `startClipPlayback`, `startSoundbitePlayback`, and
    `startAddByRssPlayback` options gain `commandedStartSeconds?: number`, passed through to
    `playTarget` unchanged. A live item becomes a livestream target inside
    `resolveItemPlaybackStart`, so `playTarget` ignores the value there.
- **The guard in the native handlers** (`useNativePlaybackBridge`):
  - `progress`: after the `identityMatches` check (so a sample from the previous source never
    resolves it) and before the `pauseAt` check, when a guard is armed, call
    `resolveCommandedStartOnProgress({ guard, positionSeconds: event.positionSeconds,
    durationSeconds: event.durationSeconds, nowMs: Date.now() })`. `keep` stores the returned guard;
    `seek` stores it and calls `seekToRef.current(action.seconds)`; `clear` sets the ref to null.
  - `ended`: first, when `getCrossDevicePlaybackView().role === 'remote'`, return (R88). Then,
    after the existing engine identity check, when a guard is armed: set the ref to null and, in an
    async block, read `await nativePlaybackBridge.getDuration()` (never `durationRef`, which can
    still hold the feed hint) and call `resolveCommandedStartOnEnded`. `restart_before_end` calls
    `seekToRef.current(seconds)` then `void nativePlaybackBridge.play()`; `advance` runs
    `advance('complete')`. Without a guard, `ended` advances as it does today.
  - Clear the guard in `clearNowPlaying` and in plan 32's `stopPlaybackForOtherDevice`.
- **`completeNowPlaying`** returns without advancing when `getCrossDevicePlaybackView().role ===
  'remote'` (R88), so it keeps matching the `ended` path.
- **`seekForCrossDevice`** (`useCallback`, next to `seekTo`), returning `Promise<void>`: read
  `await nativePlaybackBridge.getDuration()`. When it is finite and above 0, call
  `seekTo(clampCommandStartToFileEnd({ seconds, fileDurationSeconds: duration }))`.
  Otherwise call `seekTo(seconds)` and set the guard to `createCommandedStartGuard(seconds)`, so
  the first sample with a duration, or an early `ended`, applies R85.
- **`playResourceForCrossDevice`** (`useCallback`, next to `playItemByIdWithIntent`), returning
  `LocalPlaybackStartResult`. Every branch passes `autoPlayOverride: true`, `autoQueue: { mode:
  'clear' }` (the same directive an explicit tap uses), `explicitPlaybackSeconds: startSeconds ??
  undefined`, and `commandedStartSeconds: startSeconds ?? undefined`. Any throw returns `'failed'`.
  - `item`: `playbackContentRepository.getItemByIdText`, `ensureChannel`, `startItemPlayback` with
    `intent: 'explicit_play'`. A live item becomes a livestream target at the live point inside
    `resolveItemPlaybackStart`.
  - `clip`: `getClipByIdText`; its `item`; `ensureChannel`; `startClipPlayback`.
  - `soundbite`: `getSoundbiteByIdText`; its `item`; `ensureChannel`; `startSoundbitePlayback`.
  - `add_by_rss`: the carried data, else `findLocalAddByRssResourceDataByHash(hash,
    addByRssRepository)`, else the first `queueRepository.getNowPlaying(context, queue.id_text, {
    skipCache: true })` across `queueRepository.getQueues(context)` whose `add_by_rss_hash_id`
    equals `hash` and whose `add_by_rss_resource_data` passes `isAddByRssResourceData`. None →
    `'failed'`. Then
    `resolveLocalAddByRssResourceData(data, addByRssRepository)` and `startAddByRssPlayback`.
  - A missing item or channel returns `'failed'`.
- Pass a `localPort: CrossDevicePlaybackLocalPort` into `useCrossDevicePlayback`: the local
  `resume`, `pause`, `setRate`, `skipToNext`, and `skipToPrevious` (the unrouted ones; plan 34
  routes only the context values), `seekTo: seekForCrossDevice`, `playResource:
  playResourceForCrossDevice`, `hasLoadedTarget: () => activeTargetRef.current !== null`, and
  `isLoadedTargetLive` from `isLivePlaybackTarget`. Build it with `useMemo` over those callbacks;
  the hook call sits above `sessionValue`, below every one of them.
- Pass `lastPlaybackError` into the hook.

## `useCrossDevicePlayback.ts`

- Params gain `localPort: CrossDevicePlaybackLocalPort` and `lastPlaybackError`, typed as the
  provider's existing `lastPlaybackError` state (null when there is no error).
- Create the runner once. `reportStartFailed` uses `crossDevicePlaybackRepository.reportStartFailed`;
  `readThisSessionIdText` reads the store; the port goes through a ref so the runner always calls the
  latest callbacks.
- In the stream event subscription, `playback.command` events go to `runner.receive(event.data)`
  only while the presence controller `isRunning()`.
- An effect calls `runner.notePlaybackError()` when `lastPlaybackError` changes to non-null.

## `apps/mobile/vitest.config.ts`

Add `crossDevicePlaybackCommandRunner.test.ts` and `commandedStartClamp.test.ts` with header
clauses ("the cross-device command runner — target check, dedupe, local staleness, serial
execution, live drops, next and previous, take-over start, and start-failure reporting
(`src/playback/crossDevice/crossDevicePlaybackCommandRunner.ts`)" and "the commanded-start end
clamp — waiting for the engine duration, the correcting seek, and an early end
(`src/playback/crossDevice/commandedStartClamp.ts`)"). `localResourceData.test.ts` is already
included.

## Tests

- The shared rule's own cases are plan 27's.
- `crossDevicePlaybackCommandRunner.test.ts` (fake port, fake clock):
  - A command for another session and a repeated `command_id` are ignored.
  - Two commands run in order, the second after the first's promise settles.
  - A command that waited 5001 ms behind a slow one is dropped; one at 5000 ms runs.
  - `seek` and `set_rate` are dropped for a live target; `seek` clamps negative to 0 and awaits the
    port.
  - `play` with no loaded target does nothing.
  - `next` calls `skipToNext` and `previous` calls `skipToPrevious`, for a live target and with no
    target too; a `next` that throws reports nothing.
  - `take_over` asks the port for the estimated position at execution time (state playing at 100 s,
    rate 1, executed 3 s after receipt with a 1 s server age → 104 s); a live state asks for a null
    start; a null state reports `load_failed`.
  - A `'failed'` start and a thrown start report `load_failed`; nothing ever reports
    `autoplay_blocked`.
  - An error within 8 s of a started `play_item` reports once; one after 8 s does not.
- `commandedStartClamp.test.ts`:
  - A sample with duration 0 keeps the guard.
  - A request of 120 with duration 3600 clears; a request of 3700 with duration 3600 seeks to 3595.
  - After the seek, a sample at 3596 clears; a sample at 3700 keeps; a sample 5001 ms after the seek
    clears.
  - An end with duration 3600 restarts at 3595; an end with duration 0 advances.
- `localResourceData.test.ts`: `findLocalAddByRssResourceDataByHash` finds an episode and a
  livestream by hash, skips a feed with no bundle, and returns null when nothing matches.

## Release scratchpad

```markdown
## Your other devices can control the phone

- Surfaces: mobile
- Change: while a member's phone is the active device, their other devices can play, pause, seek,
  change speed, press Next and Previous, and start a different item on it. Next and Previous do
  exactly what a tap on the phone's own buttons does, using the phone's queue (and do nothing for a
  livestream, as on the phone). Choosing the phone in another device's device menu moves playback
  to the phone at the current position (or the live point for a livestream). When a move, a new
  item, or a seek lands at or past the end of the phone's own copy of the file (lengths can differ
  between devices), the phone starts 5 seconds before its end instead of finishing the item. The
  phone tells the other device when the media cannot load. Only the device that plays records end,
  auto-advance, history, and position.
- Who notices: members who play on more than one device
- Operator steps: none
```
