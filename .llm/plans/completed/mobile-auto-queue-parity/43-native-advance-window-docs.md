**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 43 — Docs and checklists describe the native advance window

Replace the media-engine README's "Known gap" about app-closed auto-queue with what plans 40–42 and
44 built, add the advance window to the native cache tables, the queue parity doc's native car
section, the car cache rule, and the **mobile-playback** skill, and add operator checklist rows per
platform that prove an app-closed advance past the end of the manual queue and through a clip,
that the app continues the saved source when it opens (also behind a manual-queue item the car
started), and that Add by RSS entries are written without credentials. Docs only.

## Rows

R5, R9, R28, R29, R30, R31, R32

## Runs after

34, 40, 41, 42, 44

## Files

apps/mobile/modules/podverse-media-engine/README.md
apps/mobile/modules/podverse-media-engine/CARPLAY-SIMULATOR-CHECKLIST.md
apps/mobile/modules/podverse-media-engine/ANDROID-AUTO-DHU-CHECKLIST.md
docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md
.cursor/rules/mobile-carplay-android-auto.mdc
.cursor/skills/mobile-playback/SKILL.md

## Design

Read the code plans 40–42 and 44 produced before writing (`advanceWindow.ts`,
`queueEntryMapping.ts`, `useNativeAdvanceWindow.ts`, `nativeAdvanceSource.ts`,
`adoptEngineSource` and `enrichAdoptedSource` in `PlaybackProvider.tsx`, and
`advanceToNextCachedItem`, the clip-end branch, and `clearEventSink` in both `PodverseAudioEngine`
files) and describe it as it stands.

### `apps/mobile/modules/podverse-media-engine/README.md`

- CarPlay section, the **Known gap** bullet: replace it with an **App-closed advance** bullet:
  - While JS runs, it owns advance (`setJsOwnsAdvance(true)`) and the auto-queue fills in
    `@podverse/playback-core` as in the app.
  - JS also writes `advance-window.json`: the play order after the playing item (the manual
    queue's upcoming rows for that medium, then up to 10 resolved automatic rows), with the
    playing item's `kind` and id as the anchor. Automatic rows are auto-queue rows (items, clips,
    and soundbites) or, for an Add by RSS episode, that feed's next episodes.
  - Each entry carries its engine `kind`; clip and soundbite entries carry `clipStartSeconds` and
    `clipEndSeconds`. Rows are matched by `kind` plus id, so a clip and its full episode are
    separate rows.
  - When JS is not running, `ended`, a clip's end, and a remote Next play the next window entry
    when the loaded item is the anchor or is in the window; at the window's end playback stops;
    any other item walks the account queue snapshot as before.
  - Add by RSS entries are plain media URLs or downloads. Feed passwords and auth headers are
    never written; an entry whose media needs them and is not downloaded ends the window.
  - Native takes advance back as soon as the module that owns the event sink goes away.
  - When the app runs again and picks up the playing item, it continues the source the window came
    from (the same playlist, album, or podcast rows and settings, or the same Add by RSS feed) if
    the item is one of its rows. An item in the account queue (now playing or upcoming) keeps the
    whole saved playlist, album, or podcast behind the queue, as a manual-queue play in the app
    does, even when it is not one of those rows. Any other item, even from the same podcast,
    refills from its own podcast or album. The source is kept on the device and deleted on
    sign-out.
  - Not covered: an item the car starts that is not in the window (no automatic rows until the
    app runs again), livestreams (manual queue only). Previous with the app closed restarts the
    track.
- "Native cache" method table (the `| Method (JS → native) |` table): add a row after
  `writeQueueSnapshotMusic`: `writeAdvanceWindow` · "play order after the playing item: manual
  upcoming, then resolved automatic rows (kind, clip range); anchor kind + id + medium" ·
  "app-closed advance". Do not realign the table's columns.
- Durable storage table: add `advance-window.json` to the iOS filenames cell (Android reads "same
  filenames").
- The sentence "Native stores an opaque snapshot, ignores unknown keys, and does not re-decide
  queue rules" stays; add "The advance window is a list to step through, not a rule set."

### Checklists

Append rows to each table in the table's existing column style (do not realign other rows):
16 and 17 on both; the Add by RSS row, 18, on Android only; then the queue-item row on both (18 on
CarPlay, 19 on Android). The car cannot start an Add by RSS episode (the library
index lists no Add by RSS children), and iOS has no way to drop the JS runtime while the engine
keeps playing, so the Add by RSS part of the window is checked by reading the file.

- `CARPLAY-SIMULATOR-CHECKLIST.md`:
  - 16 **Auto-queue continues, app closed** · "Empty the queue; on the phone play the
    second-newest episode of a podcast with at least three episodes, seek to about 30 seconds
    before the end, and pause; force-quit; in the car play the same episode from Podcasts →
    channel (it resumes near the end); let it finish" · "The newest episode starts without the
    phone opening; opening the phone later shows it in the mini-player, and the up-next rows
    refill".
  - 17 **Clip in the auto-queue, app closed** · "Empty the queue; on the phone play a playlist
    whose first row is an episode and whose second row is a clip; seek the episode to about 30
    seconds before its end and pause; force-quit; in the car play the same episode from Podcasts
    → its channel; let it finish" · "The clip starts at its start time and stops at its end, then
    the playlist's third row starts; opening the phone shows that row in the mini-player, and up
    next continues the same playlist".
  - 18 **Queue item keeps the playlist behind it** · "Add an episode that is not in the playlist
    to the queue; on the phone play the first row of a playlist with at least three episode rows
    and pause; force-quit; in the car start the queued episode from Queue/Recent; open the phone
    while it plays" · "The mini-player shows the queued episode and Next is enabled; when it ends,
    the playlist's second row starts".
- `ANDROID-AUTO-DHU-CHECKLIST.md`:
  - 16 **Auto-queue continues, app closed** · "Empty the Music queue; on the phone play the first
    track of an album with at least three tracks;
    `adb shell am force-stop com.podverse.app.next`; play the same track from Auto; press Next
    twice" · "Tracks two and three play in album order; `adb logcat` shows one `sourceChanged` per
    track; the phone shows track three when opened".
  - 17 **Clip in the auto-queue, app closed** · the same steps as CarPlay row 17, with
    `adb shell am force-stop com.podverse.app.next` for the force-quit and Auto for the car · the
    same expected result.
  - 18 **Add by RSS window contents** · "On a debug build, play the second-newest episode of an
    Add by RSS feed that needs no password; run `adb shell run-as com.podverse.app.next cat
    files/native-cache/advance-window.json`; repeat with a feed that needs a password and has no
    downloads" · "The first file has `anchorKind` `add_by_rss` and the feed's next episodes as
    `add_by_rss` entries with media URLs. The second has no entries, or only entries with a
    `downloadFileName`; no URL in either file contains `@` before its host".
  - 19 **Queue item keeps the playlist behind it** · "Add a track that is not in the playlist to
    the Music queue; on the phone play the first row of a playlist with at least three track rows
    and pause; `adb shell am force-stop com.podverse.app.next`; in Auto start the queued track
    from Queue; open the phone while it plays" · "The mini-player shows the queued track and Next
    is enabled; when it ends, the playlist's second row starts".

### `DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md`

- §11 Native car layer: after "The JS write-path is the auto-queue/queue store from sections 6–8;
  the read-path is native.", add a paragraph:
  - The native advance window (`advance-window.json`) carries the play order after the playing
    item: manual upcoming for that medium, then up to 10 automatic rows. Those are auto-queue rows
    resolved by the shared helper (items, clips, and soundbites with their ranges), or the next
    Add by RSS episodes from the shared feed walk as plain media URLs. JS rewrites it after every
    load, refill, and queue change, and the in-app fill keeps 10 rows ahead for it.
  - With JS gone, the engine steps through the list and makes no choices of its own.
  - When JS returns it adopts the playing item. If the item is in the device's copy of the account
    queue, the whole saved auto-queue buffer is restored with its active row, the same as the
    `preserve` directive a manual-queue load (`playQueueResource`) uses. Otherwise, if the item is one of
    the rows the window was built from, the saved auto-queue buffer (or Add by RSS feed) continues
    from it with the same settings; otherwise JS refills from the item's own podcast or album.
  - **Agreed difference:** a car Queue tab start keeps the saved source, while a tap on the phone's
    queue screen clears the auto-queue. The car start behaves as a manual-queue play.
  - **Agreed difference:** web has no native window; mobile needs one because native code cannot
    run the TypeScript walk. Another client reuses `fillAutoQueueAhead` with its own fetchers; a
    native client reads the advance window.
- §13 Known deferrals: add "Car-started items outside the advance window get no app-closed
  automatic continuation, and livestreams stay manual-queue only."
- Do not touch the sections plan 34 rewrote.

### `.cursor/rules/mobile-carplay-android-auto.mdc`

- "Native cache" table: add a row after "Queue snapshot": `Advance window` · "Play order after the
  playing item for app-closed advance (kind and clip range per entry)".
- The "Don't duplicate queue policy in native" bullet: append "; native steps through the advance
  window JS wrote, matching rows by kind and id".
- Add one bullet under the credential guidance the rule already has (or at the end of its "Don't"
  list when it has none): "Don't write Add by RSS feed passwords, auth headers, or credentialed
  media URLs into any native cache file."

### `.cursor/skills/mobile-playback/SKILL.md`

- § Native car cache writes: add two sentences: "`useNativeAdvanceWindow` rewrites
  `advance-window.json` (manual upcoming, then up to `NATIVE_ADVANCE_WINDOW_AUTO_ROWS` automatic
  rows: auto-queue items, clips, and soundbites, or the next Add by RSS episodes) after each load,
  refill, and queue change; native walks it only while JS does not own advance. It also saves the
  window's source (`nativeAdvanceSourceRepository`), which `adoptEngineSource` continues when the
  adopted item is one of its rows, and keeps whole behind the queue when the adopted item is in
  the account queue." Change nothing else in the skill.

## Constraints

- Docs describe the behavior as it stands; no plan numbers, no "previously" or "was".
- No third-party media-player comparisons (**no-third-party-media-player-style**).
- Do not realign Markdown tables; add rows only.

## Tests

none (docs and operator checklists only)

## Release scratchpad

none
