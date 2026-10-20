# 07 — Web playback errors, matching mobile

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

When web cannot play something, the user sees nothing. Give the media player an error state that
keeps the failed item loaded, swaps the play button for an error icon, and opens a modal that
explains why, the same way mobile's `ActionErrorProvider` dialog does. Applies to all web
playback, not only Add by RSS. Depends on 06. Do not change mobile UI.

## Mobile reference

- `apps/mobile/src/feedback/ActionErrorProvider.tsx`: title, body, a `Details: {detail}` line
  (`action_error.report`), **Try Again** (`misc.try_again`), **Cancel** (`misc.cancel`).
- `apps/mobile/src/feedback/actionErrorCopy.ts`: `playbackErrorMessageKeys(kind)`,
  `playbackCredentialsMessageKeys`, `actionErrorDetailLine`.
- Copy lives in `packages/i18n-catalog/mobile/originals/*.json` under `action_error`.

## Catalog

1. Move from the **mobile** layer to the **consumer** layer, in all four locales (en-US, es, fr,
   el-GR): `action_error.playback_title`, `playback_a11y`, `report`, and every
   `action_error.playback_*` body key. `download_*` and `download_title` / `download_a11y` stay
   in mobile. Values move unchanged. A leaf key path must exist in one layer only; check that the
   validator accepts one namespace split across two layers, and if it does not, ask before
   renaming anything.
2. Add to consumer, all four locales:
   - `action_error.playback_host_blocked`: "This media's host does not allow playback on
     websites. It may still play in the Podverse app." (sentence case; translate for es, fr,
     el-GR).
   - `action_error.open_media_link`: "Open Media Link" (title case in English only).
3. Remove web keys that become unused after the toast goes away (below). Search before removing.
4. Never edit `overrides/`. Run nothing; the operator compiles and validates.

Mobile keeps reading the moved keys through its merged catalog (`shared → consumer → mobile`).
No mobile code change is needed for the move.

Move `actionErrorDetailLine` into `@podverse/helpers` (it is a pure function) and import it on
both surfaces. That is the only mobile code change allowed here.

## Error state

`apps/web/src/contexts/MediaPlayer.tsx`: add

```ts
type MPPlaybackError = {
  kind: WebPlaybackErrorKind;
  identity: string;          // the loaded item's identity when it failed
  mediaUrl: string | null;
  code: string;
  httpStatus?: number;
  message: string;
};
```

with `mpPlaybackError` and `setMPPlaybackError`. Clear it when a different item loads, when Try
Again starts, and on the media element's `playing` event.

`WebPlaybackErrorKind` and its key map live in one web module (for example
`apps/web/src/utils/media/playbackErrorCopy.ts`), exhaustive like mobile's:
`network`, `decode`, `unsupported`, `file-not-found`, `host-http`, `host-blocked`,
`invalid-source`, `unknown`, plus the four credentials states.

## Where errors come from

- **Media element `error`.** `NonLiveMediaOrchestrator.tsx` (around lines 312-325) returns early
  unless the item is Add by RSS. Remove that restriction. Skip `MEDIA_ERR_ABORTED` (1). Map
  `MEDIA_ERR_NETWORK` (2) to `network`, `MEDIA_ERR_DECODE` (3) to `decode`.
  `MEDIA_ERR_SRC_NOT_SUPPORTED` (4) covers a blocked host, a missing file, and a real format
  problem, and the browser does not say which. Map it to `host-blocked` here; 08 refines it.
- **Credentials.** For Add by RSS items, run the existing
  `classifyAddByRSSProtectedMediaFailure` first. A credentials result wins over the media error
  kind. Keep `logAddByRSSProtectedMediaFailure`. `useAddByRSSMediaFailureNotice` stops showing a
  toast and sets the error state instead.
- **`play()` rejections.** `useMediaElementBridge.ts` (around line 179) and
  `mediaPlayerPlayMediaWhenReady.ts` swallow them. `NotAllowedError` (autoplay policy) is not an
  error: leave the normal play button. `AbortError` is ignored. `NotSupportedError` is treated
  like code 4.
- **No usable URL.** An item with no enclosure URL is `invalid-source`.

An error never advances the queue and never loads another item. Check the `ended` and error
handlers for any auto-skip and remove it for the error path.

## UI

- `PlayButton.tsx`, `PlayButtonMobile.tsx`, and `PlayButtonLarge.tsx`: when `mpPlaybackError` is
  set for the loaded identity, render an error icon button instead of play or pause. Accessible
  name `action_error.playback_a11y`. Keep the same size and position so the bar does not shift.
- Pressing it opens a modal built on `@podverse/ui` `Modal` (**modal-layout-contract**):
  - Title `action_error.playback_title`. Body from the kind map.
  - The details line, `action_error.report` with `actionErrorDetailLine({ reason: kind, code,
    httpStatus, message })`. Omit it when the detail is empty.
  - **Try Again** (`misc.try_again`): clear the error, reload the source, seek to the last known
    position, play.
  - **Open Media Link** (`action_error.open_media_link`): only when `mediaUrl` is `http(s)` with
    no userinfo. Opens in a new tab with `rel="noopener noreferrer"`.
  - **Cancel** (`misc.cancel`): close. The error icon stays.
- Announce the error once through a polite live region: title then body. Reuse an existing live
  region helper if web has one.
- The embed player is out of scope.

## Tests

Unit: the kind mapping (every kind has copy), code 4 to `host-blocked`, `NotAllowedError` sets no
error, credentials wins, error clears on a new item and on `playing`, no queue advance.

E2E `apps/web/e2e/media-player-playback-error.spec.ts`. Top-level `describe`: "Playback error
state". Fail a seeded episode's enclosure with `page.route` (a 404, and an abort).

1. Press play. The play button becomes the error button named "Playback Error". The mini player
   still shows that episode's title.
2. Open it. The modal shows the title, a reason, a details line, Try Again, Open Media Link, and
   Cancel. Screenshot.
3. Cancel keeps the error button. Nothing else loaded.
4. Remove the route, press Try Again. Audio plays and the normal button returns.

Update `apps/web/e2e/add-by-rss-credentials-media-message.spec.ts` from toast to modal.

## Scratchpad entry

```markdown
## Web explains playback failures

- Surfaces: web, i18n catalog (playback error copy now shared by web and mobile)
- Change: When something cannot play, it stays in the player and the play button becomes an
  error icon. Pressing it explains why, with a details line, Try Again, Open Media Link, and
  Cancel. The error is announced to screen readers. Playback never skips ahead on its own after
  an error. Password-protected feed failures use this instead of a toast.
- Who notices: anyone whose episode fails to play on web
- Operator steps: none
```

## Done when

- [x] Keys moved to consumer and new keys added in all four locales
- [x] Error state in the media player context, set from every source above
- [x] Error button on all three play buttons and the modal
- [x] No auto-advance; screen reader announcement
- [x] Unit tests, E2E spec, credentials spec updated, scratchpad entry

## Operator verification

**Root**

```bash
npm run i18n:validate
npm run i18n:compile
npm run build:packages
npm run test -w apps/web
make e2e_test_web_report_spec SPEC=e2e/media-player-playback-error.spec.ts,e2e/add-by-rss-credentials-media-message.spec.ts,e2e/media-player-foundation.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

**Mobile**

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
```
