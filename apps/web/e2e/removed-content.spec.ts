import { expect, test } from '@playwright/test';

import { buildClipPath, buildPlaylistPath, buildPodcastPath } from '@podverse/helpers';

import { loginE2eUser } from './helpers/customThemes';
import {
  E2E_ARCHIVED_SHOW_ID_TEXT,
  E2E_ARCHIVED_SHOW_TITLE,
  E2E_REMOVED_CLIP_ID_TEXT,
  E2E_REMOVED_CLIP_TITLE,
  E2E_REMOVED_EPISODE_TITLE,
  E2E_REMOVED_PLAYLIST_ID_TEXT,
  E2E_REMOVED_SHOW_TITLE,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

/** Web E2E sets NEXT_PUBLIC_BRAND_NAME to this value. */
const E2E_BRAND_NAME = 'PodverseE2E';
const CLIP_REMOVED_SENTENCE = `The episode for this clip was removed from ${E2E_BRAND_NAME}.`;
const SHOW_REMOVED_SENTENCE = `This show is no longer in the ${E2E_BRAND_NAME} directory.`;
const CONTENT_REMOVED_LABEL = 'Content Removed';
const ACTIVE_PLAYLIST_EPISODE_TITLE = 'E2E Podcast With Chapters';

test.describe('Removed content', () => {
  test('shows a removed playlist entry as Content Removed and keeps the live entry', async ({
    page,
  }, testInfo) => {
    await loginE2eUser(page);
    await page.goto(buildPlaylistPath(E2E_REMOVED_PLAYLIST_ID_TEXT));

    const removedRow = page.locator('[data-removed-source="true"]');
    await expect(
      removedRow.getByRole('heading', { name: E2E_REMOVED_EPISODE_TITLE, exact: true })
    ).toBeVisible();
    await expect(removedRow.getByText(CONTENT_REMOVED_LABEL, { exact: true })).toBeVisible();
    await expect(removedRow.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: ACTIVE_PLAYLIST_EPISODE_TITLE, exact: true })
    ).toBeVisible();
    await capturePageLoad(page, testInfo, 'Removed playlist entry', removedRow);
  });

  test('shows the owner the removed clip title, snapshot titles, and no player', async ({
    page,
  }, testInfo) => {
    await loginE2eUser(page);
    await page.goto(buildClipPath(E2E_REMOVED_CLIP_ID_TEXT));

    await expect(
      page.getByRole('heading', { name: E2E_REMOVED_CLIP_TITLE, exact: true })
    ).toBeVisible();
    await expect(page.getByText(E2E_REMOVED_EPISODE_TITLE, { exact: true })).toBeVisible();
    await expect(page.getByText(E2E_REMOVED_SHOW_TITLE, { exact: true })).toBeVisible();
    const sentence = page.getByText(CLIP_REMOVED_SENTENCE, { exact: true });
    await expect(sentence).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete Clip' })).toBeVisible();
    await capturePageLoad(page, testInfo, 'Owner removed clip', sentence);
  });

  test('shows a signed-out visitor only the removed clip sentence', async ({ page }, testInfo) => {
    await page.goto(buildClipPath(E2E_REMOVED_CLIP_ID_TEXT));

    const sentence = page.getByText(CLIP_REMOVED_SENTENCE, { exact: true });
    await expect(sentence).toBeVisible();
    await expect(page.getByText(E2E_REMOVED_CLIP_TITLE, { exact: true })).toHaveCount(0);
    await expect(page.getByText(E2E_REMOVED_EPISODE_TITLE, { exact: true })).toHaveCount(0);
    await expect(page.getByText(E2E_REMOVED_SHOW_TITLE, { exact: true })).toHaveCount(0);
    await capturePageLoad(page, testInfo, 'Visitor removed clip', sentence);
  });

  test('replaces an archived show episode list and hides Subscribe', async ({ page }, testInfo) => {
    await loginE2eUser(page);
    await page.goto(buildPodcastPath(E2E_ARCHIVED_SHOW_ID_TEXT));

    await expect(
      page.getByRole('heading', { name: E2E_ARCHIVED_SHOW_TITLE, exact: true })
    ).toBeVisible();
    const sentence = page.getByText(SHOW_REMOVED_SENTENCE, { exact: true });
    await expect(sentence).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toHaveCount(0);
    await capturePageLoad(page, testInfo, 'Archived show notice', sentence);
  });
});
