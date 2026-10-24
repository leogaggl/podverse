import { expect, test } from '@playwright/test';

import { E2E_PODCAST_CHANNEL_ID_TEXT } from './helpers/seedConstants';
import { captureVerifiedElement } from './helpers/stepScreenshots';

const PODCAST_URL = `/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}`;

test.describe('Podcast detail section chips', () => {
  test('When a podcast page opens, Episodes is pressed, About stays off the wide chip row, and Sort reads Recent', async ({
    page,
  }, testInfo) => {
    await test.step('Episodes is pressed and About is not a button at the default width', async () => {
      await page.goto(PODCAST_URL);

      await expect(page).toHaveURL(PODCAST_URL);

      const episodesChip = page.getByTestId('podcast-detail-chips-episodes');
      await expect(episodesChip).toBeVisible();
      await expect(episodesChip).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'About', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sort: Recent', exact: true })).toBeVisible();

      await captureVerifiedElement(
        page,
        testInfo,
        episodesChip,
        'Episodes is pressed, and About is not on the chip row at this width.'
      );
    });

    await test.step('A narrower screen shows About, and it is not pressed', async () => {
      await page.setViewportSize({ width: 800, height: 720 });

      const aboutChip = page.getByRole('button', { name: 'About', exact: true });
      await expect(aboutChip).toBeVisible();
      await expect(aboutChip).toHaveAttribute('aria-pressed', 'false');

      await captureVerifiedElement(
        page,
        testInfo,
        aboutChip,
        'About is a section chip on a narrower screen and it is not pressed.'
      );
    });
  });
});
