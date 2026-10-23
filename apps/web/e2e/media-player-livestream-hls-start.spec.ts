import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  expectSingleSourcedMediaElement,
  liveStreamMediaContainer,
  liveStreamMediaElement,
  openLivestreamAndPlay,
} from './helpers/mediaPlayerAssertions';
import {
  E2E_LIVE_AV_HLS_AUDIO_ITEM_ID_TEXT,
  E2E_LIVE_AV_HLS_AUDIO_ITEM_TITLE,
  E2E_LIVE_AV_HLS_VIDEO_ITEM_ID_TEXT,
  E2E_LIVE_AV_HLS_VIDEO_ITEM_TITLE,
} from './helpers/seedConstants';
import { captureVerifiedElement } from './helpers/stepScreenshots';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const DESKTOP_VIEWPORT = { width: 1200, height: 900 };
const LIVE_HLS_AUDIO_PLAYLIST = 'e2e-hls-event.m3u8';
const LIVE_HLS_VIDEO_PLAYLIST = 'e2e-hls-video-event.m3u8';

async function loginSeedUser(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

function watchPageErrorsAndPlaylist(
  page: Page,
  playlistFileName: string
): {
  pageErrors: string[];
  playlistRequestCount: () => number;
} {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let playlistRequestCount = 0;
  page.on('request', (request) => {
    if (request.url().includes(playlistFileName)) {
      playlistRequestCount += 1;
    }
  });

  return {
    pageErrors,
    playlistRequestCount: () => playlistRequestCount,
  };
}

/**
 * Matrix cells (see `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` § 6a
 * "Initial play, audio live stream" and "Initial play, video live stream"): a live item whose
 * enclosure is an HLS playlist mounts one media element. `hls.js` assigns a `blob:` URL, and a
 * playlist without `#EXT-X-ENDLIST` is refetched about every target duration.
 */
test.describe('Media player live-stream HLS start', () => {
  test('Starting a live audio HLS stream plays through one audio element and reloads the playlist', async ({
    page,
  }) => {
    // Playlist reload is polled for up to 20s.
    test.setTimeout(45_000);

    const { pageErrors, playlistRequestCount } = watchPageErrorsAndPlaylist(
      page,
      LIVE_HLS_AUDIO_PLAYLIST
    );
    await loginSeedUser(page);
    await openLivestreamAndPlay(
      page,
      E2E_LIVE_AV_HLS_AUDIO_ITEM_ID_TEXT,
      E2E_LIVE_AV_HLS_AUDIO_ITEM_TITLE
    );

    await test.step('The live-stream audio container holds exactly one audio element, and it is the only sourced media element', async () => {
      const liveAudio = liveStreamMediaElement(page, 'audio');
      await expect(liveAudio).toHaveCount(1);
      await expect(liveStreamMediaContainer(page, 'video').locator('video')).toHaveCount(0);
      await expectSingleSourcedMediaElement(page);
    });

    await test.step('The playhead moves forward on the live audio element', async () => {
      const liveAudio = liveStreamMediaElement(page, 'audio');
      await expect
        .poll(
          async () =>
            liveAudio.evaluate((el) => (el instanceof HTMLAudioElement ? el.currentTime : 0)),
          { timeout: 20_000 }
        )
        .toBeGreaterThan(0);
    });

    await test.step('The live audio HLS playlist is requested at least twice', async () => {
      await expect
        .poll(() => playlistRequestCount(), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(2);
    });

    await test.step('The page reports no uncaught errors', async () => {
      expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    });
  });

  test('Starting a live video HLS stream plays through one video element, reloads the playlist, and shows the floating portal', async ({
    page,
  }, testInfo) => {
    // Playlist reload is polled for up to 20s.
    test.setTimeout(45_000);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const { pageErrors, playlistRequestCount } = watchPageErrorsAndPlaylist(
      page,
      LIVE_HLS_VIDEO_PLAYLIST
    );
    await loginSeedUser(page);
    await openLivestreamAndPlay(
      page,
      E2E_LIVE_AV_HLS_VIDEO_ITEM_ID_TEXT,
      E2E_LIVE_AV_HLS_VIDEO_ITEM_TITLE
    );

    await test.step('The live-stream video container holds exactly one video element, and it is the only sourced media element', async () => {
      const liveVideo = liveStreamMediaElement(page, 'video');
      await expect(liveVideo).toHaveCount(1);
      await expect(liveStreamMediaContainer(page, 'audio').locator('audio')).toHaveCount(0);
      await expectSingleSourcedMediaElement(page);
    });

    await test.step('The playhead moves forward and the video element has decoded a frame', async () => {
      const liveVideo = liveStreamMediaElement(page, 'video');
      await expect
        .poll(
          async () =>
            liveVideo.evaluate((el) => (el instanceof HTMLVideoElement ? el.currentTime : 0)),
          { timeout: 20_000 }
        )
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () =>
            liveVideo.evaluate((el) => (el instanceof HTMLVideoElement ? el.videoWidth : 0)),
          { timeout: 20_000 }
        )
        .toBeGreaterThan(0);
    });

    await test.step('The live video HLS playlist is requested at least twice', async () => {
      await expect
        .poll(() => playlistRequestCount(), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(2);
    });

    await test.step('The floating live-stream video portal is visible and contains a visible video element', async () => {
      const portal = page.getByTestId('floating-video-portal-livestream');
      await expect(portal).toBeVisible();
      await expect(portal.locator('video')).toBeVisible();

      await captureVerifiedElement(
        page,
        testInfo,
        portal,
        'A live video HLS stream renders inside the floating live-stream video portal.'
      );
    });

    await test.step('The page reports no uncaught errors', async () => {
      expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    });
  });
});
