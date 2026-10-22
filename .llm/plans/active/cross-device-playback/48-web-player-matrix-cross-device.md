**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 48 — Decision matrix: the cross-device remote view

`apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` is the regression oracle
for the player tree (`MediaPlayer.tsx` says so in its header comment). Cross-device playback adds
a second way the player is driven: in the `remote` role it shows another device's state and
sends commands instead of playing. This plan adds a section describing that behavior as it
stands after plans 22–26, 42–46, and 49, so the next change to the player tree checks it.

Documentation only. Describe the code as it stands (**comments-future-forward**); no plan
numbers, no "new", no history. Describe behavior in Podverse terms
(**no-third-party-media-player-style**).

Before writing, read the implemented files listed in **Sources** and describe what they do; where
the code differs from this plan's summary, the code wins.

## Rows

R58, R62, R64, R72, R74, R79, R81, R82, R89

## Runs after

42, 43, 44, 45, 46, 47, 49

## Files

apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md

## Where

- Add `## Section 7 — Cross-device remote view` directly before
  `## Cross-cutting side effects glossary`.
- In `## Scope`, add one bullet to the cross-reference list:
  `- Cross-device role, store, and commands: apps/web/src/contexts/CrossDevicePlayback.tsx + apps/web/src/lib/crossDevicePlayback/`.
- In `## Coverage`, add a bullet naming `apps/web/e2e/media-player-cross-device-remote.spec.ts`
  (two signed-in browser contexts) and the unit tests in `apps/web/src/lib/crossDevicePlayback/`.

Keep the file's existing heading style, table style, and line width (about 75 characters for
prose). Do not run Prettier on the file and do not realign existing tables.

## Section 7 content

Short intro: a tab has a cross-device role (`active`, `remote`, `idle`) from the store; in
`active` and `idle` every earlier section applies unchanged; in `remote` the local MediaPlayer
context is cleared and the cells below apply. The remote view's content comes from the shared
state's resource summary at once, then from the remote item's records once this tab has loaded
them (channel, item or clip, chapters, or the Add by RSS item from this account's queue).

### 7a. What the player shows (table)

Columns: situation · content · caption · progress · controls. Rows:

| Situation | Content | Caption | Progress | Controls |
| --- | --- | --- | --- | --- |
| Another device plays a non-live item | `displayState.resource`, then its records | Playing on {device} | remote estimate over `duration_seconds`, seek on release | play/pause, jumps, previous/next, speed, Add to Playlist, Share, device button |
| Another device is starting the item | same | Starting on {device} | same | same |
| Playing device pauses | same | Paused on {device} | frozen | same |
| Another tab of this browser plays (any status) | same | Playing in Another Tab | same | same |
| Another device plays a livestream | same | Playing on {device} (or Paused on, Starting on) | Live label | play/pause, previous/next, Add to Playlist, Share, device button |
| Narrow layout, music | same | same | same | previous/next instead of jumps |
| Narrow layout, other media | same | same | same | jumps instead of previous/next |
| Playing device stops (resource null) | bar hidden | — | — | — |
| Playing device leaves presence | local queue head, paused | none | local | local |
| Transfer pending (any role) | as above | Sending to {device}… | as above | as above |

Also in the remote view:

- Segment strip: names the chapter at the playing device's estimated position, or the clip or
  official clip; none for a live item. It follows the estimate, not a drag preview.
- Title, channel, and full-screen links: built from the summary's `medium` until records load,
  then as the local player builds them.
- Add to Playlist: opens the playlist modal with the loaded records; for an Add by RSS item it
  is disabled until this tab finds the item in this account's queue data.
- Share: shown in every role, including while this browser plays. It opens the existing share
  modal. In the remote role it uses the loaded records, and it is disabled for an Add by RSS
  item (no public page). In `active` and `idle` it uses the local player records and is disabled
  when those records have no channel and no item.

Hidden in the remote view: volume, mute, clip, repeat, shuffle, alternate enclosure, chapter
markers on the progress bar, clip and soundbite highlight on the progress bar, and video.

### 7b. Triggers in the remote role (table)

| Trigger | Result | Where |
| --- | --- | --- |
| Play/pause button, Space | `play` or `pause` command (target state) | `usePlayerTransport` |
| Jump buttons, arrow keys | absolute `seek` from the estimate, clamped | `usePlayerTransport`, `mediaPlayerWindowKeyDown.ts` |
| Previous/next buttons (desktop and narrow) | `previous` or `next` command | `useTrackPreviousButtonActions`, `useTrackNextButtonActions` |
| Progress click or drag | one `seek` on mouseup | `RemoteMediaPlayerProgress.tsx` |
| Speed in Settings | `set_rate` | `usePlayerTransport` |
| Add to Playlist | playlist modal with the loaded records; nothing sent | `PlaylistAddToButton.tsx` |
| Current remote chapter's play button | `play` or `pause` | `ListItemChapterRow.tsx`, `ItemChapterHeaderPlaySection.tsx` |
| Pick the item already playing there | `play` or `pause` | `useMediaPlayerResourceUpdate`, `usePlayAddByRSS` |
| Pick another item or a chapter | `play_item` | same |
| Pick that loads paused | nothing sent | same |
| Device menu: another device | take over on that device | `useCrossDevicePlaybackTransfer` |
| Device menu: This Device | local take over | same |

Fill the Where column from the actual files; keep the paths the code uses.

### 7c. Invariants

- Remote display writes nothing: no `setMPCurrentTime`, no history, no saved position
  (**playback-meaningful-events** in prose, without the skill name if the file does not use
  skill names).
- The remote progress bar's length is the playing device's `duration_seconds`, never this tab's
  media element.
- No command is a toggle on the wire; no `seek` or `set_rate` for a live item.
- Item rows and detail play buttons match the remote resource by item, clip, soundbite, or Add
  by RSS hash. Chapter rows match when the chapter at the playing device's estimated position is
  theirs; no chapter matches for a clip, official clip, live item, or Add by RSS item.
- The remote item's records load once per resource and only the newest load applies; rows read
  them and never start a load.
- A blocked start on the receiving tab shows Ready to Play Here; Play Here starts the media
  element inside the click. The sender shows one error toast per failure.

## Sources

`apps/web/src/hooks/useRemotePlayerDisplay.ts`, `apps/web/src/hooks/useRemotePlayerInfo.ts`,
`apps/web/src/hooks/useRemotePlayerResource.ts`,
`apps/web/src/hooks/useRemotePlaybackPositionSeconds.ts`,
`apps/web/src/hooks/usePlayerTransport.ts`,
`apps/web/src/hooks/useTrackNextButtonActions.ts`,
`apps/web/src/hooks/useTrackPreviousButtonActions.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlayerInfo.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlayerResourceStore.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlaybackClock.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.ts`,
`apps/web/src/components/MediaPlayer/Sliders/RemoteMediaPlayerProgress.tsx`,
`apps/web/src/components/MediaPlayer/Buttons/PlaylistAddToButton.tsx`,
`apps/web/src/components/MediaPlayer/Buttons/PlaybackDevicesButton.tsx`,
`apps/web/src/components/MediaPlayer/CrossDevice/CrossDevicePlaybackNotices.tsx`,
`apps/web/src/hooks/useCrossDevicePlaybackTransfer.ts`,
`apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts`.

## Tests

none (documentation)

## Release scratchpad

none
