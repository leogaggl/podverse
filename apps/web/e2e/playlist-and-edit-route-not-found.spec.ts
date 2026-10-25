import { expect, test } from '@playwright/test';

import { buildPlaylistPath } from '@podverse/helpers';

import { E2E_REMOVED_CLIP_ID_TEXT, E2E_REMOVED_CLIP_TITLE } from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const MISSING_PLAYLIST_ID_TEXT = 'e2eMissPl001';
const MISSING_CLIP_ID_TEXT = 'e2eMissClp01';
const NOT_FOUND_TEXT = 'This page could not be found.';
const ERROR_BOUNDARY_TITLE = 'Something Went Wrong';
/** Web E2E sets NEXT_PUBLIC_BRAND_NAME to this value. */
const E2E_BRAND_NAME = 'PodverseE2E';
const CLIP_REMOVED_SENTENCE = `The episode for this clip was removed from ${E2E_BRAND_NAME}.`;

test.describe('Playlist and edit routes not found', () => {
  test('When a visitor opens a playlist id that does not exist, they see the not-found page with a 404 status.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(buildPlaylistPath(MISSING_PLAYLIST_ID_TEXT));
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/playlist/${MISSING_PLAYLIST_ID_TEXT}$`));
    const notFoundText = page.getByText(NOT_FOUND_TEXT, { exact: true });
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The missing playlist shows the not-found page.',
      notFoundText
    );
  });

  test('When a visitor opens the edit page for a playlist id that does not exist, they see the not-found page with a 404 status.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/playlist/edit/${MISSING_PLAYLIST_ID_TEXT}`);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/playlist/edit/${MISSING_PLAYLIST_ID_TEXT}$`));
    const notFoundText = page.getByText(NOT_FOUND_TEXT, { exact: true });
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The missing playlist edit page shows the not-found page.',
      notFoundText
    );
  });

  test('When a visitor opens the edit page for a clip id that does not exist, they see the not-found page with a 404 status.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/clip/edit/${MISSING_CLIP_ID_TEXT}`);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/clip/edit/${MISSING_CLIP_ID_TEXT}$`));
    const notFoundText = page.getByText(NOT_FOUND_TEXT, { exact: true });
    await expect(notFoundText).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The missing clip edit page shows the not-found page.',
      notFoundText
    );
  });

  test('When a signed-out visitor opens the edit page for a clip whose episode was removed, they see the removed clip sentence instead of an error.', async ({
    page,
  }, testInfo) => {
    await page.goto(`/clip/edit/${E2E_REMOVED_CLIP_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/clip/edit/${E2E_REMOVED_CLIP_ID_TEXT}$`));
    const sentence = page.getByText(CLIP_REMOVED_SENTENCE, { exact: true });
    await expect(sentence).toBeVisible();
    await expect(page.getByText(E2E_REMOVED_CLIP_TITLE, { exact: true })).toHaveCount(0);
    await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toHaveCount(0);
    await expect(page.getByText(NOT_FOUND_TEXT)).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The removed clip edit link shows the removed clip sentence.',
      sentence
    );
  });
});
