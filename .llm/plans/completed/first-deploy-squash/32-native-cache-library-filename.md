**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Library cache file is library-index.json

JS writes the car library payload as `library-index.json` (`PodverseNativeCacheKind.libraryBrowse` / `LIBRARY_BROWSE`) at schema version 2. iOS and Android still read `library-browse-index.json` when the current file is missing, and the engine docs still describe that older file, schema version 1, and a nil App Group id. A fresh install never writes the old file. Remove the fallback and make the docs match the code.

## Rows

R10, R19, R26

## Runs after

none

## Files

- apps/mobile/modules/podverse-media-engine/ios/PodverseNativeCache.swift
- apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCache.kt
- apps/mobile/modules/podverse-media-engine/README.md
- apps/mobile/modules/podverse-media-engine/NATIVE-CACHE-SPIKE-IOS.md
- apps/mobile/modules/podverse-media-engine/NATIVE-CACHE-SPIKE-ANDROID.md

## Tests

none. These modules have no unit target for the file-name fallback. Do not add a Maestro flow. The phone still projects the library index through the existing write path.

## Release scratchpad

Do not edit `release-notes/scratchpad.md` in this prompt. The set's last prompt appends this entry:

```markdown
## Car library cache reads library-index.json

- Surfaces: mobile
- Change: CarPlay and Android Auto read `library-index.json` only. They no longer fall back to
  `library-browse-index.json`. The payload schema version is 2.
- Who notices: a device that still has only the old filename. A fresh install writes the current
  file. The one mobile tester deletes the app.
- Operator steps: none beyond that reinstall
```

## Readers

`PodverseNativeCache.read` in `PodverseNativeCache.swift`: delete the `kind == .libraryBrowse` block, including the comment about a v2 file and the `library-browse-index.json` fallback. `.libraryBrowse` then uses the same `readFile(url)` path as the other kinds. `fileName` for that kind stays `library-index.json`.

Keep the `kind == .queueAv` fallback to `.queue`. Plan 38 removes the single queue kind and that fallback after plan 22 stops the JS write; this plan changes only the library file.

`PodverseNativeCache.read` in `PodverseNativeCache.kt`: the `LIBRARY_BROWSE` arm reads `library-index.json` when it exists and otherwise returns null. Delete the `library-browse-index.json` file. Keep the `QUEUE_AV` fallback to `QUEUE`.

Do not change `appGroupIdentifier`. It is already `group.com.podverse.app.next`. `baseDirectory()` prefers that group's container and falls back to Application Support `native-cache` when the group container is unavailable.

## Docs

Edit only the sentences that name the old file, schema version 1, or a nil App Group id. Do not rewrite the rest of either README or spike, and do not strip other step numbers from sentences you are not fixing.

`README.md`:

- In the browse-tree bullet, the Library payload file is `library-index.json`, not `library-browse-index.json`.
- In "Reserved native-cache write methods", `NATIVE_CACHE_SCHEMA_VERSION` is `2`. Point at `apps/mobile/src/data/nativeCache/projection.ts`. Do not say it is `1`.
- In the durable-storage filename table, the library file is `library-index.json`. The iOS location is the App Group container for `group.com.podverse.app.next` when that container resolves, otherwise Application Support `native-cache`.
- Delete the bullet that says `appGroupIdentifier` is nil until step 12.16 and that setting it migrates storage. Replace it with the current fact: the identifier is `group.com.podverse.app.next`, and `baseDirectory()` prefers that container.

`NATIVE-CACHE-SPIKE-IOS.md` and `NATIVE-CACHE-SPIKE-ANDROID.md`:

- The library file in the storage listing and in every `cat` command is `library-index.json`.
- Proof lines that expect `schemaVersion:1` or `"schemaVersion":1` expect `2`.
- The iOS "Storage location" section must not say `appGroupIdentifier` is nil. State the constant `group.com.podverse.app.next` and the Application Support fallback, matching `baseDirectory()`.
- Drop the sentence that setting the identifier later moves storage. Do not add a history of the old filename.

## Leave in place

- `queue-snapshot.json`, `queue-snapshot-av.json`, and `queue-snapshot-music.json` and every sentence about them. Plan 38 edits the queue lines.
- Schema-version mismatch handling that returns an empty tree when `schemaVersion` is not 2. That rejects a bad payload. It is not a reader for version 1.
- `CARPLAY-ENTITLEMENT.md` and `GO-NO-GO.md`. They already say the App Group id is set.
