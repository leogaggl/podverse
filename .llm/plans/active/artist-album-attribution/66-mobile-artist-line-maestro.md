**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 66 — Maestro: artist line on the track screen, mini player, and full player

Extends the existing music flow `apps/mobile/e2e/track.yaml` to assert the artist lines plans 61,
62, and 63 add, using the seed from plan 11: album `e2eMusicAlbm01` ("E2E Music Album") is
verified to artist `e2eMusicChnl01` ("E2E Music Artist"). Mobile E2E uses the same seed
(`make mobile_e2e_seed`). No new flow file: `track.yaml` already opens the album, the track screen,
the mini player, and the full player in that order.

## Rows

R8, R27, R28, R32, R38

## Runs after

61, 62, 63

## Files

apps/mobile/e2e/track.yaml

## Reuse

The flow's existing steps and testIDs, the `TIMEOUT_*` ladder (**mobile-maestro-timeouts**), and
the pattern `track.yaml` already uses for links: a link's accessible name carries its text, so
assert `id` plus a `text` regex on the link itself (as `full-player-title-link` does).
`MarqueeText` puts its `testID` on a wrapper `View`, so the mini player's text is asserted by text
alone.

## `apps/mobile/e2e/track.yaml`

1. Update the header comment to: `# Music detail and transport parity: album More opens track
   detail (row press plays), the album byline names the verified artist, the mini player and full
   player show the artist, skip-next advances to the next seeded track, and the track byline opens
   the artist.`

2. After `- assertVisible:` / `id: track-detail-album-header` add:

```yaml
- assertVisible:
    id: track-detail-artist-link
    text: ".*E2E Music Artist.*"
```

3. After `- assertVisible:` / `id: mini-player` (before `- tapOn:` / `id: mini-player`) add:

```yaml
- assertVisible:
    id: mini-player-subtitle
- assertVisible:
    text: ".*E2E Music Artist · E2E Music Album.*"
```

4. After the block that asserts `full-player-title-link` with `text: ".*E2E Music Track One.*"`
   and before `- takeScreenshot: track-full-player-controls` add:

```yaml
# Track title, then the artist, then the album.
- assertVisible:
    id: full-player-artist-link
    text: ".*E2E Music Artist.*"
- assertVisible:
    id: full-player-channel-link
```

5. At the end of the flow, after the final `- assertVisible:` / `id: playback-active-e2e`, add:

```yaml
# Closing the player returns to the track screen; its byline opens the artist page.
- extendedWaitUntil:
    visible:
      id: track-detail-screen
    timeout: ${TIMEOUT_SLOW}
- tapOn:
    id: track-detail-artist-link
- extendedWaitUntil:
    visible:
      id: artist-detail-screen
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: track-artist-link-opens-artist
```

The full player's artist link is asserted but not tapped: after skip-next the second seeded track
is playing, and it can reach its end and dismiss the player while the flow navigates. The tap
target and its routing are the same `onOpenContent` path the album line already exercises in
`player-screen.yaml`.

## Must stay true

- Every existing step and screenshot name in `track.yaml` stays, in order.
- YAML strings use double quotes.

## Tests

This plan is the test: `track.yaml` (Maestro, iOS and Android phone slots).

## Release scratchpad

none
