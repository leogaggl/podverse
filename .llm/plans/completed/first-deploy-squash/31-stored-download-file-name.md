**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Stored downloads are a file name

Completed downloads persist a file name via `toStoredDownloadFileName`. Readers still rebase a stored absolute `file://` path so an older v5 install keeps playing. After this squash the tester deletes the app, and new rows are file names. Stop treating an absolute stored path as a download. Keep joining a file name, or `downloads/<name>`, onto the current documents directory. That join is what makes an update survive an iOS container path change.

## Rows

R19, R26

## Runs after

none

## Files

- apps/mobile/src/downloads/downloadStorage.ts
- apps/mobile/src/downloads/downloadStorage.test.ts
- apps/mobile/src/downloads/downloadManager.ts
- apps/mobile/src/downloads/unsubscribedDownloadChannels.test.ts
- apps/mobile/src/prefs/downloadPrefs.ts
- apps/mobile/src/lib/playback/resolvePlaybackUrl.test.ts
- apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlaySceneDelegate.swift
- apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseMediaLibraryService.kt

## Tests

Update the Vitest files listed above. No Maestro flow. Playback from a completed download is already covered by `resolvePlaybackUrl.test.ts` once the fixtures store a file name. Native Swift and Kotlin have no unit target for this branch.

## Release scratchpad

Do not edit `release-notes/scratchpad.md` in this prompt. The set's last prompt appends this entry:

```markdown
## Mobile downloads resolve a stored file name

- Surfaces: mobile
- Change: a stored download path is a file name or `downloads/<name>`. An absolute `file://` path
  is no longer rebased onto the documents directory. The unused auto-delete aliases
  `readDownloadAutoDeleteEnabled` and `writeDownloadAutoDeleteEnabled` are gone. The toggle still
  uses `downloads.auto_delete`.
- Who notices: an install whose download rows still hold absolute paths. Those files do not
  resolve until the app is deleted and installed again.
- Operator steps: none beyond that reinstall
```

## Path resolution

`resolveStoredDownloadFilePath` in `downloadStorage.ts`:

- Empty input stays empty.
- A value that starts with `downloads/` drops that prefix, then joins through `buildDownloadFilePath`.
- Every other value is the file name and joins the same way.
- Do not special-case `file://`, `content://`, or a leading `/`.

Keep `toStoredDownloadFileName` as it is. `downloadManager` `enqueue` completion still passes the Expo result URI, which is absolute, and this function reduces it to a file name. Keep the comment that an absolute `file://` path embeds the iOS container UUID. Rename the test `strips a legacy absolute file URI to the file name` to `strips an absolute file URI down to the file name`.

Rewrite the doc on `resolveStoredDownloadFilePath` so it names a file name or `downloads/<name>`. Delete the resolve test `rebases a legacy absolute path onto the current document directory`. Keep the bare-name join test. Add a test that `downloads/itemABC.mp3` and `itemABC.mp3` join to the same path.

`absoluteDownloadPath` in `downloadManager.ts`: the comment is `Absolute file:// for a stored download file name.`

In `reconcileInterruptedDownloads`, stop passing `filePath: toStoredDownloadFileName(record.filePath)` when a partial file is marked complete. Drop the comment `Normalize legacy absolute rows to a relative file name.` Keep the byte-size and `status: 'complete'` patch. `toStoredDownloadFileName` stays imported for the enqueue completion write.

## Playback fixtures

`resolvePlaybackUrl` calls `resolveStoredDownloadFilePath` before `getInfoAsync`. In `resolvePlaybackUrl.test.ts` the mock `documentDirectory` is `file:///`, and the stored fixtures are `file:///downloads/ep-1.mp3`, which only round-trip because of the rebase. Store `ep-1.mp3` (and `ep-gone.mp3` in the missing-file case). The expected absolute URL stays `file:///downloads/ep-1.mp3`. Replace the mock comment about stored `file://` rows rebasing.

Do not edit `planDownloadCompletePlaybackHandoff.test.ts`. Its `file://` strings are the planner's local URL, and `resolveDownloadHandoffRecord` already covers a bare stored name. Do not edit `downloadQuota.test.ts`.

## Native car resolvers

`resolveDownloadFileURL` in `PodverseCarPlaySceneDelegate.swift` and `resolveDownloadFileUri` in `PodverseMediaLibraryService.kt`:

- Keep the `content://` return. That is a platform URI the engine accepts, not an older download row.
- Keep the `downloads/` prefix strip and the bare file name.
- Remove the branch that takes the last path segment of a `file://` or leading-`/` value.
- Remove the fallback that returns the original `file://` string when that absolute file still exists.

A stored `file://` value then fails the documents-directory lookup and the caller uses the remote enclosure.

## Auto-delete aliases and comments

In `downloadPrefs.ts`:

- Replace the file comment with the current fact: the limit-reached auto-delete toggle is the AsyncStorage key `downloads.auto_delete`.
- Delete `readDownloadAutoDeleteEnabled` and `writeDownloadAutoDeleteEnabled`. Nothing else in the repo references them. Callers use `readDownloadAutoDeleteOnLimitEnabled` and `writeDownloadAutoDeleteOnLimitEnabled`.
- Rewrite the comment on `readDownloadQuotaBytes` so an unset value returns `DEFAULT_DOWNLOAD_QUOTA_BYTES`. Delete the sentence about a previous 3 GiB cap and about older installs. Keep the `'unlimited'` sentinel. `writeDownloadQuotaBytes` still writes it.

## Test name

In `unsubscribedDownloadChannels.test.ts`, rename `resolves a missing channel id from the channel_item hint so older rows still appear` to `resolves a missing channel id from the channel_item hint`. Keep the body. Episode list payloads omit `channel` today, so the hint is current behavior. Do not change `groupUnsubscribedDownloadChannels`.

## Leave in place

- `import * as FileSystem from 'expo-file-system/legacy'` everywhere. That is the Expo SDK module path, not an older v5 install.
- `downloadsRepository.backfillMissingChannelTitles` and its call in `downloadManager` `ensureHydrated`. A new download can lack a channel title because the list payload omitted it. That call is area B's repository; do not edit `apps/mobile/src/data/**`.
- The `downloads/` prefix. `NativeCacheDownloadEntry.filePath` in area B's `projection.ts` documents that shape, and this plan keeps the reader.
