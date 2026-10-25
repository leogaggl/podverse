**Cursor model:** Opus 5.5 · **Reasoning:** high

# 41 — iOS engine advances through the advance window when JS is not running

Teach the iOS media engine to store and read `advance-window.json` (written by JS in plan 40) and
to walk it on `ended`, at a clip's end, and on a remote Next while JS does not own advance. Window
entries can be items, clips, soundbites, or Add by RSS episodes; native loads each with its own
`kind` and clip range. Also hand advance back to native when the JS module that owns the event
sink goes away. Native code only steps through the list it was given; it makes no queue decision.

Parity source: the engine's own `advanceToNextCachedItem` (account queue snapshot walk). The window
walk reuses its URL resolution, meta shape, and `loadAndStart` call.

## Rows

R11, R19, R21, R29, R30

## Runs after

none

## Files

apps/mobile/modules/podverse-media-engine/ios/PodverseNativeCache.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlayCacheModel.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseMediaEngineModule.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseAudioEngine.swift
release-notes/scratchpad.md

## Payload contract (from plan 40)

```json
{
  "schemaVersion": 2,
  "updatedAtMs": 1761300000000,
  "mediumBucket": "av",
  "anchorIdText": "abc123",
  "anchorKind": "item",
  "entries": [
    { "idText": "def456", "title": "…", "mediaUrl": "https://…", "artworkUrl": "…",
      "podcastTitle": "…", "artist": null, "durationMs": 1800000,
      "startPositionSeconds": null, "kind": "item", "downloadFileName": null },
    { "idText": "clip789", "title": "…", "mediaUrl": "https://…", "artworkUrl": "…",
      "podcastTitle": "…", "artist": null, "durationMs": 1800000,
      "startPositionSeconds": 312, "kind": "clip", "clipStartSeconds": 312,
      "clipEndSeconds": 371, "downloadFileName": null }
  ]
}
```

- `entries` is the play order after the anchor and never contains it. Each entry has the queue
  snapshot entry fields plus optional `kind` (`"item"`, `"clip"`, `"item_soundbite"`,
  `"add_by_rss"`; missing means `"item"`), `clipStartSeconds`, and `clipEndSeconds`.
- `anchorKind` is the engine meta `kind` of the anchor (`"livestream"` is possible); missing means
  `"item"`. `mediumBucket` is `"av"` or `"music"`.
- An item is identified by `kind` plus `idText`, never `idText` alone: a clip and its full episode
  are different rows.
- An Add by RSS entry's `idText` is the Add by RSS media id, the same id the JS-built meta
  carries for that episode, so the same match covers it.

## Design

### `PodverseNativeCache.swift`

- `PodverseNativeCacheKind`: add `case advanceWindow` after `queueMusic`; `fileName`
  `"advance-window.json"`. `debugDump` already maps `allCases`, so it reports the new file.
- `clearAccountScopedFiles()`: add `.advanceWindow` to `kinds` (the window holds manual queue rows,
  which are account data). Update the doc comment's list ("queues, advance window, history, …").

### `PodverseCarPlayCacheModel.swift`

- `QueueEntry`: add `let kind: String`, `let clipStartSeconds: Double?`, and
  `let clipEndSeconds: Double?`.
- Extract the per-element body of `parseQueueSnapshot` into
  `private static func parseQueueEntry(_ element: Any) -> QueueEntry?` (same guards: object,
  non-blank `idText` and `title`). It also reads `kind` with `nonBlankString(obj["kind"]) ??
  "item"` and the two clip fields the way it reads `startPositionSeconds` (a finite number, else
  nil). `parseQueueSnapshot` loops with `compactMap` over it. Snapshot entries already carry
  `kind: "item"` and no clip fields, so the snapshot walk behaves as before. Update every other
  `QueueEntry(...)` initializer call, if any, with `kind: "item"` and nil bounds.
- Add:

  ```swift
  struct AdvanceWindow {
    let mediumBucket: String
    let anchorIdText: String?
    let anchorKind: String
    let entries: [QueueEntry]
  }

  static func parseAdvanceWindow(_ json: String?) -> AdvanceWindow? {
    guard let root = decodeEnvelope(json, label: "advance-window") else { return nil }
    let entries = (root["entries"] as? [Any])?.compactMap(parseQueueEntry) ?? []
    return AdvanceWindow(
      mediumBucket: nonBlankString(root["mediumBucket"]) ?? "av",
      anchorIdText: nonBlankString(root["anchorIdText"]),
      anchorKind: nonBlankString(root["anchorKind"]) ?? "item",
      entries: entries)
  }
  ```

### `PodverseMediaEngineModule.swift`

After `AsyncFunction("writeQueueSnapshotMusic")`, add the same form:

```swift
AsyncFunction("writeAdvanceWindow") { (payloadJson: String) in
  PodverseNativeCache.write(.advanceWindow, json: payloadJson)
}
```

### `PodverseAudioEngine.swift`

1. **`advanceToNextCachedItem()`** — before reading the queue snapshot, try the window:

   ```swift
   let medium = loadedSource?.meta?.queueMedium ?? "av"
   let currentId = loadedSource?.meta?.idText
   let currentKind = loadedSource?.meta?.kind ?? "item"
   switch advanceWindowStep(currentId: currentId, currentKind: currentKind, medium: medium) {
   case .play(let next):
     startNativeAdvance(next, medium: medium)
     return
   case .end:
     return
   case .notInWindow:
     break
   }
   // existing queue snapshot walk, unchanged (it matches idText only), ending in
   // startNativeAdvance(next, medium: medium)
   ```

   - `private enum AdvanceWindowStep { case play(PodverseCarPlayCacheModel.QueueEntry); case end;
     case notInWindow }`.
   - `private func advanceWindowStep(currentId: String?, currentKind: String, medium: String) ->
     AdvanceWindowStep`: parse `PodverseNativeCache.read(.advanceWindow)`. `.notInWindow` when the
     parse is nil, `currentId` is nil, or `window.mediumBucket != medium`. When `currentKind ==
     window.anchorKind && currentId == window.anchorIdText`: `.play(entries[0])`, or `.end` when
     `entries` is empty. When an entry at index `j` has `kind == currentKind && idText ==
     currentId`: `.play(entries[j + 1])`, or `.end` when `j` is the last index. Otherwise
     `.notInWindow`: the window belongs to another item, so the snapshot walk decides, as today.
   - `.end` stops playback where it is. Falling through to the snapshot walk there would replay
     the snapshot's first entry, which is an older item.
   - `private func startNativeAdvance(_ next: PodverseCarPlayCacheModel.QueueEntry, medium: String)`:
     the existing tail of `advanceToNextCachedItem` moved — `resolveQueuePlayableURL(next)` (nil
     returns), the meta dictionary, JSON encoding, and the `loadAndStart` call. Two changes from
     the moved code:
     - The meta's `kind` is `next.kind` instead of the literal `"item"`, and it carries
       `clipStartSeconds` and `clipEndSeconds` when they are non-nil. The rest stays: `idText`,
       `queueMedium`, `title`, `origin: "car"`, `isLive: false`. The engine already reads the
       clip end from the meta at load (the periodic observer pauses there), and the playback
       journal records the meta's `kind`, so a clip's listening is journaled as a clip.
     - `initialSeekSeconds: next.startPositionSeconds ?? next.clipStartSeconds`. JS sets the start
       to the clip's start; the fallback keeps a clip from starting at zero if only the bound is
       present.

     Both the window and the snapshot paths call it, so there is one copy. `basicAuth` stays nil:
     window entries are plain URLs by contract.
2. **Clip end advances** — in `addPeriodicTimeObserver`, the branch that handles `position >=
   clipEnd` pauses, journals `completed`, publishes and emits `ended`, then returns. Before the
   return, call `advanceToNextCachedItem()` when `!jsOwnsAdvance`, the same rule the
   item-end observer applies. With JS running nothing changes: JS receives `ended` and advances.
3. **`clearEventSink(owner:)`** — inside the owner-matched branch, after clearing the sink, set
   `self.jsOwnsAdvance = false`. With no sink nobody receives `ended` or `remoteTrackCommand`, so
   native must advance. A newer module that already installed its sink does not match the owner
   and is left alone; its `PlaybackProvider` sets `jsOwnsAdvance` true again on mount.
4. Leave `handleRemoteTrackCommand`, `applyRemoteCommandAvailability`, and the 3-second restart as
   they are: Previous with JS gone still restarts the track, and Next stays enabled for music only.

## Constraints

- No queue policy in Swift: no source choice, no fetch, no shuffle or repeat, no row skipping
  beyond the list order.
- Match window rows on `kind` plus `idText`; the snapshot walk keeps matching `idText` only.
- Tolerant parsing: a missing, unparseable, or wrong-version file behaves as "not in window".
- All engine state changes stay on the main queue (`onMain`), as the surrounding code does.
- Comments describe the code as it stands; no plan numbers.

## Tests

No native unit-test harness exists for the media engine. Plan 43 adds the CarPlay Simulator
checklist rows that prove an app-closed advance past the end of the manual queue and through a
clip.

## Release scratchpad

```markdown
## iOS engine walks the advance window with the app closed

- Surfaces: mobile (iOS native media engine)
- Change: the iOS engine stores `advance-window.json` and, when the app is not running, moves to the next entry in it at the end of an item, at the end of a clip or soundbite's range, or on a car or lock screen Next, before falling back to the account queue snapshot. Clip and soundbite entries play only their range; Add by RSS entries play their plain media URL or download. Entries are matched by kind and id, so a clip and its full episode are separate. When the app's JavaScript runtime goes away, the engine now takes advance back right away instead of waiting for a listener that is gone. Sign-out deletes the file with the other account-scoped car files.
- Who notices: CarPlay and lock screen listeners with the app closed
- Operator steps: ships with the next native iOS build
```
