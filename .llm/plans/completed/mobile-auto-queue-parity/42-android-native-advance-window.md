**Cursor model:** Opus 5.5 · **Reasoning:** high

# 42 — Android engine advances through the advance window when JS is not running

Teach the Android media engine to store and read `advance-window.json` (written by JS in plan 40)
and to walk it on `STATE_ENDED`, at a clip's end, and on a remote Next (Android Auto, the media
notification, a headset) while JS does not own advance. Window entries can be items, clips,
soundbites, or Add by RSS episodes; native loads each with its own `kind` and clip range. Also hand
advance back to native when the JS module that owns the event sink goes away. Native code only
steps through the list it was given.

Parity source: the engine's own `advanceToNextCachedItem` (account queue snapshot walk), and plan
41 for iOS. The two platforms follow the same step rule.

## Rows

R11, R19, R21, R29, R30

## Runs after

none

## Files

apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCache.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCacheModel.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseMediaEngineModule.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseAudioEngine.kt
release-notes/scratchpad.md

## Payload contract (from plan 40)

```json
{
  "schemaVersion": 2,
  "updatedAtMs": 1761300000000,
  "mediumBucket": "music",
  "anchorIdText": "abc123",
  "anchorKind": "item",
  "entries": [
    { "idText": "def456", "title": "…", "mediaUrl": "https://…", "artworkUrl": "…",
      "podcastTitle": "…", "artist": "…", "durationMs": 240000,
      "startPositionSeconds": null, "kind": "item", "downloadFileName": "downloads/def456.mp3" },
    { "idText": "sb321", "title": "…", "mediaUrl": "https://…", "artworkUrl": "…",
      "podcastTitle": "…", "artist": null, "durationMs": 1800000,
      "startPositionSeconds": 95, "kind": "item_soundbite", "clipStartSeconds": 95,
      "clipEndSeconds": 125, "downloadFileName": null }
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

### `PodverseNativeCache.kt`

- `PodverseNativeCacheKind`: add `ADVANCE_WINDOW("advance-window.json")` after `QUEUE_MUSIC`.
  `debugDump` maps `values()`, so it reports the new file.
- `clearAccountScopedFiles`: add `PodverseNativeCacheKind.ADVANCE_WINDOW` to `kinds` (the window
  holds manual queue rows, which are account data). Update its doc comment's list if it has one.

### `PodverseNativeCacheModel.kt`

- `QueueEntry`: add `val kind: String = "item"`, `val clipStartSeconds: Double? = null`, and
  `val clipEndSeconds: Double? = null`. The defaults keep any other constructor call compiling.
- Extract the per-element body of `parseQueueSnapshot` into
  `private fun parseQueueEntry(obj: JSONObject): QueueEntry?` (same rules: non-blank `idText` and
  `title`, the same optional fields). It also reads `kind` with `optStringOrNull(obj, "kind") ?:
  "item"` and the two clip fields the way it reads `startPositionSeconds` (present, not null, and
  finite, else null). `parseQueueSnapshot` uses it. Snapshot entries already carry `kind: "item"`
  and no clip fields, so the snapshot walk behaves as before.
- Add:

  ```kotlin
  data class AdvanceWindow(
    val mediumBucket: String,
    val anchorIdText: String?,
    val anchorKind: String,
    val entries: List<QueueEntry>,
  )

  fun parseAdvanceWindow(json: String?): AdvanceWindow? {
    val root = decodeEnvelope(json, "advance-window") ?: return null
    val array = root.optJSONArray("entries")
    val entries = ArrayList<QueueEntry>()
    if (array != null) {
      for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        parseQueueEntry(obj)?.let { entries.add(it) }
      }
    }
    return AdvanceWindow(
      mediumBucket = optStringOrNull(root, "mediumBucket") ?: "av",
      anchorIdText = optStringOrNull(root, "anchorIdText"),
      anchorKind = optStringOrNull(root, "anchorKind") ?: "item",
      entries = entries,
    )
  }
  ```

### `PodverseMediaEngineModule.kt`

After the `AsyncFunction("writeQueueSnapshotMusic")` block, add `AsyncFunction("writeAdvanceWindow")`
in the same form, writing `PodverseNativeCacheKind.ADVANCE_WINDOW`.

### `PodverseAudioEngine.kt`

1. **`advanceToNextCachedItem()`** — before reading the queue snapshot:

   ```kotlin
   val medium = (loadedMeta?.get("queueMedium") as? String) ?: "av"
   val currentId = loadedMeta?.get("idText") as? String
   val currentKind = (loadedMeta?.get("kind") as? String) ?: "item"
   when (val step = advanceWindowStep(ctx, currentId, currentKind, medium)) {
     is AdvanceWindowStep.Play -> { startNativeAdvance(ctx, step.entry, medium); return }
     AdvanceWindowStep.End -> return
     AdvanceWindowStep.NotInWindow -> Unit
   }
   // existing queue snapshot walk, unchanged (it matches idText only), ending in
   // startNativeAdvance(ctx, next, medium)
   ```

   - `private sealed interface AdvanceWindowStep { data class Play(val entry:
     PodverseNativeCacheModel.QueueEntry) : AdvanceWindowStep; data object End :
     AdvanceWindowStep; data object NotInWindow : AdvanceWindowStep }` inside the object.
   - `private fun advanceWindowStep(ctx: Context, currentId: String?, currentKind: String, medium:
     String): AdvanceWindowStep`: parse `PodverseNativeCache.read(ctx,
     PodverseNativeCacheKind.ADVANCE_WINDOW)`. `NotInWindow` when the parse is null, `currentId` is
     null, or `window.mediumBucket != medium`. When `currentKind == window.anchorKind && currentId
     == window.anchorIdText`: `Play(entries[0])`, or `End` when `entries` is empty. When an entry
     at index `j` has `kind == currentKind && idText == currentId`: `Play(entries[j + 1])`, or
     `End` when `j` is the last index. Otherwise `NotInWindow`: the window belongs to another
     item, so the snapshot walk decides, as today.
   - `End` stops where it is. Falling through to the snapshot walk there would replay the
     snapshot's first entry, which is an older item.
   - `private fun startNativeAdvance(ctx: Context, next: PodverseNativeCacheModel.QueueEntry,
     medium: String)`: the existing tail moved — the download-first URI resolution
     (`filesDir/downloads`, the `downloads/` prefix strip, remote fallback; null returns), the meta
     JSON, and the `loadAndStart` call. Two changes from the moved code:
     - The meta's `kind` is `next.kind` instead of the literal `"item"`, and it carries
       `clipStartSeconds` and `clipEndSeconds` when they are non-null. The rest stays: `idText`,
       `queueMedium`, `title`, `origin: "car"`, `isLive: false`, `artworkUrl` when present. The
       engine already reads the clip end from the meta at load (`progressRunnable` pauses there),
       and the playback journal records the meta's `kind`, so a clip's listening is journaled as
       a clip.
     - `loadAndStart(ctx, uri, next.startPositionSeconds ?: next.clipStartSeconds, null, null,
       metaJson)`. JS sets the start to the clip's start; the fallback keeps a clip from starting
       at zero if only the bound is present. The two nulls stay (`basicAuth`, `audioProfile`):
       window entries are plain URLs by contract.

     Both paths call it, so there is one copy.
2. **Clip end advances** — in `progressRunnable`, the branch that handles `position >= clipEnd`
   pauses, journals `completed`, publishes `ENDED`, emits `ended`, stops progress updates, and
   returns. Before the return, call `advanceToNextCachedItem()` when `!jsOwnsAdvance`, the same
   rule the `STATE_ENDED` branch applies. With JS running nothing changes: JS receives `ended`
   and advances.
3. **`clearEventSink(owner)`** — inside the owner-matched branch, after `eventSink = null`, set
   `jsOwnsAdvance = false`. With no sink nobody receives `ended` or `remoteTrackCommand`, so native
   must advance. A newer module that already installed its sink does not match the owner and is
   left alone; its `PlaybackProvider` sets `jsOwnsAdvance` true again on mount.
4. Leave `handleRemoteTrackCommand`, `PREVIOUS_RESTARTS_AFTER_MS`, and `PodverseSessionPlayer`'s
   command set as they are: Previous with JS gone still restarts the track, and Next and Previous
   stay music only.
5. The `STATE_ENDED` branch already calls `advanceToNextCachedItem()` when JS does not own advance;
   no change there.

## Constraints

- No queue policy in Kotlin: no source choice, no fetch, no shuffle or repeat, no row skipping
  beyond the list order.
- Match window rows on `kind` plus `idText`; the snapshot walk keeps matching `idText` only.
- Tolerant parsing: a missing, unparseable, or wrong-version file behaves as "not in window".
- Engine state changes stay on the main thread (`onMain`), as the surrounding code does.
- `PodverseMediaLibraryService` (browse tree, resumption) is unchanged; the Queue node keeps
  listing the account queue only.
- Comments describe the code as it stands; no plan numbers.

## Tests

No native unit-test harness exists for the media engine. Plan 43 adds the Android Auto DHU
checklist rows that prove an app-closed advance past the end of the manual queue and through a
clip.

## Release scratchpad

```markdown
## Android engine walks the advance window with the app closed

- Surfaces: mobile (Android native media engine)
- Change: the Android engine stores `advance-window.json` and, when the app is not running, moves to the next entry in it at the end of an item, at the end of a clip or soundbite's range, or on an Android Auto, notification, or headset Next, before falling back to the account queue snapshot. Clip and soundbite entries play only their range; Add by RSS entries play their plain media URL or download. Entries are matched by kind and id, so a clip and its full episode are separate. When the app's JavaScript runtime goes away, the engine now takes advance back right away instead of waiting for a listener that is gone. Sign-out deletes the file with the other account-scoped car files.
- Who notices: Android Auto and notification listeners with the app closed
- Operator steps: ships with the next native Android build
```
