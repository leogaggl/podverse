# Android Auto — DHU checklist (car-phone continuity)

**Audience:** operator / QA. Proves Android Auto works with the phone app force-stopped, and that
the phone / headless sync catches up afterward.

**Prerequisites:** Dev client on emulator/device; DHU set up
(<https://developer.android.com/training/cars/testing/dhu>); phone app opened once so JS wrote
cache v2 files under `files/native-cache/` (`library-index.json`, `queue-snapshot-av.json`,
`queue-snapshot-music.json`, `history-index.json`, `live-index.json`, `downloads-index.json`,
`account-context.json`, `library-children/`).

## Scenarios (15)

| # | Scenario | Steps | Pass when |
| --- | --- | --- | --- |
| 1 | Phone playing → Auto connects | Play on phone; start DHU / Auto | Playback continues; Auto now-playing has title/artist/artwork; transport works |
| 2 | Auto disconnect | Unplug / stop DHU while playing | Playback pauses; phone shows same item at same second |
| 3 | Auto picks item, phone closed | `adb shell am force-stop com.podverse.app.next`; play from Podcasts → channel; open phone | Mini-player shows Auto item + position (offline and signed out included) |
| 4 | Signed in, phone never opened | Force-stop; listen on Auto | Headless sync drains journal when it can; otherwise journal drains on next open; other devices resume |
| 5 | Passenger phone UI | Phone screen open while Auto plays | Phone UI follows car-initiated source without reload |
| 6 | Phone changes item while Auto connected | Change now-playing on phone | Auto now-playing updates (shared ExoPlayer) |
| 7 | Cold start, locked, offline | Reboot; lock; airplane mode; open Auto | Browse from cache; downloads play; stream rows fail softly; resume from journal/cache |
| 8 | Episode ends, app closed | Force-stop; play last-but-one queue item; let finish | Next projected queue entry starts; journal has completed + started |
| 9 | Interruptions | Call; navigation duck; another media app | Pause/resume/duck; Play works after focus loss |
| 10 | Live | Podcasts → Live Now | Stream plays; marked live; no position restore |
| 11 | Logout | Sign out; reopen Auto | Signed-out Recent; account-scoped cache cleared |
| 12 | Other device | Play on web; open phone | Handoff: newest timestamp wins |
| 13 | Unknown item adopted | Force-stop; play a channel episode never opened on the phone; airplane mode; open phone | Mini-player shows the Auto title, show, and artwork at once; Summary, chapters, and channel link fill in after going back online, with no audio reload |
| 14 | Progress in Auto lists | Listen partway on phone; finish another; reconnect Auto; open that channel | Partial episode shows the in-progress marker and resumes at its position; finished one shows played and starts over |
| 15 | Music track skips | Play a Music queue track from Auto | Next/previous buttons appear; next plays the following track (app open and force-stopped); previous restarts after 3 s, otherwise plays the previous track when the app is open; `adb logcat` shows one `sourceChanged` per track |

## Seed + force-stop

```bash
# Mobile Android Auto — after seeding in the phone app:
adb shell run-as com.podverse.app.next ls -la files/native-cache
adb shell am force-stop com.podverse.app.next
adb logcat -s PodverseNativeCache:I PodverseMediaLibrary:I PodverseCarSync:I PodverseCarHeadless:I
```

## Notes

- Tree: Podcasts / Music / Queue / Downloads (content-style grid for channels).
- Untrusted controllers (Bluetooth AVRCP, Assistant) get player commands only.
- Headless JS may fail under bridgeless Expo SDK 57; journal path still covers catch-up.
- Membership never gates browse or play.
