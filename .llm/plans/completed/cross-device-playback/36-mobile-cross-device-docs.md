**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 36 — Mobile cross-device playback docs

Record how the phone takes part in cross-device playback, so the next change to
`PlaybackProvider` or the account stream keeps its rules. Plans 30–35 hold the reasoning; this
plan copies the rules that must stay true, in present tense, with no plan numbers in the text
(**comments-future-forward** applies to docs too).

Read plans 30–35 in `.llm/plans/active/cross-device-playback/` (or `completed/` if they moved), and
the code they produced under `apps/mobile/src/playback/crossDevice/`, before writing. Where the
code and a plan disagree, describe the code and report the difference.

## Rows

R53, R56, R60

## Runs after

35

## Files

apps/mobile/APPS-MOBILE.md
.cursor/skills/mobile-playback/SKILL.md

## `apps/mobile/APPS-MOBILE.md`

Add a `## Cross-device playback` section directly after the "Notification stream" subsection that
realtime plan 40 adds. When that subsection is not there, put it after `## Player UI (Track 11)`.
Keep it short (about 20 lines), with these points:

- Playback events ride the account event stream; there is no second connection. The phone takes
  part when signed in with a membership, Offline Mode is off, and terms allow sync.
- `src/playback/crossDevice/` holds the pure store and rules (Vitest) and
  `useCrossDevicePlayback`, which `PlaybackProvider` calls once.
- The store holds other devices' state for display only. Nothing in it writes the outbox, the
  journal, history, queue rows, or `playbackProgressStore`.
- The phone appears in the device list while the app is open, or in the background while it plays.
  There is no grace period after a background pause. The stream closes and the phone leaves the
  list within a few seconds. iOS suspends the app and Android stops JS timers, so a grace could not
  end on time.
- Background publishing and check-ins run from native progress samples, not timers.
- How to see it work: sign in to the same member account on the phone and on web, play on one,
  and watch the other.

## `.cursor/skills/mobile-playback/SKILL.md`

Add a `## Cross-device playback (live control)` section directly after `## Same-item multi-device
adoption`, in the skill's terse do-and-don't style:

- **Roles:** `active` plays and publishes; `remote` sends commands; `idle` plays locally and
  claims. Route by the store's `availability === 'ready'` and `role`; read it at call time.
- **Claims:** every local start claims, whatever started it (app, lock screen, headset, car,
  command). An auto-advance while already active does not claim, so a device that lost the role
  stops on the 409 instead of taking it back.
- **Stopping for another device is silent:** pause the engine and write no playback event. A pause
  event would put this item back as the account's now-playing. That is the same rule as
  `adoptRemotePlaybackPosition`.
- **Commands** run through the normal local actions, so they write the events a tap would. Live
  items take no seek or rate. Mobile never reports `autoplay_blocked`.
- **The 744 prompt** waits while the view is `pending`, stays closed while any device is active,
  and works as before when nobody is active or the phone cannot see other devices. Do not show it
  together with live control.
- **Remote to idle:** load the shared item paused, with no events. Do nothing on a cold open.
- **Background:** no grace period. Do not drive background work from `setTimeout` or
  `setInterval`; Android does not fire them there. Use progress samples or request settles.
- **Next and previous** commands run on the playing phone as taps of its own Next and Previous
  buttons, on its own queue. A phone in the remote role sends them instead of moving locally.
- **Commanded starts:** when `take_over`, `play_item`, or `seek` lands at or past the length of
  the file this phone loaded, start 5 s before that length (`clampCommandStartToFileEnd`).
- **Late end on a remote phone:** a phone that is no longer the playing device does not
  auto-advance when its own file ends; only the playing device fires end reached, auto-advance,
  history, journal, and position events.
- **Don't:** add a second stream, or write remote positions anywhere.

Also add one line to the end of `## Same-item multi-device adoption`: while another device is
active, the live control replaces the prompt; see the new section.

## Tests

none (documentation)

## Release scratchpad

none
