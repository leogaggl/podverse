# CarPlay — simulator checklist (car-phone continuity)

**Audience:** operator / QA. Proves CarPlay works with the phone app closed, and that the phone
catches up afterward.

**Prerequisites:** CarPlay audio entitlement ([`CARPLAY-ENTITLEMENT.md`](./CARPLAY-ENTITLEMENT.md));
dev client built after cache v2 + tab IA landed; phone app opened once while signed in (or signed
out) so JS wrote `library-index`, `library-children/*`, dual queues, `history-index`, `live-index`,
`downloads-index`, and `account-context` under the App Group `native-cache` directory.

## Scenarios (15)

Mark each pass/fail. Force-quit means swipe away from app switcher; reboot means restart the phone
before connecting CarPlay; locked means phone locked in a pocket.

| # | Scenario | Steps | Pass when |
| --- | --- | --- | --- |
| 1 | Phone playing → car connects | Play on phone; connect CarPlay | Playback continues; car now-playing shows title/show/artwork; car controls work |
| 2 | Car disconnect | While car playing, unplug / end CarPlay | Playback pauses on route change; phone shows same item at same second |
| 3 | Car picks item, phone closed | Force-quit phone; play episode from Podcasts → channel; open phone later | Mini-player shows car item + position (offline and signed out included) |
| 4 | Signed in, phone never opened | Force-quit; listen on car | iOS: listening reaches server (journal + CarPlay connect sync); web/other device can resume |
| 5 | Passenger phone UI | Phone screen open while car plays; change item from car | Phone UI follows without reloading audio |
| 6 | Phone changes item while car connected | Change now-playing on phone | Car now-playing updates (shared engine) |
| 7 | Cold start, locked, offline | Reboot; lock phone; airplane mode; open CarPlay | Browse from cache; downloads play; stream rows alert “connection needed”; resume from journal/cache |
| 8 | Episode ends, app closed | Force-quit; play last-but-one queue item; let it finish | Next projected queue entry starts; finished item marked played in journal |
| 9 | Interruptions | Call / Siri; navigation prompt; another media app | Pause/resume/duck as appropriate; Play works again after another app takes over |
| 10 | Live | Open Podcasts → Live Now; play | Stream plays; seeking disabled / live in now-playing; not restored by position |
| 11 | Logout | Sign out on phone; reconnect car | Car shows signed-out Recent; account-scoped cache cleared |
| 12 | Other device | Play on web in between; open phone | Handoff: newest timestamp wins; car session counts as this device |
| 13 | Unknown item adopted | Force-quit; play a channel episode never opened on the phone; airplane mode; open phone | Mini-player shows the car's title, show, and artwork at once; Summary, chapters, and channel link fill in after going back online, with no audio reload |
| 14 | Progress in car lists | Listen partway on phone; finish another; reconnect car; open that channel | Partial episode reads "In progress" and resumes at its position; finished one reads "Played" and starts over |
| 15 | Music track skips | Play a Music queue track from the car | Now-playing shows next/previous track (not 15/30 s skips); next plays the following track (app open and force-quit); previous restarts after 3 s, otherwise plays the previous track when the app is open |

## Quick seed

```bash
# Mobile — open app, subscribe, download, queue something, then:
# Mobile CarPlay — I/O ▸ External Displays ▸ CarPlay (Device Hub / Simulator)
```

## Notes

- Tabs: Podcasts (Live Now first) | Music | Queue/Recent | Downloads.
- Membership never gates browse or play.
- Native advance owns skip/ended only when JS is not listening (`setJsOwnsAdvance`).
