# 05 — Slide-up image viewer

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

`ImageViewerModal` fades in through `AppOverlay`. The full player, Make Clip, and V4V already slide up as root cards via `ROOT_SLIDE_UP_SCREEN_OPTIONS` in `apps/mobile/src/navigation/slideUpScreen.ts`: `slide_from_bottom`, a vertical gesture that starts at the top edge, and `fullScreenGestureEnabled: false`.

Move the viewer onto that same root stack.

- Add a root screen. Do not use `presentation: 'modal'` (that is the page sheet).
- `CoverImage` opens it with a helper on `rootNavigationRef`, the same pattern as `navigateToMakeClipScreen`, passing the viewer URI and the accessibility label.
- The top-left control stays `image-viewer-back` and calls `goBack`. The native top-edge swipe dismisses the same way.
- Keep the More menu and the existing test ids: `image-viewer`, `image-viewer-back`, `image-viewer-more`, and the menu actions.
- Do not add a public deep link.
- Protected Add by RSS artwork: `CoverImage` takes `headers` from `useAddByRssArtworkHeaders`, which holds the feed's `Authorization`. Today the modal viewer drops those headers. Never put the header value in route params, because route params are navigation state. Pass the feed URL instead (a new optional `addByRssFeedUrl` on `CoverImage`, set wherever a caller passes `headers`). The viewer screen resolves the headers itself with `useAddByRssArtworkHeaders(feedUrl, uri)`. If `shareRemoteFile` cannot send those headers, hide Download image for protected art instead of offering a download that fails.
- Do not edit `apps/mobile/e2e/player-screen.yaml`. That file is prompt 01's. The test ids above stay so its image-viewer steps still find the screen.
- `search-unparsed.yaml` may need a targeted edit if the slide-up changes what that flow taps. Do not rewrite the file.
- Do not edit `HeaderBarAction.tsx`. Do not edit `.cursor/` files.

## Operator check

Do not run these during implementation.

```bash
npm run mobile:e2e:test -- search-unparsed
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

Mobile E2E Metro and a Mobile E2E device must already be up.
