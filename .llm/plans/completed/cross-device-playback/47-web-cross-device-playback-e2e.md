**Cursor model:** Codex 5.3 · **Reasoning:** high

# 47 — Playwright: two signed-in browsers share one player

End-to-end coverage for web cross-device playback, run against the real E2E API (stream,
presence, state, and commands from plans 12–14) with **two browser contexts signed in as the seed
user**. Each context logs in separately, so each is its own login session, which is one device.
Two pages in one context are two tabs of one device.

This spec is the end-to-end coverage that plans 22, 23, 24, 25, and 26 point to, and the
Playwright coverage for this area's plans 42–46 and 49.

Before writing, confirm the plans above are implemented: `useCrossDevicePlayback` in
`apps/web/src/contexts/CrossDevicePlayback.tsx`, `PlaybackDevicesButton.tsx`,
`RemoteMediaPlayerProgress.tsx`, `CrossDevicePlaybackNotices.tsx`,
`apps/web/src/lib/crossDevicePlayback/remotePlayerResourceStore.ts`, the segment strip
`apps/web/src/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.tsx` (web-player-marquee
plan 21), and the `POST /account/playback/presence` route in `apps/api/src/routes/`. If any is
missing, stop and report.

## Rows

R4, R6, R8, R12, R16, R37, R39, R41, R44, R46, R58, R62, R64, R72, R74, R79, R81, R82, R89

## Runs after

13, 14, 22, 23, 24, 25, 26, 42, 43, 44, 45, 46, 49, and web-player-marquee plan 21

## Files

apps/web/e2e/media-player-cross-device-remote.spec.ts
apps/web/e2e/helpers/crossDevicePlayback.ts
apps/web/e2e/helpers/mediaPlayerAssertions.ts
apps/web/e2e/media-player-music-playback.spec.ts
makefiles/local/e2e-spec-order-web.txt

## Design

- **Real API, no stream mocks.** Commands, take over, and start-failed reports only mean
  something end to end. The E2E API on `:4030` runs the playback store on the test Valkey.
- **Autoplay.** `test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })`
  at the top of the spec, so a context told to play by a command can start audio without a
  click. A blocked start is simulated per context with an init script (below), so the test does
  not depend on the browser's own autoplay heuristics.
- **Timeouts.** Each test `test.setTimeout(120_000)`, with a one-line comment giving the reason
  (two signed-in contexts plus the presence leave wait), per **test-timeout-budget**. Waits for another context to react use
  `expect(...).toBeVisible({ timeout: 20_000 })` or `expect.poll(..., { timeout: 20_000 })`; the
  "device goes away" wait uses 45 s, which still covers the 40 s presence TTL. A clean close in
  this environment leaves after the 500 ms web E2E grace.
- **Isolation.** Every test opens its own contexts and closes them in a `finally`, then waits
  `WEB_E2E_PLAYBACK_PRESENCE_LEAVE_GRACE_MS + 1_000` ms (`500 + 1_000`, exported from
  `packages/helpers-config/src/podverseTestEnv.ts`, plan 14) so the closed sessions leave
  presence before the next test or spec starts. The web E2E API uses that 500 ms grace. The
  product grace stays 5 s, so other web specs that do not wait still start after presence has
  expired. That wait is the only fixed delay.
- **Readable steps** (**e2e-readability**): every `test.step` title is a full sentence, and each
  test captures screenshots at its key states with `capturePageLoad` or `captureVerifiedElement`
  from `helpers/stepScreenshots.ts`, on the page the step is about.
- Seed content, all from `helpers/seedConstants.ts`: the podcast episode
  `E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT` (heading `'E2E Podcast No Stored Position'`, 60 s); the
  chaptered episode `E2E_PODCAST_ITEM_CHAPTERED_ID_TEXT` (heading `'E2E Podcast With Chapters'`,
  chapters `Intro` from 1 s and `Topic A` from 21 s); the music track
  `E2E_MUSIC_TRACK_ONE_ID_TEXT` (heading `'E2E Music Track One'`); and the live audio item
  `E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT` / `E2E_LIVE_AV_AUDIO_ITEM_TITLE`. Start each test with `clearSeededPodcastQueueResources` on the
  first page after login.

## `helpers/crossDevicePlayback.ts`

```typescript
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

export const CROSS_DEVICE_DESKTOP_VIEWPORT = { width: 1280, height: 900 };
export const CROSS_DEVICE_MOBILE_VIEWPORT = { width: 390, height: 844 };

export type SignedInDevice = { context: BrowserContext; page: Page };

/** New browser context signed in as the seed user (its own login session). */
export async function openSignedInDevice(
  browser: Browser,
  options?: { blockAutoplay?: boolean; viewport?: { width: number; height: number } }
): Promise<SignedInDevice>;

/** Close the contexts, then wait until their sessions have left playback presence. */
export async function closeSignedInDevices(devices: readonly SignedInDevice[]): Promise<void>;

/** Let `play()` succeed again in a context opened with `blockAutoplay`. */
export async function allowAutoplay(page: Page): Promise<void>;

export function playerDevicesButton(page: Page): Locator;
export function playerDeviceCaption(page: Page): Locator;
export function playerRemoteProgress(page: Page): Locator;
export function playerRemoteLiveLabel(page: Page): Locator;
export function playerSegmentStripTitle(page: Page): Locator;
export function playerButton(page: Page, name: string): Locator;

export async function audioState(page: Page): Promise<{ paused: boolean; currentTime: number; playbackRate: number } | null>;
```

- `openSignedInDevice`: `browser.newContext({ viewport: options?.viewport ?? CROSS_DEVICE_DESKTOP_VIEWPORT })`; when
  `blockAutoplay`, `context.addInitScript(...)` (below); `context.newPage()`;
  `loginSeedUser(page)` from `./addByRSSCredentials` (its `page.request` shares the context's
  cookies).
- Block script, written with `Reflect` so it needs no `any` or `as`:

  ```typescript
  await context.addInitScript(() => {
    Reflect.set(window, '__pvE2eBlockPlay', true);
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      if (Reflect.get(window, '__pvE2eBlockPlay') === true) {
        return Promise.reject(new DOMException('Playback needs a user gesture.', 'NotAllowedError'));
      }
      return originalPlay.call(this);
    };
  });
  ```

- `allowAutoplay`: `page.evaluate(() => { Reflect.set(window, '__pvE2eBlockPlay', false); })`.
- `closeSignedInDevices`: `await Promise.all(devices.map((d) => d.context.close()))`, then
  `await new Promise((resolve) => setTimeout(resolve, WEB_E2E_PLAYBACK_PRESENCE_LEAVE_GRACE_MS + 1_000))`.
- Locators are scoped to `aside#media-player` and filtered to the visible layout with
  `.locator('visible=true').first()` (desktop, mobile, and modal layouts are all in the DOM):
  - devices button: `[data-testid="media-player-devices-button"]`
  - caption: `[data-testid="media-player-device-caption"]`
  - remote progress: `[data-testid="media-player-remote-progress"]`
  - Live label: `[data-testid="media-player-remote-live-label"]`
  - segment strip title: `[data-testid^="media-player-segment-strip-title-"]` (the strip's
    `desktop` and `mobile` variants; web-player-marquee plan 21)
  - `playerButton(page, name)`: `getByRole('button', { name, exact: true })`
- For "absent" checks use the unfiltered locator inside `aside#media-player` and filter with
  `.locator('visible=true')`, then `toHaveCount(0)`.
- `audioState`: `page.locator('audio').first()`; null when there is none; otherwise evaluate
  `paused`, `currentTime`, `playbackRate` behind an `instanceof HTMLMediaElement` check, as
  `media-player-podcast-resume.spec.ts` does.

Reuse `openEpisodeAndPlay`, `openLivestreamAndPlay`, `clearSeededPodcastQueueResources`,
`expectPersistentPlayerPlaying`, `expectMediaPlayerTitleVisible`, and `clickDetailPagePlayButton`
from `helpers/mediaPlayerAssertions.ts`. Do not copy them.

**Move `openTrackAndPlay`.** `media-player-music-playback.spec.ts` has a file-local
`openTrackAndPlay(page, itemIdText, trackHeading)`. Move it to `helpers/mediaPlayerAssertions.ts`
as an export next to `openEpisodeAndPlay`, with the same body except the click, which becomes
`clickDetailPagePlayButton(page)` (the detail header's Play inside `main`, as the episode helper
uses). Import it in the music spec and in this spec.

The full-screen player: open it with
`page.locator('#media-player').getByRole('button').first().click()` and find it with
`page.getByRole('dialog', { name: 'Fullscreen Media Player' })`, as
`media-player-alt-enclosure-load.spec.ts` does. If a third spec needs that pair, move it to
`helpers/mediaPlayerAssertions.ts` then; this plan copies neither.

## Spec cases in `media-player-cross-device-remote.spec.ts`

One `test.describe('Media player across two signed-in browsers', ...)`. Device A is the first
context, B the second.

1. **A browser that is not playing shows the playing browser's item and its controls drive that
   browser** (R4, R6, R37, R58, R79, R89, and plan 25).
   - A signs in, clears the seeded queue, and plays the episode with `openEpisodeAndPlay`;
     `expectPersistentPlayerPlaying(A, true)`. A's player shows a `Share` button. With one
     device, A shows no devices button.
   - B signs in and opens `/`. B shows the episode title, a caption containing `Playing on`,
     and the remote progress bar. Both A and B now show the devices button.
   - B's remote progress `aria-valuenow` increases (poll until greater than the first read).
   - B shows `Skip to Previous` and `Skip to Next` and no `Mute` button.
   - B clicks `Pause` → A's audio is paused and `expectPersistentPlayerPlaying(A, false)`; B's
     play button reads `Play` and its caption contains `Paused on`.
   - B clicks `Play` → A's audio plays and B's caption contains `Playing on` again.
   - B clicks `Jump Forward 30 Seconds` → A's `currentTime` reaches at least the value read
     before the click plus 25.
   - B clicks its remote progress bar at 25% of its width (`click({ position })`) → A's
     `currentTime` lands within 12–20 s.
   - B opens `Player Settings` and chooses the speed item (its label starts with
     `Playback Speed:`) → A's `playbackRate` becomes greater than 1.
2. **Choosing another device moves playback there, and This Device brings it back** (R8, R12,
   R39, plan 24).
   - A plays the episode; B opens `/` and shows the caption.
   - A opens its devices button: two `menuitemradio` items; the first contains `This Device`
     and `Playing` and has `aria-checked="true"`; the second has `aria-checked="false"`.
   - A chooses the second item → B's audio plays (`expectPersistentPlayerPlaying(B, true)`), A
     shows a caption containing `Playing on`, and A's audio is paused or absent.
   - B's menu now has its first item (`This Device`) checked.
   - A opens its menu and chooses its first item (`This Device`) → A plays again and B shows
     the caption.
3. **Another tab of the same browser shows playback in the other tab and can take it** (R62).
   - Context A with two pages: A1 plays the episode; A2 opens `/`.
   - A2 shows a caption `Playing in Another Tab` and no devices button (one device).
   - A2 clicks `Pause` → A1's audio pauses; A2 clicks `Play` → A1 plays.
   - B signs in and opens `/` (now two devices). A2 opens its menu: the first item contains
     `This Device` and `Playing in Another Tab`. A2 chooses it → A2's audio plays and A1's
     audio is paused or absent.
4. **A browser that blocks audio shows Ready to Play Here, and the sender says it could not
   start** (R41, R44, plans 23 and 24).
   - A plays the episode; B opens with `blockAutoplay: true` and loads `/`.
   - A chooses B in its menu → B shows a dialog named `Ready to Play Here`; A shows a toast
     containing `needs a tap first`.
   - `allowAutoplay(B)`, then B clicks `Play Here` → B's audio plays and A shows the caption.
5. **A livestream shows the Live label and only play and pause on the other browser** (R16,
   R46).
   - A plays the live audio item with `openLivestreamAndPlay`; `expectPersistentPlayerPlaying(A, true)`.
   - B opens `/`: the Live label is visible; no remote progress bar and no `Jump Forward 30
     Seconds`, `Jump Back 10 Seconds`, or `Player Settings` button is visible.
   - B clicks `Pause` → `expectPersistentPlayerPlaying(A, false)`.
6. **The episode page on the other browser shows the episode as playing and pauses it** (R64).
   - A plays the episode; B opens `/episode/<id>` and waits for the heading.
   - B's play button inside `main` reads `Pause`. B clicks it → A's audio pauses and B's button
     reads `Play`.
7. **When the playing browser closes, the other one returns to the queue item, paused** (R58,
   plan 26).
   - A plays the episode; B opens `/` and shows the caption.
   - Close A's context and drop A from the list the `finally` passes to `closeSignedInDevices`.
   - Within 45 s: B shows no caption and no devices button, still shows the episode title, and
     `expectPersistentPlayerPlaying(B, false)`.
8. **The other browser names the playing browser's chapter, and Skip to Next moves it to the next
   chapter** (R79, R82).
   - A plays the chaptered episode with `openEpisodeAndPlay`; B opens `/`.
   - B's segment strip title reads `Intro` (poll; A crosses 1 s first).
   - B clicks `Skip to Next` → A's `currentTime` reaches at least 21, and B's segment strip
     title reads `Topic A`.
   - B opens `/episode/<chaptered id>`, waits for the heading, and opens the `Chapters` tab
     (`page.getByText('Chapters', { exact: true })`, as `media-player-chapter-seek.spec.ts`
     does). The `Topic A` heading has the class `highlighted-text`; the `Intro` heading does not.
     The play button in the `Topic A` row (anchor from the heading to its row, as the chapter
     seek spec does) reads `Pause`.
   - B clicks that button → A's audio is paused, and the button reads `Play`.
9. **Add to Playlist, Share, and the title link work while the other browser plays** (R72, R74).
   - A plays the episode; B opens `/`.
   - B clicks the player's `Add to Playlist` → a dialog named `Add to Playlist` is visible.
     Close it with `Escape`.
   - B clicks the player's `Share` → a dialog named `Share` is visible. Close it with `Escape`.
   - B opens the full-screen player (dialog `Fullscreen Media Player`). Its link named after
     the episode title has `href` `/episode/<id>`; B clicks it → B's URL ends with
     `/episode/<id>` and the episode heading is visible. A keeps playing.
10. **The narrow remote player shows jump buttons for a podcast and track buttons for music**
    (R81, R79).
    - A plays the episode; B opens with `viewport: CROSS_DEVICE_MOBILE_VIEWPORT` and loads `/`.
    - B shows `Jump Back <n> Seconds` and `Jump Forward <n> Seconds` and no `Skip to Next` or
      `Skip to Previous`.
    - A plays the music track with `openTrackAndPlay`; B shows the track title, `Skip to
      Previous`, and `Skip to Next`, and no jump buttons.
    - B clicks `Skip to Next` → A shows `E2E Music Track Two` (`expectMediaPlayerTitleVisible`).

Build the jump-back label with `MEDIA_JUMP_BACK_SECONDS` from `@podverse/helpers` and the
catalog text `Jump Back {seconds} Seconds`; build the forward label the same way with
`MEDIA_JUMP_FORWARD_SECONDS`.

## Spec order

In `makefiles/local/e2e-spec-order-web.txt`, add
`apps/web/e2e/media-player-cross-device-remote.spec.ts` on the line after
`apps/web/e2e/media-player-seek-after-video.spec.ts` (with the other media player specs, per
**e2e-report-order**).

## Must stay true

- No `npx playwright` or `npm run test:e2e` instructions; the operator runs the make target.
- No `any`, no `as` (the existing `as Array<…>` in `mediaPlayerAssertions.ts` is not copied).
- Every opened context is closed in a `finally`, followed by the presence wait.

## Tests

This plan is the test: `apps/web/e2e/media-player-cross-device-remote.spec.ts` (Playwright,
ten tests) with the helper above. `media-player-music-playback.spec.ts` only changes its import
of `openTrackAndPlay` and must keep passing.

## Release scratchpad

none (tests only)
