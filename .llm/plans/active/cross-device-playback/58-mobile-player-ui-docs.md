**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 58 — Document the phone's player for another device's playback

Short additions so the next contributor knows where the remote player lives and which rules it
follows. Plan 36 writes the cross-device sections these extend.

Before editing, confirm plan 36's `## Cross-device playback` section exists in
`apps/mobile/APPS-MOBILE.md` and its `## Cross-device playback (live control)` section exists in
`.cursor/skills/mobile-playback/SKILL.md`, and that plans 50–57 and 59 are in. If not, stop and
report.

## Rows

R65, R67, R73, R80, R83, R90, R92

## Runs after

57, 59, 36

## Files

apps/mobile/APPS-MOBILE.md
.cursor/skills/mobile-playback/SKILL.md
.cursor/rules/mobile-player-fixed-region.mdc

## `apps/mobile/APPS-MOBILE.md`

At the end of `## Cross-device playback`, add a `### Player UI` subsection of about twelve lines:

- `src/playback/crossDevice/crossDevicePlayerDisplay.ts` decides whether the player draws this
  phone's playback or another device's: `ready`, `remote`, a shared item, and no clip authoring
  hold. `useCrossDevicePlayerDisplay.ts` exposes it to the mini player, the full player, rows, and
  the device menu.
- The status line ("Playing on {device}", "Paused on…", "Starting on…", "Sending to {device}…")
  comes from `resolvePlayerStatusLine` and reads the shared `media_player.cross_device` keys web
  uses. "Sending to" shows during a transfer in the local player too.
- While remote, the mini player and the full player (`FullPlayerRemoteRegion`) show the shared
  item. Title links, Share, and Add to Playlist are built from the summary's reference and
  `medium`; Add by RSS needs the feed on this phone (`useDisplayedAddByRssResourceData`).
  Previous and next send `previous` and `next` to the playing device. Rows mark that item and
  toggle it. Livestreams show the item, Live, previous, next, and play/pause.
- Chapters follow the item the player shows (`useNowPlayingChapters`), so the segment strip, the
  full player band (chapter on line 1, status on line 2), and the chapter rows
  (`usePlayingChapterIdText`) use the other device's estimated position while remote.
- The device button (`PlaybackDeviceButton`) shows with two or more connected devices and opens the
  device menu. `CrossDevicePlaybackNotice` (mounted in `App.tsx`) shows transfers and controls that
  did not reach the other device as a dialog; web shows a toast for the same failures, on purpose.
- The lock screen, media notification, CarPlay, and Android Auto show only the phone's own player.
- Signed-out users and non-members never see any of this; availability stays `off`.
- Maestro: `playback-cross-device` (a host script plays the second device; sequential slots only).

## `.cursor/skills/mobile-playback/SKILL.md`

At the end of `## Cross-device playback (live control)`, add five bullets in the section's terse
style:

- **Drawing the other device:** read `useCrossDevicePlayerDisplay` (mini and full player) or
  `usePlaybackRowDisplay` (rows). Do not compare `activeTarget` alone; a superseded local item stays
  loaded and paused under the remote display.
- **Remote progress** comes from `useRemotePlaybackPositionSeconds` and the store's position clock,
  never from `playbackProgressStore`. Remote duration is `state.duration_seconds`.
- **One item for chapters:** `useNowPlayingChapters` and every `useNowPlayingAddByRssSections`
  caller take the item from the display (`useDisplayedAddByRssResourceData` for Add by RSS); two
  callers asking for different items make the single-entry caches fight.
- **Failure notice is a dialog on purpose:** web uses a toast; the phone has no toast system and
  the failure can arrive after the menu closed. Keep the reasons and copy aligned, not the
  mechanism.
- **Native surfaces stay local:** lock screen, notification, and car show and control the phone's
  own player; pressing play there takes playback over.

## `.cursor/rules/mobile-player-fixed-region.mdc`

In `## Required`, after the band-order bullet, add one bullet: the remote region
(`FullPlayerRemoteRegion`) keeps the same bands and heights, always reserves the segment band (the
chapter on its first line when there is one, the "Playing on {device}" status line on its second,
or the status line alone), and has no section chips or pane. Moving between the local and the
remote region counts as a new item.

## Tests

none (documentation)

## Release scratchpad

none
