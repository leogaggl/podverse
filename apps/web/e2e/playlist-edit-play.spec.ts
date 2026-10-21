import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { expectMediaPlayerTitleVisible } from './helpers/mediaPlayerAssertions';
import { E2E_REMOVED_EPISODE_TITLE, E2E_REMOVED_PLAYLIST_ID_TEXT } from './helpers/seedConstants';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const CHAPTERED_EPISODE_TITLE = 'E2E Podcast With Chapters';

async function loginSeedUser(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

test.describe('Playlist edit playback', () => {
  test('When a signed-in user presses Play on a playlist edit row, that episode starts in the player.', async ({
    page,
  }, testInfo) => {
    await test.step('Log in as the seeded E2E user.', async () => {
      await loginSeedUser(page);
    });

    const editHeading = page.getByRole('heading', { name: 'Edit Playlist', exact: true });

    await test.step('Open the seeded playlist in edit mode.', async () => {
      await page.goto(`/playlist/edit/${E2E_REMOVED_PLAYLIST_ID_TEXT}`);
      await expect(page).toHaveURL(new RegExp(`/playlist/edit/${E2E_REMOVED_PLAYLIST_ID_TEXT}$`));
      await expect(editHeading).toBeVisible();
      await capturePageLoad(
        page,
        testInfo,
        'The playlist edit page is open on the Info tab.',
        editHeading
      );
    });

    const episodeTitle = page.getByRole('heading', { name: CHAPTERED_EPISODE_TITLE, exact: true });
    const removedTitle = page.getByRole('heading', {
      name: E2E_REMOVED_EPISODE_TITLE,
      exact: true,
    });
    const reorderGrips = page.locator('main').getByRole('button', { name: 'Reorder', exact: true });
    const playButton = page.locator('main').getByRole('button', { name: 'Play', exact: true });

    await test.step('Open Items and confirm each row keeps its own reorder grip.', async () => {
      await page.getByRole('button', { name: 'Items', exact: true }).click();
      await expect(episodeTitle).toBeVisible();
      await expect(removedTitle).toBeVisible();
      await expect(reorderGrips).toHaveCount(2);
      await capturePageLoad(
        page,
        testInfo,
        'Both playlist rows show a Reorder grip, and the episode still has Play.',
        playButton.first()
      );
    });

    await test.step('Press Play on the episode row.', async () => {
      await actionAndCapture(
        page,
        testInfo,
        'The player shows the episode from the playlist edit row.',
        async () => {
          await playButton.first().click();
          await expectMediaPlayerTitleVisible(page, CHAPTERED_EPISODE_TITLE);
        },
        page.locator('aside#media-player').getByText(CHAPTERED_EPISODE_TITLE).first()
      );
    });
  });
});
