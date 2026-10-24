**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 38 — Remove the single-file queue kind from the native cache

After plan 22, JS writes only `queue-snapshot-av.json` and `queue-snapshot-music.json`. Nothing
writes `queue-snapshot.json`. The bridge method `writeQueueSnapshot`, the native `queue` / `QUEUE`
cache kind, and the native fallback from the AV queue file to that single file are left with no
writer. A fresh install never holds the single file, and plan 20's reinstall removes it from the
tester's phone. This plan removes all of it on JS, iOS, and Android in one change, so the module
interface and both native modules stay in agreement.

## Rows

R10, R19, R26

## Runs after

22, 32

Plan 22 stops the JS write and removes `'writeQueueSnapshot'` from `NativeCacheWriteMethod`. Plan
32 edits `PodverseNativeCache.swift`, `PodverseNativeCache.kt`, the engine README, and both spike
docs first (library filename). Re-read each of those files before editing; do not undo plan 32's
changes.

## Files

apps/mobile/src/bridge/nativePlaybackBridge.ts
apps/mobile/src/data/nativeCache/projection.test.ts
apps/mobile/modules/podverse-media-engine/src/NativePlaybackBridge.ts
apps/mobile/modules/podverse-media-engine/src/PodverseMediaEngineModule.ts
apps/mobile/modules/podverse-media-engine/ios/PodverseMediaEngineModule.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseNativeCache.swift
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseMediaEngineModule.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCache.kt
apps/mobile/modules/podverse-media-engine/README.md
apps/mobile/modules/podverse-media-engine/NATIVE-CACHE-SPIKE-IOS.md
apps/mobile/modules/podverse-media-engine/NATIVE-CACHE-SPIKE-ANDROID.md

## Before editing

`rg -n "writeQueueSnapshot\b" apps/mobile --glob '!node_modules/**'` must print only the files
this plan lists (plus `GO-NO-GO.md`, which stays). If `projection.ts` still prints, plan 22 has
not landed: stop and report it as a blocker.

## Edits — JS and module types

1. `apps/mobile/src/bridge/nativePlaybackBridge.ts`: delete the `writeQueueSnapshot(payloadJson)`
   method. Keep `writeQueueSnapshotAv` and `writeQueueSnapshotMusic`.
2. `apps/mobile/modules/podverse-media-engine/src/NativePlaybackBridge.ts`, interface
   `NativeCacheWriteBridge`: delete the doc comment "Legacy / dual-write now-playing + upcoming
   (prefer AV/Music writers)." and the `writeQueueSnapshot` member. Give `writeQueueSnapshotAv`
   the doc comment `/** Now-playing + upcoming for the podcast and video queue. */` and
   `writeQueueSnapshotMusic` the doc comment `/** Now-playing + upcoming for the music queue. */`,
   unless plan 22 or plan 32 already gave them one.
3. `apps/mobile/modules/podverse-media-engine/src/PodverseMediaEngineModule.ts`: delete the
   `writeQueueSnapshot(payloadJson: string): Promise<void>;` line.
4. `apps/mobile/src/data/nativeCache/projection.test.ts`: plan 22 added `vi.hoisted` writer spies
   and assertions that `writeQueueSnapshot` is never called. Delete the `writeQueueSnapshot` spy
   from the hoisted mock and every `expect(…writeQueueSnapshot…)` line. Keep the AV and music
   assertions and the `beforeEach` reset. Test titles that say "never calls writeQueueSnapshot"
   lose that clause (for example "calls writeQueueSnapshotAv once").

## Edits — iOS

5. `ios/PodverseMediaEngineModule.swift`: delete the `AsyncFunction("writeQueueSnapshot")` block
   (it writes `.queue`). Keep `writeQueueSnapshotAv` and `writeQueueSnapshotMusic`.
6. `ios/PodverseNativeCache.swift`:
   - `PodverseNativeCacheKind`: delete `case queue` and its `fileName` arm
     (`"queue-snapshot.json"`).
   - `read(_:)`: delete the `if kind == .queueAv { … return read(.queue) }` block. `.queueAv`
     then reads its own file through `readFile(url)` like every other kind.
   - `clearAccountScopedFiles()`: remove `.queue` from the `kinds` array. Keep the other kinds in
     their order.

## Edits — Android

7. `PodverseMediaEngineModule.kt`: delete the `AsyncFunction("writeQueueSnapshot")` block (it
   writes `PodverseNativeCacheKind.QUEUE`).
8. `PodverseNativeCache.kt`:
   - `PodverseNativeCacheKind`: delete `QUEUE("queue-snapshot.json"),`.
   - `read`: delete the `PodverseNativeCacheKind.QUEUE_AV -> { … }` arm. `QUEUE_AV` then falls to
     the `else` arm. If plan 32 left `LIBRARY_BROWSE` as its own arm that only reads its file,
     leave it as plan 32 wrote it.
   - `clearAccountScopedFiles`: remove `PodverseNativeCacheKind.QUEUE` from the list.

After the native edits, `rg -n "\.queue\b|PodverseNativeCacheKind\.QUEUE\b|QUEUE\(" apps/mobile/modules/podverse-media-engine`
prints nothing. `.queueAv`, `.queueMusic`, `QUEUE_AV`, and `QUEUE_MUSIC` stay.

## Edits — engine docs

Edit only the lines named here. Leave step numbers and other sentences as they are.

9. `README.md`:
   - The "Important distinction" paragraph names `` `writeQueueSnapshot` / `writeDownloadsIndex` /
     `writeLibraryBrowseIndex` ``. Replace `` `writeQueueSnapshot` `` with
     `` `writeQueueSnapshotAv` / `writeQueueSnapshotMusic` ``.
   - In the "Method (JS → native)" table, replace the `writeQueueSnapshot` row with two rows:
     `writeQueueSnapshotAv` (podcast and video now-playing + upcoming item ids / titles / urls;
     reader: car skip/advance, now-playing) and `writeQueueSnapshotMusic` (music now-playing +
     upcoming; same reader). Keep the table's pipe structure valid.
   - In the durable-storage filename table, replace `` `queue-snapshot.json` `` with
     `` `queue-snapshot-av.json`, `queue-snapshot-music.json` ``. If the Android row says "same
     three filenames", change it to "same filenames".
10. `NATIVE-CACHE-SPIKE-IOS.md` and `NATIVE-CACHE-SPIKE-ANDROID.md`: in the storage listing, replace
    the `queue-snapshot.json` line with two lines, `queue-snapshot-av.json` and
    `queue-snapshot-music.json`. In the proof commands, the `cat …/queue-snapshot.json` line reads
    `queue-snapshot-av.json`.

Do not edit `GO-NO-GO.md` (a dated gate record) or anything under `docs/proposals/`.

## Self-check

- `rg -n "writeQueueSnapshot\b|queue-snapshot\.json" apps/mobile --glob '!node_modules/**'` prints
  only `GO-NO-GO.md`.
- Do not run the mobile type-check. Plan 37 edits mobile files in the same phase; the operator's
  `npm run type-check:mobile` covers both.
- Swift and Kotlin are not compiled here. Read both native files once more after editing and
  confirm every `switch` / `when` over the kind is still exhaustive and no reference to the removed
  case remains.

## Tests

`projection.test.ts` loses the `writeQueueSnapshot` spy and assertions (step 4). No new tests.
Native Swift and Kotlin have no unit target for the cache reader. The operator's native rebuild
and the Maestro `hello-world` flow cover module registration; CarPlay and Android Auto reads stay
on the operator's car checklists.

## Release scratchpad

```markdown
## Car cache drops the single queue file

- Surfaces: mobile (CarPlay, Android Auto)
- Change: the native media engine no longer has a `writeQueueSnapshot` method or a
  `queue-snapshot.json` cache file. CarPlay and Android Auto read the podcast and video queue from
  `queue-snapshot-av.json` only, with no fallback, and the music queue from
  `queue-snapshot-music.json`.
- Who notices: nobody on a fresh install. Needs a native rebuild of the dev client.
- Operator steps: `npm run mobile:prebuild` before the next device build
```
