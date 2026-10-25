**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 33 — Full player Next turns on when a next row exists

Set the full player's Next enable state from the same sources `advance` uses: the manual queue for
the playing medium, the auto-queue rows already found, and the Add by RSS feed walk. Next turns on
once a later row is found and stays off at the true end of the series, playlist, album, or feed.
This is an agreed difference from web, where Next is never disabled.

Every either/or below is decided; follow it as written.

## Rows

R7, R14, R11

## Runs after

30, 32

## Files

apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/e2e/auto-queue-advance.yaml
release-notes/scratchpad.md

## Design

### PlaybackProvider (by symbol)

- Add `hasAutomaticNext: boolean` to `PlaybackSessionContextValue` and the session value
  (`sessionValue` memo, with its deps).
- Compute it from React state, not refs, so the full player re-renders when a fill lands:
  - an `add-by-rss` active target: `hasAddByRssNext` from `useAddByRssFeedWalk`;
  - a `livestream` target or no target: false;
  - otherwise: `hasAutoQueueRowAfter(autoQueueResources, autoQueueActiveRow)` from `useAutoQueue()`
    state (import from `@podverse/playback-core/autoQueue`).
- A fill in flight, a failed fill, and an exhausted source all read false: Next waits for a found
  row. `isAutoQueueExhausted` is not needed here; it stays the advance hint in
  `computeHasAutoQueueNext`.

### FullPlayerScreen (by symbol)

- Delete `autoUpcomingCount` and the `autoQueueResources` / `autoQueueActiveRow` reads that only
  it used (keep `autoQueueConfig` for shuffle and repeat).
- `canSkipToNext = canAdvanceToNextQueueItem(manualUpcomingCount, hasAutomaticNext)` (from
  `fullPlayerRows.ts`; replaces the `hasNextQueueItem` call). Keep the name `canSkipToNext` and
  the `hasNextQueueItem={canSkipToNext}` prop on `FullPlayerTransportRow`.
- The manual-count effect (the one that calls `fetchPrimaryQueue` and `fetchUpcoming`) reads the
  queue for the playing medium instead: `fetchQueueForMedium(playbackMediumIdFromTarget(activeTarget))`
  from `usePrimaryQueue`. `advance` and `probeHasQueueAhead` already use that medium, so the button
  and the action agree when a track plays while the podcast queue is active. Drop
  `fetchPrimaryQueue` from this screen if nothing else uses it.
- No change to `FullPlayerTransportRow.tsx`: it already disables Next when there are no chapters
  and nothing is next, and allows the episode-skip hold only when something is next.

### Maestro (`auto-queue-advance.yaml`)

The flow plays the first search result's first episode, which may be the newest, so it cannot
prove Next turns on. Change it to open a seeded podcast episode that has a newer episode in the
same channel (pick one from `tools/web/seed-e2e.mjs` under `e2ePodChnl001`; the deep-link form is
in `player-screen.yaml`: `podverse-next://podcast/<channel>/episode/<item>` plus
`shared/confirm-ios-open-dialog.yaml`). Pick an episode without chapters so Next's state depends
only on the queue. Then:

1. Tap `home-row-play-.*`, wait for `playback-active-e2e`, open the full player from `mini-player`.
1. `extendedWaitUntil` `full-player-skip-next` with `enabled: true`, `${TIMEOUT_SLOW}`. This is the
   eager fill reaching the screen.
1. Screenshot, tap `full-player-skip-next`, wait for `playback-active-e2e`, screenshot.

Update the flow's header comment to describe what it now proves. Keep the existing E2E skip-button
steps only if they still add something; the full-player tap exercises the same `skipToNext`.

## Constraints

- Keep the names and signatures of the session's skip functions; cross-device plan 55 reads
  `canSkipToNext` and the transport props by name.
- Comments describe the code as it stands; no plan numbers.

## Tests

- `fullPlayerRows.test.ts` already covers `canAdvanceToNextQueueItem`; no change.
- `auto-queue-advance.yaml` as above (needs Mobile E2E API and test assets, as it does now).
- `player-screen.yaml` keeps passing; it asserts the transport buttons are visible, not enabled.

## Release scratchpad

```markdown
## Mobile Next turns on once something is next

- Surfaces: mobile
- Change: the full player's Next button turns on as soon as the next episode, track, playlist row, or Add by RSS feed item is found, and stays off at the real end. It no longer stays off after you start an item in the middle of a series. The queued-items count it checks now comes from the queue for what is playing (podcast or music), the same queue Next plays from.
- Who notices: mobile listeners
- Operator steps: none
```
