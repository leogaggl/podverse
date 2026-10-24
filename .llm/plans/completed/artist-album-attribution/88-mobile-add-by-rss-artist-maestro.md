**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 88 — Maestro: an Add by RSS artist on mobile, end to end

One flow that adds plan 23's fixture artist on mobile and checks what plans 80–87 promise: the
artist's Albums tab lists its Add by RSS album and its directory album, its Tracks tab shows the
album's track, the player's artist line names and opens the artist, and the Add by RSS track page
links the artist. It ends by removing the artist.

## Rows

R8, R19, R42, R43, R45, R50, R53

## Runs after

23, 61, 82, 83, 84, 86, 87

## Files

apps/mobile/e2e/add-by-rss-artist.yaml
scripts/mobile/e2e-test.sh
apps/mobile/e2e/README.md

## Reuses

- `apps/mobile/e2e/add-by-rss-track.yaml` for the add steps, the chip reveal, the Go to Track
  path, and the play-to-full-player path. Copy its step shapes; do not `runFlow` it.
- `shared/launch-and-connect.yaml`, `shared/login-seeded-user.yaml`,
  `shared/reveal-chip-row-trailing.yaml`, `shared/stack-back.yaml`.
- The `TIMEOUT_*` ladder (**mobile-maestro-timeouts**): the fastest rung that holds each wait.
- Plan 23's fixtures: artist `https://e2e-seed-addbyrss.example/artist.xml` ("E2E Add-by-RSS
  Artist") lists the Add by RSS album "E2E Add-by-RSS Album" first, the directory album
  "E2E Music Album" second, and an item-level reference to "E2E Add-by-RSS Track". The API's
  fixture branch writes the album's entry `parsed` at once, so the album sync job finishes on its
  first round.

## What the flow cannot check

- Your Add by RSS Albums on a directory artist page (R47, R49) and the R52 line: no fixture album
  names a directory artist, and the fixture directory album has verified data of its own. Plans
  81 and 86 cover them in unit tests.
- Follow and unfollow of a listed album (plan 83): `add-by-rss-track.yaml` follows the same
  album on the shared seeded account and never unfollows it, so whether it is listed-only depends
  on suite order. Do not assert Subscribe or the album's absence from the library.

## `apps/mobile/e2e/add-by-rss-artist.yaml` (new)

Header and comment in the style of `add-by-rss-track.yaml`: `appId: com.podverse.app.next`,
`name: Add By RSS Artist Flow`, and a comment stating what the flow covers and
`Needs flow_needs_e2e_api + flow_needs_test_assets.`

Steps, in order:

1. `runFlow: shared/launch-and-connect.yaml`, `runFlow: shared/login-seeded-user.yaml`.
2. Library → `library-nav-add-by-rss` → `rss-add-button` → `rss-url-input` →
   `inputText: https://e2e-seed-addbyrss.example/artist.xml` → `rss-add-submit` → wait for
   `rss-root-screen` (`TIMEOUT_SLOWER`).
3. Reveal and tap `rss-media-type-artists` (`shared/reveal-chip-row-trailing.yaml` with
   `CHIP_ROW_ID: rss-media-type-selector`, `TRAILING_ID: rss-media-type-artists`).
4. Wait for `id: "home-feed-row-title-.*"` with `text: E2E Add-by-RSS Artist` (`TIMEOUT_SLOW`) and
   tap it. Wait for `add-by-rss-home-detail-screen` (`TIMEOUT_FAST`).
5. Albums tab (the default for an artist): wait for `text: E2E Add-by-RSS Album`
   (`TIMEOUT_SLOWER`; the album sync job runs after the add), then `assertVisible` for
   `id: add-by-rss-artist-album-row-0`, `text: E2E Music Album`, and
   `id: add-by-rss-artist-album-row-1`. `takeScreenshot: add-by-rss-artist-albums`.
6. Tap `add-by-rss-home-section-tracks`. Wait for `id: "home-feed-row-title-.*"` with
   `text: E2E Add-by-RSS Track` (`TIMEOUT_SLOW`). `takeScreenshot: add-by-rss-artist-tracks`.
7. Tap that row (a track row plays). Wait for `playback-now-playing-title-e2e` with
   `text: E2E Add-by-RSS Track` (`TIMEOUT_SLOWEST`). Tap `mini-player`. Wait for
   `full-player-artist-link` (`TIMEOUT_FAST`) and `assertVisible` `text: E2E Add-by-RSS Artist`.
   `takeScreenshot: add-by-rss-artist-player-line`.
8. Tap `full-player-artist-link`. Wait for `add-by-rss-home-detail-screen` (`TIMEOUT_FAST`) and
   `assertVisible` `text: E2E Add-by-RSS Album` (the player opened the artist on Home, on its
   Albums tab).
9. Tap `add-by-rss-artist-album-row-0`. Wait for `add-by-rss-home-detail-screen` and
   `text: E2E Add-by-RSS Track`. Tap `id: "home-row-more-.*"`, then
   `id: "media-row-action-go-to-track.*"`, and wait for `add-by-rss-track-detail-screen`
   (`TIMEOUT_SLOW`).
10. `assertVisible` `id: add-by-rss-track-detail-artist-link`, `text: E2E Add-by-RSS Artist`.
    `takeScreenshot: add-by-rss-artist-track-byline`. Tap the link; wait for
    `add-by-rss-home-detail-screen` and `text: E2E Music Album` (the artist's Albums tab).
11. Cleanup: tap `add-by-rss-home-remove`. The artist screen pushed in step 10 pops, so wait for
    `add-by-rss-track-detail-screen` (`TIMEOUT_FAST`). The artist is gone from this account's
    follows, so a rerun adds it fresh. If area J's remove dialog (plans 90–99) lands first, its
    plan updates this step.

Use exact ids where the flow knows the index; regex ids only where `add-by-rss-track.yaml`
already does.

## `scripts/mobile/e2e-test.sh`

Add `add-by-rss-artist` to the `flow_needs_e2e_api` and `flow_needs_test_assets` case lists,
after `add-by-rss-track` in each.

## `apps/mobile/e2e/README.md`

In **Current flows**, add `` `add-by-rss-artist` `` after `` `add-by-rss-track` ``.

## Tests

This plan is the test. The operator runs:

```bash
npm run mobile:e2e:test -- add-by-rss-artist
```

## Release scratchpad

none
