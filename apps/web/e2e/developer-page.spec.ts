import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

test.describe('Developer page', () => {
  test('When a signed-out visitor opens Developer from the footer, the page explains API keys and links to the API reference.', async ({
    page,
  }, testInfo) => {
    await page.goto('/');

    await page.getByRole('contentinfo').getByRole('link', { name: 'Developer' }).click();
    await expect(page).toHaveURL(/\/developer\/?$/);

    const apiKeySentence = page.getByText('Creating a key requires a membership.');
    await expect(apiKeySentence).toBeVisible();

    const apiReference = page.getByRole('link', { name: 'API Reference' });
    await expect(apiReference).toBeVisible();
    await expect(apiReference).toHaveAttribute('href', /\/docs$/);
    await expect(
      page.getByText('Opens the interactive API reference served by this server.')
    ).toBeVisible();

    await capturePageLoad(
      page,
      testInfo,
      'The Developer page explains API keys and links to the API reference.',
      apiReference
    );
  });
});
