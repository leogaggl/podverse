**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 02 — Live HLS fixtures, seed, and E2E spec

## Rows

E2E coverage for live audio HLS and live video HLS on web.

## Runs after

01

## Files

- `tools/test-assets/src/asset-generator.ts`
- `tools/test-assets/src/generate-e2e-media-fixtures.ts`
- `tools/test-assets/assets/e2e/hls/e2e-hls-video-vod.m3u8` (generated, committed)
- `tools/test-assets/assets/e2e/hls/e2e-hls-video-vod-000.ts` … (generated segments, committed)
- `tools/test-assets/assets/e2e/hls/e2e-hls-video-event.m3u8` (generated, committed)
- `tools/test-assets/TOOLS-TEST-ASSETS.md` (only if it lists the HLS fixtures)
- `tools/web/seed-e2e.mjs`
- `apps/web/e2e/helpers/seedConstants.ts`
- `apps/web/e2e/media-player-livestream-hls-start.spec.ts` (new)
- `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`

## 1. Video HLS fixtures

In `asset-generator.ts`, add `generateHlsVideoFixtures(): Promise<void>` below
`generateHlsAudioFixtures`. Mirror its structure exactly: same `hls/` directory, skip-if-exists,
`ffmpeg-static` import and error text, basename rewrite of segment lines, then an EVENT copy.

- VOD playlist `e2e-hls-video-vod.m3u8`, segments `e2e-hls-video-vod-%03d.ts`.
- ffmpeg command (run with `cd "${dir}" &&` like the audio one):
  `"${ffmpegPath}" -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x240:rate=15:duration=6 -f lavfi -i sine=frequency=440:sample_rate=22050:duration=6 -c:v libx264 -preset ultrafast -crf 32 -pix_fmt yuv420p -g 30 -c:a aac -b:a 32k -ac 1 -ar 22050 -shortest -f hls -hls_time 2 -hls_playlist_type vod -hls_segment_filename "e2e-hls-video-vod-%03d.ts" "e2e-hls-video-vod.m3u8"`
  (`-g 30` puts a keyframe at every 2 s segment boundary.)
- EVENT playlist `e2e-hls-video-event.m3u8`: same transform as the audio EVENT playlist
  (`#EXT-X-PLAYLIST-TYPE:VOD` → `EVENT`, drop the trailing `#EXT-X-ENDLIST`).

Pull the basename rewrite and the EVENT transform into two small private helpers used by both
methods instead of copying them. Update the docblock of each method.

In `generate-e2e-media-fixtures.ts`, call `generateHlsVideoFixtures()` after
`generateHlsAudioFixtures()` with a one-line comment in the existing style. Then generate and
commit the files:

```bash
npm run generate:e2e-media -w podverse-test-assets
```

The audio fixtures already exist, so only the video files are written. If ffmpeg fails, stop and
report the error. Do not commit hand-written playlists.

## 2. Seed two live HLS items

In `tools/web/seed-e2e.mjs`, next to the existing `E2E_HLS_*` constants (around
`E2E_HLS_VOD_ENCLOSURE_URL`), add:

- `E2E_HLS_EVENT_PLAYLIST_URL = \`${E2E_HLS_ASSET_BASE_URL}/e2e-hls-event.m3u8\``
- `E2E_HLS_VIDEO_EVENT_PLAYLIST_URL = \`${E2E_HLS_ASSET_BASE_URL}/e2e-hls-video-event.m3u8\``

Next to the `E2E_LIVE_AV_*` constants add:

- `E2E_LIVE_AV_HLS_AUDIO_ITEM_ID_TEXT = 'e2eLiveHlsA01'`, title `'E2E Live HLS Audio Stream'`
- `E2E_LIVE_AV_HLS_VIDEO_ITEM_ID_TEXT = 'e2eLiveHlsV01'`, title `'E2E Live HLS Video Stream'`

Both ids are 13 characters, the same as `e2eLiveAud001`; check them against the
**e2e-seed-nano-id-limits** skill.

After the two existing playable `insertLiveItem` calls (audio, video) and before the scheduled one,
add two more calls with the same shape:

- audio: `guidSlug: 'live-hls-audio'`, `enclosureType: 'audio/mpeg'`,
  `enclosureUrl: E2E_HLS_EVENT_PLAYLIST_URL`
- video: `guidSlug: 'live-hls-video'`, `enclosureType: 'video/mp4'`,
  `enclosureUrl: E2E_HLS_VIDEO_EVENT_PLAYLIST_URL`

The enclosure type stays a progressive MIME on purpose: it labels the enclosure audio or video,
and the `.m3u8` path is what classifies the source as HLS (`isHlsSource`). That matches the seeded
VOD HLS episode. Extend the `console.log` summary line with the two new id texts.

Before you finish, grep `apps/web/e2e` for specs that count items or live items in
`e2eLiveAvChn01` (`E2E_LIVE_AV_CHANNEL_ID_TEXT`, `E2E Live AV Channel`). If one asserts a count,
update it and name it in your final message.

Mirror every new constant in `apps/web/e2e/helpers/seedConstants.ts`:
`E2E_HLS_VIDEO_EVENT_PLAYLIST_URL` next to `E2E_HLS_EVENT_PLAYLIST_URL`, and the four item
constants next to the `E2E_LIVE_AV_*` block. Rewrite that block's docblock: the progressive items
cover selection, controller, and portal; the HLS items cover live HLS playback and playlist
reload.

## 3. Spec `media-player-livestream-hls-start.spec.ts`

Follow `media-player-livestream-video-start.spec.ts` for structure: the same `loginSeedUser`,
`openLivestreamAndPlay`, `liveStreamMediaContainer`, `liveStreamMediaElement`,
`expectSingleSourcedMediaElement`, `captureVerifiedElement`, a docblock that cites matrix § 6a, and
full-sentence titles and steps (**e2e-readability**). `test.setTimeout(45_000)` in each test.

Shared setup in each test: collect `pageerror` messages, and count requests whose URL contains the
test's playlist file name with `page.on('request', …)`.

**Test 1 — live audio HLS** (`E2E_LIVE_AV_HLS_AUDIO_ITEM_ID_TEXT`):

1. Open and play.
2. The live-stream audio container holds exactly one `<audio>`, and it is the only sourced media
   element. Do not assert the `src` value: `hls.js` sets a `blob:` URL.
3. The playhead moves: poll `currentTime` on `liveStreamMediaElement(page, 'audio')` until `> 0`,
   with a 20 s timeout.
4. The playlist is reloaded: poll the request counter for `e2e-hls-event.m3u8` until `>= 2`, with a
   20 s timeout. A playlist without `#EXT-X-ENDLIST` is live, and `hls.js` refetches it about every
   target duration (2 s). This is the assertion that separates live HLS from VOD HLS.
5. `pageErrors` is empty.

**Test 2 — live video HLS** (`E2E_LIVE_AV_HLS_VIDEO_ITEM_ID_TEXT`), desktop viewport
`{ width: 1200, height: 900 }`:

1. Open and play.
2. The live-stream video container holds exactly one `<video>`, and it is the only sourced media
   element.
3. The playhead moves (same poll on the `<video>`), and `videoWidth > 0`, so frames decoded.
4. The playlist `e2e-hls-video-event.m3u8` is requested at least twice.
5. The floating portal `floating-video-portal-livestream` is visible and contains a visible
   `<video>`. Capture it with `captureVerifiedElement` and a one-sentence description.
6. `pageErrors` is empty.

Do not assert `duration === Infinity`; `hls.js` leaves a finite duration on live streams unless
`liveDurationInfinity` is set, and this set does not change player config.

## 4. Decision matrix

In `MEDIA-PLAYER-DECISION-MATRIX.md` § 6b, add the new spec to the list with one line. In § 6c,
add two table rows (live audio HLS, live video HLS) with the item ids, the fixture file, and the
spec. Rewrite the "What a progressive file does and does not cover" paragraph: playlist reload and
playback from a live HLS playlist are now asserted in Chromium through `hls.js`; Safari native
HLS, real live-edge advance, `duration === Infinity`, and cross-source fallback are still not.
Drop its sentence about Phase 4 owning the infrastructure decision.

## Tests

- New: `apps/web/e2e/media-player-livestream-hls-start.spec.ts` (two tests).
- Unchanged and still expected to pass: the four existing `media-player-livestream-*.spec.ts`
  specs and `media-player-hls-vod-start.spec.ts`.

## Release scratchpad

none (test fixtures and specs only)
