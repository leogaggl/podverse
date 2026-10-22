**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 33 — Mobile obeys playback commands and takes over

When the phone is the active device, other devices control it: play, pause, seek, rate, and
"play this item". When another device picks the phone in its device menu, the phone resumes the
shared item where it is now, or at the live point, and becomes active. When it cannot start, it says
so, and the sender shows the failure.

Before editing, confirm plan 32's publisher and `stopPlaybackForOtherDevice` exist. If not, stop
and report.

## Rows

R11, R22, R28, R42, R49, R51

## Runs after

32

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlaybackCommandRunner.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackCommandRunner.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/lib/addByRss/localResourceData.ts
apps/mobile/src/lib/addByRss/localResourceData.test.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **Commands run through the normal local paths.** `play` is `resume`, `pause` is `pause`, `seek`
  is `seekTo`, `set_rate` is `setRate`, and `play_item` and `take_over` start through the same
  start functions a tap uses. So a command on the active device writes the same now-playing,
  position, and history events a tap would. That is correct: the audio really plays there.
  Commands never edit the queue beyond what that play path already does (plan 13).
- **Livestream pause (R51).** A `pause` command on a live item calls the same `pause` a local tap
  calls, and `play` calls the same `resume`, so a remote pause behaves exactly like a local one on
  that device. Live items accept no `seek` or `set_rate` (plan 11); the runner drops them even
  though the server already refuses them.
- **Take-over position (R22, R49).** The target resumes `envelope.state.resource` at
  `resolvePlaybackTakeOverStart`, measured when the command runs, not when it was sent. A live item
  starts at the live point: `resolveItemPlaybackStart` already turns an item with `live_item` into a
  livestream target that ignores the requested seconds, and an Add by RSS livestream has no seek
  either.
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

## `crossDevicePlaybackCommandRunner.ts` (pure, injected I/O)

```typescript
export type LocalPlaybackStartResult = 'started' | 'failed';

export type CrossDevicePlaybackLocalPort = {
  resume: () => Promise<void>;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setRate: (rate: number) => void;
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
  dispatch and await it before the next. A thrown dispatch is caught; for a start type it counts as
  failed.
- Dispatch by `command.type`:
  - `play`: when `hasLoadedTarget()`, `await port.resume()` and watch it; otherwise drop it.
  - `pause`: `port.pause()`.
  - `seek`: drop when `isLoadedTargetLive()` or no target; otherwise
    `port.seekTo(Math.max(0, position_seconds))`.
  - `set_rate`: drop when live or no target; otherwise `port.setRate(rate)`.
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
- **`playResourceForCrossDevice`** (`useCallback`, next to `playItemByIdWithIntent`), returning
  `LocalPlaybackStartResult`. Every branch passes `autoPlayOverride: true`, `autoQueue: { mode:
  'clear' }` (the same directive an explicit tap uses), and `explicitPlaybackSeconds: startSeconds
  ?? undefined`. Any throw returns `'failed'`.
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
  `resume`, `pause`, `seekTo`, and `setRate` (the unrouted ones; plan 34 routes only the context
  values), `playResource: playResourceForCrossDevice`, `hasLoadedTarget: () =>
  activeTargetRef.current !== null`, and `isLoadedTargetLive` from `isLivePlaybackTarget`. Build
  it with `useMemo` over those callbacks.
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

Add `crossDevicePlaybackCommandRunner.test.ts` and a header clause ("the cross-device command
runner — target check, dedupe, local staleness, serial execution, live drops, take-over start, and
start-failure reporting (`src/playback/crossDevice/crossDevicePlaybackCommandRunner.ts`)").
`localResourceData.test.ts` is already included.

## Tests

- `crossDevicePlaybackCommandRunner.test.ts` (fake port, fake clock):
  - A command for another session and a repeated `command_id` are ignored.
  - Two commands run in order, the second after the first's promise settles.
  - A command that waited 5001 ms behind a slow one is dropped; one at 5000 ms runs.
  - `seek` and `set_rate` are dropped for a live target; `seek` clamps negative to 0.
  - `play` with no loaded target does nothing.
  - `take_over` asks the port for the estimated position at execution time (state playing at 100 s,
    rate 1, executed 3 s after receipt with a 1 s server age → 104 s); a live state asks for a null
    start; a null state reports `load_failed`.
  - A `'failed'` start and a thrown start report `load_failed`; nothing ever reports
    `autoplay_blocked`.
  - An error within 8 s of a started `play_item` reports once; one after 8 s does not.
- `localResourceData.test.ts`: `findLocalAddByRssResourceDataByHash` finds an episode and a
  livestream by hash, skips a feed with no bundle, and returns null when nothing matches.

## Release scratchpad

```markdown
## Your other devices can control the phone

- Surfaces: mobile
- Change: while a member's phone is the active device, their other devices can play, pause, seek,
  change speed, and start a different item on it. Choosing the phone in another device's device
  menu moves playback to the phone at the current position (or the live point for a livestream),
  and the phone tells the other device when the media cannot load.
- Who notices: members who play on more than one device
- Operator steps: none
```
