**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 41 — Maestro: artist album groups and the Podcast Index preview

Plan 40 gives the artist screen section testIDs. Plan 13 puts three extra references on `e2eMusicChnl01`: a parsed album that does not name the artist back (`E2E Unclaimed Music Album`), a Not Yet Added album (`E2E Not Yet Added Album`, preview id 2147483631), and a reference Podcast Index does not know (`E2E Unknown Album`). Plan 11's verified album (`E2E Music Album`) and its two tracks stay. This plan extends `artist.yaml` to prove the groups. It does not add a second flow.

## Rows

R18, R20, R22, R23, R24

## Runs after

40, 13

## Files

apps/mobile/e2e/artist.yaml

## What the flow proves

Keep the existing launch, seeded login, deep link, chip asserts, album round trip, and track round trip. Insert the new asserts into that flow. Use `${TIMEOUT_*}` from `shared/timeouts.env`. Do not add a raw millisecond timeout except `waitToSettleTimeoutMs: 1000` on `scrollUntilVisible`, which the other flows already use.

After `artist-album-row-0` is visible, and before tapping it:

- `assertVisible` `artist-albums-verified-heading`.
- `assertNotVisible` text `E2E Unclaimed Music Album`.
- `assertNotVisible` text `E2E Unknown Album`.
- `scrollUntilVisible` on id `artist-albums-not-yet-added-heading`, direction `DOWN`, timeout `${TIMEOUT_FAST}`, `waitToSettleTimeoutMs: 1000`. The mini player can cover the bottom of the list.
- `assertVisible` `artist-albums-not-yet-added-note`.
- `assertVisible` `artist-album-unadded-row-0`.

Then the existing tap on `artist-album-row-0`, album detail, and back. `artist-album-row-0` is still the verified album (plan 40's per-section index). Do not tap the unadded row before that round trip.

After the flow is back on `artist-detail-screen` from the album:

- `scrollUntilVisible` `artist-album-unadded-row-0` the same way.
- Tap `artist-album-unadded-row-0`.
- `extendedWaitUntil` visible `pi-feed-preview-screen`, timeout `${TIMEOUT_SLOW}`.
- `assertVisible` text `E2E Not Yet Added Album`.
- Do not tap `pi-feed-add-button`. That starts a directory add and changes the seed. The button's presence is enough to show the existing add screen.
- Return with the same iOS edge swipe and Android `stack-header-back` the album round trip uses.
- `extendedWaitUntil` visible `artist-detail-screen`, timeout `${TIMEOUT_SLOW}`.

On the Tracks tab, with the existing wait for `artist-track-row-0`:

- `assertNotVisible` `artist-track-unadded-row-0`.
- `assertVisible` text `E2E Music Track One`.
- `assertVisible` text `E2E Music Track Two`. Track One is newer (`pub_date` offset 0 versus 60 seconds), so it is row 0. Both fit on the phone without a second scroll; if a run shows Track Two below the fold, `scrollUntilVisible` that text with `${TIMEOUT_FAST}` before the assert.

Leave the More → Go to Track path as it is. `showPlayBand` is already off for `mediaType="tracks"`, so `assertNotVisible` `home-row-play-.*` stays.

## Must stay true

- One flow file. No new yaml, no shared flow edit.
- Timeouts stay on the ladder. The preview wait matches the existing album-detail wait (`TIMEOUT_SLOW`), not `TIMEOUT_SLOWEST`.
- The flow does not add the fixture feed.

## Tests

Update `apps/mobile/e2e/artist.yaml` only. No unit test in this plan.

## Release scratchpad

none
