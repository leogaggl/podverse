import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

test.describe('Add by RSS signed out', () => {
  test('When a signed-out visitor opens Add by RSS, the page asks them to log in and does not show the empty-library banner.', async ({
    page,
  }, testInfo) => {
    await page.goto('/add-by-rss');
    await expect(page).toHaveURL(/\/add-by-rss\/?$/);
    const heading = page
      .locator('[data-appearance="web"]')
      .getByRole('heading', { level: 1, name: 'Add by RSS' });
    await expect(heading).toBeVisible();
    const loginPrompt = page.getByText('Log in to use this feature.');
    await expect(loginPrompt).toBeVisible();
    await expect(page.getByText('No personal RSS feeds added yet.')).toHaveCount(0);
    await expect(page.getByText('No RSS Podcast Feeds Saved Yet.')).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'A signed-out Add by RSS visit asks the listener to log in without an empty-library banner.',
      loginPrompt
    );
  });
});
