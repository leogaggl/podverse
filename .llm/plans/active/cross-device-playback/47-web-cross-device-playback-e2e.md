**Cursor model:** Codex 5.3 · **Reasoning:** high

# 47 — Playwright: two signed-in browsers share one player

End-to-end coverage for web cross-device playback, run against the real E2E API (stream,
presence, state, and commands from plans 12–14) with **two browser contexts signed in as the seed
user**. Each context logs in separately, so each is its own login session, which is one device.
Two pages in one context are two tabs of one device.

This spec is the end-to-end coverage that plans 22, 23, 24, 25, and 26 point to, and the
Playwright coverage for this area's plans 42–46.

Before writing, confirm the plans above are implemented: `useCrossDevicePlayback` in
`apps/web/src/contexts/CrossDevicePlayback.tsx`, `PlaybackDevicesButton.tsx`,
`RemoteMediaPlayerProgress.tsx`, `CrossDevicePlaybackNotices.tsx`, and the
`POST /account/playback/presence` route in `apps/api/src/routes/`. If any is missing, stop and
report.

## Rows

R4, R6, R8, R12, R16, R37, R39, R41, R44, R46, R58, R62, R64

## Runs after

13, 14, 22, 23, 24, 25, 26, 42, 43, 44, 45, 46

## Files

apps/web/e2e/media-player-cross-device-remote.spec.ts
apps/web/e2e/helpers/crossDevicePlayback.ts
makefiles/local/e2e-spec-order-web.txt

## Design

- **Real API, no stream mocks.** Commands, take over, and start-failed reports only mean
  something end to end. The E2E API on `:4030` runs the playback store on the test Valkey.
- **Autoplay.** `test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })`
  at the top of the spec, so a context told to play by a command can start audio without a
  click. A blocked start is simulated per context with an init script (below), so the test does
  not depend on the browser's own autoplay heuristics.
- **Timeouts.** Each test `test.setTimeout(120_000)`. Waits for another context to react use
  `expect(...).toBeVisible({ timeout: 20_000 })` or `expect.poll(..., { timeout: 20_000 })`; the
  "device goes away" wait uses 45 s (presence leave grace plus check-in interval).
- **Isolation.** Every test opens its own contexts and closes them in a `finally`, then waits
  `PLAYBACK_PRESENCE_LEAVE_GRACE_MS + 1_000` ms (from `@podverse/helpers`) so the closed sessions
  leave presence before the next test or spec starts. That wait is the only fixed delay.
- **Readable steps** (**e2e-readability**): every `test.step` title is a full sentence, and each
  test captures screenshots at its key states with `capturePageLoad` or `captureVerifiedElement`
  from `helpers/stepScreenshots.ts`, on the page the step is about.
- Seed content: the podcast episode `E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT` (heading
  `'E2E Podcast No Stored Position'`, 60 s) and the live audio item
  `E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT` / `E2E_LIVE_AV_AUDIO_ITEM_TITLE`, both from
  `helpers/seedConstants.ts`. Start each test with `clearSeededPodcastQueueResources` on the
  first page after login.

## `helpers/crossDevicePlayback.ts`

```typescript
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

export const CROSS_DEVICE_DESKTOP_VIEWPORT = { width: 1280, height: 900 };

export type SignedInDevice = { context: BrowserContext; page: Page };

/** New browser context signed in as the seed user (its own login session). */
export async function openSignedInDevice(
  browser: Browser,
  options?: { blockAutoplay?: boolean }
): Promise<SignedInDevice>;

/** Close the contexts, then wait until their sessions have left playback presence. */
export async function closeSignedInDevices(devices: readonly SignedInDevice[]): Promise<void>;

/** Let `play()` succeed again in a context opened with `blockAutoplay`. */
export async function allowAutoplay(page: Page): Promise<void>;

export function playerDevicesButton(page: Page): Locator;
export function playerDeviceCaption(page: Page): Locator;
export function playerRemoteProgress(page: Page): Locator;
export function playerRemoteLiveLabel(page: Page): Locator;
export function playerButton(page: Page, name: string): Locator;

export async function audioState(page: Page): Promise<{ paused: boolean; currentTime: number; playbackRate: number } | null>;
```

- `openSignedInDevice`: `browser.newContext({ viewport: CROSS_DEVICE_DESKTOP_VIEWPORT })`; when
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
  `await new Promise((resolve) => setTimeout(resolve, PLAYBACK_PRESENCE_LEAVE_GRACE_MS + 1_000))`.
- Locators are scoped to `aside#media-player` and filtered to the visible layout with
  `.locator('visible=true').first()` (desktop, mobile, and modal layouts are all in the DOM):
  - devices button: `[data-testid="media-player-devices-button"]`
  - caption: `[data-testid="media-player-device-caption"]`
  - remote progress: `[data-testid="media-player-remote-progress"]`
  - Live label: `[data-testid="media-player-remote-live-label"]`
  - `playerButton(page, name)`: `getByRole('button', { name, exact: true })`
- For "absent" checks use the unfiltered locator inside `aside#media-player` and filter with
  `.locator('visible=true')`, then `toHaveCount(0)`.
- `audioState`: `page.locator('audio').first()`; null when there is none; otherwise evaluate
  `paused`, `currentTime`, `playbackRate` behind an `instanceof HTMLMediaElement` check, as
  `media-player-podcast-resume.spec.ts` does.

Reuse `openEpisodeAndPlay`, `openLivestreamAndPlay`, `clearSeededPodcastQueueResources`,
`expectPersistentPlayerPlaying`, and `expectMediaPlayerTitleVisible` from
`helpers/mediaPlayerAssertions.ts`. Do not copy them.

## Spec cases in `media-player-cross-device-remote.spec.ts`

One `test.describe('Media player across two signed-in browsers', ...)`. Device A is the first
context, B the second.

1. **A browser that is not playing shows the playing browser's item and its controls drive that
   browser** (R4, R6, R37, R58, and plan 25).
   - A signs in, clears the seeded queue, and plays the episode with `openEpisodeAndPlay`;
     `expectPersistentPlayerPlaying(A, true)`. With one device, A shows no devices button.
   - B signs in and opens `/`. B shows the episode title, a caption containing `Playing on`,
     and the remote progress bar. Both A and B now show the devices button.
   - B's remote progress `aria-valuenow` increases (poll until greater than the first read).
   - B shows no `Skip to Next`, `Skip to Previous`, or `Mute` button.
   - B clicks `Pause` → A's audio is paused and `expectPersistentPlayerPlaying(A, false)`; B's
     play button reads `Play`.
   - B clicks `Play` → A's audio plays.
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
seven tests) with the helper above.

## Release scratchpad

none (tests only)
