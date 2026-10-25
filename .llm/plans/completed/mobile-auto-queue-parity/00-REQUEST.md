# Mobile auto-queue parity — request

## Request

The operator's words, in the order given across one conversation.

> the podverse web site should have a variety of automatic queue types of handling when you play a
> podcast or music. do you see it? is it clear to you how it works? does mobile have matching
> handling? is there opportunity for shared helpers to keep this behavior consistent between web,
> mobile, and potentially others? (perhaps mobile app needs to be different for the sake of native,
> car/auto play, and other potential clients)

> the forward fill does not seem to be working for me on mobile. are you sure it is setup properly?
> the forward button is disabled even though i started playing an item in the middle of a series

> so do you see bugs and issues that can be fixed so the mobile player has more parity with the
> web? and can you make it support car/auto mobile and other potential clients?

> fixes for this. bear in mind ios and android must have more parity with the desired behavior
> which the web already handles. if you see issues and aren't sure what is best then ask

The web behavior is the source of truth. iOS and Android should match it, except where native
playback, CarPlay, Android Auto, or the lock screen need something different.

## Operator answers

- **Next button with an empty account queue.** After Play, mobile fetches the next rows of the
  auto-queue. Next turns on once a later row is found and stays off at the true end of the
  series, playlist, or album. Next does not stay on all the time the way it does on web.
- **Previous.** Mobile does what web does. Chapters come first. Past 3 seconds, Previous restarts
  the item. Otherwise it steps back through the auto-queue rows already played. With none left,
  it fetches the previous playlist row, album track (season order), or episode (publish date).
  With shuffle on, it only restarts. Account queue history is no longer what Previous uses.
- **Add by RSS.** In scope. Mobile Add by RSS items get next and previous through their feed,
  matching web.
- **CarPlay, Android Auto, and lock screen with the app closed.** In scope. Write a bounded
  window of resolved auto-queue rows into the native queue snapshot, so the native engine can
  advance with the app closed. JS refills the window while it is running. Policy stays in shared
  TypeScript; native code only moves through the snapshot it was given.
- **Shared helpers.** Move the auto-queue source choice, the forward and backward walks, row
  mapping, and dedupe into `@podverse/playback-core`. Web and mobile both call the shared helper,
  so this set refactors web's auto-queue loader and Previous to use it.
- **Order against `cross-device-playback`.** `realtime-banner-notifications` and `auth-sessions`
  are on `develop` (account event stream, `accountSessionStore`). `cross-device-playback` is
  planned but not implemented: all 42 prompts are unticked and none of its new files exist on any
  branch. Both sets run in parallel worktrees. Cross-device starts after
  `auth-sessions-stream-close` merges. This set should merge first; whichever merges second
  rebases. Cross-device's plans 23, 25, 33, and 34 touch the same mobile skip next/previous code
  and web track-button hooks this set changes, so anchor by symbol and do not edit that set's
  plans.

### Review of the first planning pass

Answers to the decisions D1–D20 listed under "Decisions to review" in `00-SUMMARY.md`.

- **Accepted as the plans wrote them:** D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D15,
  D16, D17, D19, D20.
- **D7 confirmed.** "for Add by RSS, Next checks the manual queue first, the same as the end of an
  item, so the phone, the lock screen, CarPlay, and Android Auto share one advance path."
- **D13 changed (R29).** "Include clip and soundbite rows in the advance window, with their start
  and end times, so iOS and Android play that range. Do not end the window at the first clip or
  soundbite. Both engines already honor clipStartSeconds and clipEndSeconds."
- **D14 changed (R30).** "While JavaScript is running, pre-resolve the next Add by RSS episodes
  into the window as plain media URLs, using the shared walk. Livestreams stay manual-queue only.
  Do not copy feed passwords into the native cache. An enclosure that will not play as a plain URL
  ends the window."
- **D18 changed (R31).** "While the app is closed, an item the car starts that is not in the
  window still falls back to the account queue snapshot. When JavaScript returns, continue the
  saved playlist, album, or podcast if the playing item belongs to that source. Otherwise refill
  from that item own podcast or album."

### Review of the second planning pass

Answers after Close. The first-pass answers still stand.

- **R32.** When the app reopens on a manual-queue item the car started, keep the saved playlist
  behind that queue, the same as on the phone. A same-podcast episode outside the saved rows, and
  not in that manual queue, still refills from its own channel.
- **R33.** The chapter-end id mismatch gets a plan in this set. When an item ends, the phone
  compares the engine id with `playbackTargetRowMediaId`. For a chapter that is the chapter id,
  and the engine reports the item id, so the comparison never matches and `advance('complete')`
  does not run.

## Glossary

- **forward fill** — the auto-queue loading the next items after the one playing, so Next has
  somewhere to go.
- **auto-queue** — the client-only buffer of upcoming rows chosen from the source being played
  (playlist, album or music channel, podcast channel). Separate from the account queue the user
  builds by hand.
- **car/auto** — CarPlay and Android Auto.
- **forward button** — the mobile full player's Next track button.

## Orientation

Facts checked in the invoking chat. Anchor by symbol; other work is landing.

### Web (source of truth)

- `apps/web/src/contexts/AutoQueue.tsx` — `AutoQueueConfig` (`playlist_id_text`, `disabled`,
  `random`, `repeat`, `nextPage`, `shuffleHash`), `checkIsActiveRowHighestKey`,
  `autoQueueIncrementActiveRow`, and the `aqc.rd` / `aqc.rp` cookies. Row 0 is now playing.
- `apps/web/src/hooks/useAutoQueueLoadResources.tsx` — source choice: a sequential playlist uses
  `reqPlaylistResourceGetManyForQueueByListPosition`, a shuffled playlist
  `reqPlaylistResourceGetManyByShuffle`, music `reqItemGetManyForQueueBySeason`, a podcast
  `reqItemGetManyForQueueByPubDate`, a shuffled channel `reqItemGetManyByChannelShuffle`. Repeat
  wraps to page 1, the channel's season start, or the channel's recent list. Shuffle dedupes ids.
  Mobile duplicates all of this.
- `apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts` — when the playing item
  changes, `fetchAutoQueueResources` reloads if the active row is the highest key or the buffer
  is empty. Mobile has no such eager reload. `handleLoadAutoQueueItem` uses
  `musicIntent: 'fresh_transition'`.
- `apps/web/src/hooks/useTrackPreviousButtonActions.ts` — web Previous (see Operator answers).
  A long press skips the 3-second restart.
- `apps/web/src/hooks/useTrackNextButtonActions.ts`,
  `apps/web/src/components/MediaPlayer/Buttons/TrackNextButton.tsx` — Next is never disabled. It
  calls `moveNowPlayingToHistory`, then `queueResourcesLoadActive`. Add by RSS uses
  `addByRSSPlayNext` with a list context.
- `apps/web/src/lib/playlist/playablePlaylistResource.ts` — `isPlayablePlaylistResource`. Mobile
  inlines a slightly different removed-source check.
- `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` — the player decision
  contract.
- An explicit play passes a new `AutoQueueConfig` (keeps random and repeat, sets
  `playlist_id_text`, `nextPage: 1`, a new `shuffleHash`) with `autoQueueShouldClear: true`.
  Moves within the auto-queue pass `autoQueueShouldClear: false`.

### Shared

- `packages/playback-core/src/resolveQueueAdvance.ts` and `index.ts` — `resolveQueueAdvance`
  order: hold, play the next manual row, advance the auto-queue, stop. No auto-queue source helper
  exists yet.

### Mobile

- `apps/mobile/src/lib/autoQueue/autoQueue.ts` — `AutoQueueDirective` (clear, preserve,
  seed-playlist), `resolveAutoQueueConfigAfterDirective`, `toggleAutoQueueShuffle`.
- `apps/mobile/src/hooks/useAutoQueueLoadResources.ts` — the mobile copy of the web loader. It
  takes an explicit seed and returns the row map.
- `autoQueueRepository.ts` (mobile data layer) — the same endpoints behind an auth-refresh
  wrapper. Not cached in SQLite.
- `apps/mobile/src/screens/player/FullPlayerScreen.tsx` — **the Next bug.** `autoUpcomingCount`
  counts auto-queue rows above `autoQueueActiveRow`, and
  `canSkipToNext = hasNextQueueItem(manualUpcomingCount, autoUpcomingCount)`. After an explicit
  play the auto-queue rows are cleared and nothing refills them; the only `loadAutoQueueResources`
  call on this screen is in `handleToggleShuffle`. So with an empty account queue, Next stays off
  mid-series. `autoQueueSeedFromTarget` returns null for Add by RSS and livestreams.
- `apps/mobile/src/components/player/FullPlayerTransportRow.tsx` —
  `nextDisabled = !hasEpisodeChaptersForTrackButtons && !hasNextQueueItem`.
- `apps/mobile/src/components/player/fullPlayerRows.ts` — `hasNextQueueItem`,
  `canAdvanceToNextQueueItem`, `upcomingManualCountFromCombined`,
  `shouldClearNowPlayingAfterAdvance`.
- `apps/mobile/src/playback/PlaybackProvider.tsx` (large file; read by symbol) —
  `applyAutoQueueDirective` empties the rows on `clear`, and explicit plays (`playItem` and the
  like) pass `{ mode: 'clear' }`. Also `currentAutoQueueSeed` (null for Add by RSS and
  livestreams), `computeHasAutoQueueNext`, `advanceAutoQueue`, `resolveHasAutoQueueRow`,
  `probeHasQueueAhead`, `advance`, `resolvePreviousQueueResource` (reads account queue history
  page 1), `skipToPrevious`, `skipToPreviousTrack`, `skipToNext`, `skipToNextTrack`, and the
  remote track command handlers.
- `apps/mobile/src/playback/previousAction.ts` — `resolvePreviousAction`, `resolveNextAction`,
  `PREVIOUS_CHAPTER_GRACE_SECONDS = 3`.

### Native engine and car/auto

- `apps/mobile/modules/podverse-media-engine/ios/PodverseAudioEngine.swift` and the Android
  `PodverseAudioEngine.kt` — `jsOwnsAdvance`. `handleItemEnded` and `advanceToNextCachedItem`
  walk the queue snapshot (`queueAv` / `queueMusic` in `PodverseNativeCache`).
- `apps/mobile/src/data/nativeCache/projection.ts` — writes that snapshot
  (`writeQueueSnapshotAv`, `writeQueueSnapshotMusic`). Today it holds the account queue only.
- `apps/mobile/modules/podverse-media-engine/README.md` — the "Known gap" about refilling the
  auto-queue while the app is closed, and the native cache method table.
- Rules: `mobile-carplay-android-auto` (policy in playback-core; native is transport only),
  `reuse-beyond-components` (share the decision; storage and fetch stay per surface).

### Docs

- `docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md` —
  the mobile queue parity doc to update.
