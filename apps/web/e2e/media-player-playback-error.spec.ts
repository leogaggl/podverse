import { expect, test } from '@playwright/test';

import {
  clickDetailPagePlayButton,
  expectMediaPlayerTitleVisible,
  expectPersistentPlayerPlaying,
  waitForAudioReadyAtLeast,
} from './helpers/mediaPlayerAssertions';
import { E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT } from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const EPISODE_TITLE = 'E2E Podcast No Stored Position';
const ENCLOSURE_ROUTE = '**/e2e-podcast-resume-60s-440hz.mp3*';

test.describe('Playback error state', () => {
  test('When a seeded episode returns 404, the player keeps it and explains the failure', async ({
    page,
  }, testInfo) => {
    await page.route(ENCLOSURE_ROUTE, (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto(`/episode/${E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/episode/${E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT}$`));
    await expect(page.getByRole('heading', { name: EPISODE_TITLE })).toBeVisible();

    await test.step('Pressing play turns the play button into a playback error', async () => {
      await clickDetailPagePlayButton(page);
      await expect(page.getByRole('button', { name: 'Playback Error' }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expectMediaPlayerTitleVisible(page, EPISODE_TITLE);
    });

    await test.step('The error explains the failure and offers another try', async () => {
      await page.getByRole('button', { name: 'Playback Error' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Playback Error' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/Details:/)).toBeVisible();
      await expect(dialog.getByText(/MEDIA_ERR_/)).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Try Again' })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Open Media Link' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await capturePageLoad(
        page,
        testInfo,
        'A failed episode stays in the player and the dialog explains why it cannot play.',
        dialog
      );
    });

    await test.step('Cancel leaves the same episode in the error state', async () => {
      await page
        .getByRole('dialog', { name: 'Playback Error' })
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Playback Error' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Playback Error' }).first()).toBeVisible();
      await expectMediaPlayerTitleVisible(page, EPISODE_TITLE);
    });

    await test.step('Try Again plays the episode once the file is available', async () => {
      await page.unroute(ENCLOSURE_ROUTE);
      await page.getByRole('button', { name: 'Playback Error' }).first().click();
      await page
        .getByRole('dialog', { name: 'Playback Error' })
        .getByRole('button', { name: 'Try Again' })
        .click();
      await expectPersistentPlayerPlaying(page, true);
      await waitForAudioReadyAtLeast(page, 2);
      await expect(page.getByRole('button', { name: 'Playback Error' })).toHaveCount(0);
    });
  });

  test('When the enclosure request is aborted, the player keeps the episode and shows an error', async ({
    page,
  }) => {
    await page.route(ENCLOSURE_ROUTE, (route) => route.abort('failed'));

    await page.goto(`/episode/${E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/episode/${E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT}$`));
    await expect(page.getByRole('heading', { name: EPISODE_TITLE })).toBeVisible();

    await clickDetailPagePlayButton(page);
    await expect(page.getByRole('button', { name: 'Playback Error' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectMediaPlayerTitleVisible(page, EPISODE_TITLE);
  });
});
