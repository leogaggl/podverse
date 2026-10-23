# Livestream HLS end-to-end coverage — summary

Prompts, models, and order: [COPY-PASTA.md](./COPY-PASTA.md).

## Why

Web livestreams play through the shared `MediaElement` in
`apps/web/src/components/MediaPlayer/Controller/MediaPlayerControllerLiveStreamAV.tsx`: a
progressive file sets `src`, and an HLS playlist plays natively or through the lazily loaded
`hls.js` helper in `apps/web/src/hooks/mediaElementBridgeSurface.ts`. video.js is gone.

The livestream E2E specs seed progressive mp3/mp4 sources only. Nothing asserts that a live HLS
playlist (no `#EXT-X-ENDLIST`) plays, keeps reloading its playlist, or renders live video in the
floating portal. This set closes that gap and adds a guard against reintroducing video.js.

## Locked decisions

- Use the asset server on `:2111` (`tools/test-assets`). No public stream, no external network.
- Live audio HLS reuses the committed `e2e-hls-event.m3u8`. Live video HLS gets a new committed
  fixture pair generated the same way: `e2e-hls-video-vod.m3u8` and `e2e-hls-video-event.m3u8`.
- The new live items join the existing unsubscribed channel `e2eLiveAvChn01`.
- Chromium is the only Playwright project, so these specs cover the `hls.js` path. Safari native
  HLS stays a manual check.
- Folding livestreams into the non-live bridge and deleting `Controller/LiveStream/` is out of
  scope. It changes nothing a listener notices.

## Plans

| Plan | Change |
| --- | --- |
| [01-video-js-import-guard.md](./01-video-js-import-guard.md) | ESLint blocks `video.js` and `@videojs/*` imports in web and management-web |
| [02-livestream-hls-e2e.md](./02-livestream-hls-e2e.md) | Video HLS fixtures, two seeded live HLS items, one spec with audio and video cases, doc updates |
