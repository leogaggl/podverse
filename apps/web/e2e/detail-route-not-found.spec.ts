import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const MISSING_PODCAST_ID_TEXT = 'e2eMissPod01';
const MISSING_EPISODE_ID_TEXT = 'e2eMissEp001';
const NOT_FOUND_TEXT = 'This page could not be found.';
const ERROR_BOUNDARY_TITLE = 'Something Went Wrong';

test.describe('Detail route not found', () => {
  test('When a visitor opens a podcast id that does not exist, they see the not-found page with a 404 status.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/podcast/${MISSING_PODCAST_ID_TEXT}`);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/podcast/${MISSING_PODCAST_ID_TEXT}$`));
    const notFoundText = page.getByText(NOT_FOUND_TEXT, { exact: true });
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The missing podcast shows the not-found page.',
      notFoundText
    );
  });

  test('When a visitor opens an episode id that does not exist, they see the not-found page with a 404 status.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/episode/${MISSING_EPISODE_ID_TEXT}`);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/episode/${MISSING_EPISODE_ID_TEXT}$`));
    const notFoundText = page.getByText(NOT_FOUND_TEXT, { exact: true });
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The missing episode shows the not-found page.',
      notFoundText
    );
  });
});
