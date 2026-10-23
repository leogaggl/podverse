import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  clearSeededPodcastQueueResources,
  expectSingleSourcedMediaElement,
  liveStreamMediaContainer,
  liveStreamMediaElement,
  openEpisodeAndPlay,
  openLivestreamAndPlay,
} from './helpers/mediaPlayerAssertions';
import {
  E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT,
  E2E_LIVE_AV_AUDIO_ITEM_TITLE,
  E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT,
  E2E_PODCAST_RESUME_ENCLOSURE_URL,
  E2E_PODCAST_SHORT_ENCLOSURE_URL,
} from './helpers/seedConstants';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const PODCAST_ITEM_TITLE = 'E2E Podcast No Stored Position';

async function loginSeedUser(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

/**
 * Matrix cell (see `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` § 6a
 * "Live → non-live transition"): playing a regular podcast item while live is playing must unmount
 * the live-stream media element, empty its container, and leave the non-live `<audio>` as the only
 * sourced media element. The second case covers returning to live after that unmount: the
 * live-stream controller has to mount a fresh element.
 */
test.describe('Media player live-stream to podcast transition', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(45_000);
    await loginSeedUser(page);
    await clearSeededPodcastQueueResources(page);
  });

  test('Transitioning from a live audio stream to a regular podcast item leaves a single clean audio element and no stuck UI', async ({
    page,
  }) => {
    await openLivestreamAndPlay(page, E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT, E2E_LIVE_AV_AUDIO_ITEM_TITLE);

    await test.step('The live stream mounts an `<audio>` in the live-stream audio container', async () => {
      await expect(liveStreamMediaElement(page, 'audio')).toHaveCount(1);
      await expectSingleSourcedMediaElement(page);
    });

    await openEpisodeAndPlay(page, E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT, PODCAST_ITEM_TITLE);

    await test.step('Playing a podcast item unmounts the live-stream element and empties its container', async () => {
      await expect(liveStreamMediaContainer(page, 'audio').locator('audio')).toHaveCount(0);
    });

    await test.step('The non-live `<audio>` is the only sourced media element, so there is no double audio', async () => {
      await expect(page.locator('audio[src]')).toHaveAttribute(
        'src',
        E2E_PODCAST_RESUME_ENCLOSURE_URL
      );
      await expectSingleSourcedMediaElement(page);
    });

    await test.step('The player still responds to its own pause control, so the transition left no stuck UI', async () => {
      const pauseButton = page.locator('aside#media-player').getByRole('button', { name: 'Pause' });
      await expect(pauseButton.first()).toBeVisible();
      await pauseButton.first().click();
      await expect(
        page.locator('aside#media-player').getByRole('button', { name: 'Play' }).first()
      ).toBeVisible();
    });
  });

  test('Re-playing a live audio stream after a podcast item mounts a fresh live-stream element without errors', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openLivestreamAndPlay(page, E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT, E2E_LIVE_AV_AUDIO_ITEM_TITLE);
    await expect(liveStreamMediaElement(page, 'audio')).toHaveCount(1);

    await openEpisodeAndPlay(page, E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT, PODCAST_ITEM_TITLE);
    await expect(liveStreamMediaContainer(page, 'audio').locator('audio')).toHaveCount(0);

    await test.step('Returning to the live stream mounts a new live-stream media element', async () => {
      await openLivestreamAndPlay(
        page,
        E2E_LIVE_AV_AUDIO_ITEM_ID_TEXT,
        E2E_LIVE_AV_AUDIO_ITEM_TITLE
      );

      const liveAudio = liveStreamMediaElement(page, 'audio');
      await expect(liveAudio).toHaveCount(1);
      await expect(liveAudio).toHaveAttribute('src', E2E_PODCAST_SHORT_ENCLOSURE_URL);
      await expectSingleSourcedMediaElement(page);
    });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
