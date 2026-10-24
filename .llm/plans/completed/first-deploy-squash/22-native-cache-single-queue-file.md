**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 22 — Stop writing the single-file queue snapshot to the native cache

## Rows

R18, R25

## Runs after

none

## Files

apps/mobile/src/data/nativeCache/projection.ts
apps/mobile/src/data/nativeCache/projection.test.ts

## Why

`projection.ts` writes every queue snapshot twice: to the per-bucket file
(`writeQueueSnapshotAv` → `queue-snapshot-av.json`, or `writeQueueSnapshotMusic` →
`queue-snapshot-music.json`) and to the single file `queue-snapshot.json` through
`writeQueueSnapshot`. The comment above it says why: "Legacy single-file write keeps older
readers warm during the dual-queue transition."

The native readers in this monorepo never read `queue-snapshot.json` directly. iOS
`PodverseNativeCache.read(.queueAv)` and Android `PodverseNativeCache.read(QUEUE_AV)` fall back
to it only when `queue-snapshot-av.json` is missing, which happens only on a device whose last
write came from a build before the per-bucket files. There is no OTA update path
(`expo-updates` is not installed), so JS and native always ship together. After the reinstall in
plan 20 no device holds such a file. The single-file write is upgrade-only, and it can also put
a music payload where the AV fallback would read it.

## Changes in `projection.ts`

1. `projectQueueSnapshotToNativeCache`: delete the comment line and the
   `await writeToNativeCache('writeQueueSnapshot', payload);` line. The function writes only the
   bucket file (`writeQueueSnapshotMusic` for `music`, else `writeQueueSnapshotAv`).
2. `projectQueueSnapshotAvToNativeCache`: delete
   `await writeToNativeCache('writeQueueSnapshot', payload);`. It writes only
   `writeQueueSnapshotAv`.
3. `NativeCacheWriteMethod`: remove the `'writeQueueSnapshot'` member.
4. `NativeCacheDownloadEntry.filePath` doc comment: delete the sentence "Legacy absolute
   `file://` paths may still appear from older builds." Downloads store a file name
   (`toStoredDownloadFileName` in `src/downloads/downloadStorage.ts`); the remaining sentence
   already says native resolves it against the current documents directory.

Leave `projectQueueSnapshotMusicToNativeCache`, the payload builders,
`NATIVE_CACHE_SCHEMA_VERSION` (stays `2`; native readers expect exactly 2), and every caller
(`queueRepository.ts`, `exampleRepository.ts`, `carCacheReproject.ts`) unchanged.

Do not edit the bridge (`src/bridge/nativePlaybackBridge.ts`), the media-engine module types,
or native code. Those are area C files. The bridge keeps `writeQueueSnapshot` until area C
removes it after this plan.

## Tests

Update `apps/mobile/src/data/nativeCache/projection.test.ts` (unit, vitest, in the include list):

- Replace the module mock `{ nativePlaybackBridge: {} }` with one whose writer methods are
  `vi.fn()` spies created through `vi.hoisted`, resolving to `undefined`. The existing builder
  tests do not touch the bridge and keep passing.
- Add: `projectQueueSnapshotToNativeCache` with no `mediumBucket` calls `writeQueueSnapshotAv`
  once and never calls `writeQueueSnapshot`.
- Add: `projectQueueSnapshotToNativeCache` with `mediumBucket: 'music'` calls
  `writeQueueSnapshotMusic` once and calls neither `writeQueueSnapshot` nor
  `writeQueueSnapshotAv`.
- Add: `projectQueueSnapshotAvToNativeCache` calls `writeQueueSnapshotAv` once and never
  `writeQueueSnapshot`.
- Reset the spies between cases (`beforeEach` with `vi.clearAllMocks()`).

## Release scratchpad

```markdown
## Car cache writes only the per-medium queue files

- Surfaces: mobile (CarPlay, Android Auto)
- Change: the app no longer writes the single `queue-snapshot.json` native cache file next to
  `queue-snapshot-av.json` and `queue-snapshot-music.json`. Car surfaces already read the
  per-medium files.
- Who notices: nobody on a fresh install
- Operator steps: none
```
