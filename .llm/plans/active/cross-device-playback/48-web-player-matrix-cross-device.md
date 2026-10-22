**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 48 — Decision matrix: the cross-device remote view

`apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` is the regression oracle
for the player tree (`MediaPlayer.tsx` says so in its header comment). Cross-device playback adds
a second way the player is driven: in the `remote` role it shows another device's state and
sends commands instead of playing. This plan adds a section describing that behavior as it
stands after plans 22–26 and 42–46, so the next change to the player tree checks it.

Documentation only. Describe the code as it stands (**comments-future-forward**); no plan
numbers, no "new", no history. Describe behavior in Podverse terms
(**no-third-party-media-player-style**).

Before writing, read the implemented files listed in **Sources** and describe what they do; where
the code differs from this plan's summary, the code wins.

## Rows

R58, R62, R64

## Runs after

42, 43, 44, 45, 46, 47

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
context is cleared and the cells below apply.

### 7a. What the player shows (table)

Columns: situation · bar · title and artwork · caption · progress · controls. Rows:

| Situation | Bar | Content | Caption | Progress | Controls |
| --- | --- | --- | --- | --- | --- |
| Another device plays a non-live item | shown | `displayState.resource` | Playing on {device} | remote estimate, seek on release | play/pause, jumps, speed, device button |
| Another tab of this browser plays | shown | same | Playing in Another Tab | same | same |
| Another device plays a livestream | shown | same | Playing on {device} | Live label | play/pause, device button |
| Playing device pauses | shown | same | same | frozen | same |
| Playing device stops (resource null) | hidden | — | — | — | — |
| Playing device leaves presence | local queue head, paused | local | none | local | local |
| Transfer pending (any role) | as above | as above | Sending to {device}… | as above | as above |

Hidden in the remote view: next/previous track, volume, mute, clip, add to playlist, repeat,
shuffle, alternate enclosure, chapter markers, clip and soundbite highlight.

### 7b. Triggers in the remote role (table)

| Trigger | Result | Where |
| --- | --- | --- |
| Play/pause button, Space | `play` or `pause` command (target state) | `usePlayerTransport` |
| Jump buttons, arrow keys | absolute `seek` from the estimate, clamped | `usePlayerTransport`, `mediaPlayerWindowKeyDown.ts` |
| Progress click or drag | one `seek` on mouseup | `RemoteMediaPlayerProgress.tsx` |
| Speed in Settings | `set_rate` | `usePlayerTransport` |
| Pick the item already playing there | `play` or `pause` | `useMediaPlayerResourceUpdate`, `usePlayAddByRSS` |
| Pick another item | `play_item` | same |
| Pick that loads paused | nothing sent | same |
| Device menu: another device | take over on that device | `useCrossDevicePlaybackTransfer` |
| Device menu: This Device | local take over | same |

Fill the Where column from the actual files; keep the paths the code uses.

### 7c. Invariants

- Remote display writes nothing: no `setMPCurrentTime`, no history, no saved position
  (**playback-meaningful-events** in prose, without the skill name if the file does not use
  skill names).
- No command is a toggle on the wire; no `seek` or `set_rate` for a live item.
- Item rows and detail play buttons match the remote resource by item, clip, soundbite, or Add
  by RSS hash; chapter rows never match remotely.
- A blocked start on the receiving tab shows Ready to Play Here; Play Here starts the media
  element inside the click. The sender shows one error toast per failure.

## Sources

`apps/web/src/hooks/useRemotePlayerDisplay.ts`, `apps/web/src/hooks/usePlayerTransport.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.ts`,
`apps/web/src/lib/crossDevicePlayback/remotePlaybackRowMatch.ts`,
`apps/web/src/components/MediaPlayer/Sliders/RemoteMediaPlayerProgress.tsx`,
`apps/web/src/components/MediaPlayer/Buttons/PlaybackDevicesButton.tsx`,
`apps/web/src/components/MediaPlayer/CrossDevice/CrossDevicePlaybackNotices.tsx`,
`apps/web/src/hooks/useCrossDevicePlaybackTransfer.ts`,
`apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts`.

## Tests

none (documentation)

## Release scratchpad

none
