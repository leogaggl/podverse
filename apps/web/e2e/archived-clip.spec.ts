import { expect, test } from '@playwright/test';

import {
  E2E_ARCHIVED_CLIP_EPISODE_TITLE,
  E2E_ARCHIVED_CLIP_ID_TEXT,
  E2E_ARCHIVED_CLIP_LINK_URL,
  E2E_ARCHIVED_CLIP_PREVIEW,
  E2E_ARCHIVED_CLIP_TITLE,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const CLIP_URL = `/clip/${E2E_ARCHIVED_CLIP_ID_TEXT}`;

const EMPTY_SECTION_NAMES = ['Chapters', 'Transcript', 'People', 'Funding'] as const;

test.describe('Archived clip', () => {
  test('the clip page shows the shortened notes and no empty sections', async ({
    page,
  }, testInfo) => {
    await page.goto(CLIP_URL);
    await expect(page).toHaveURL(new RegExp(`/clip/${E2E_ARCHIVED_CLIP_ID_TEXT}$`));

    const main = page.getByRole('main');
    const episodeTitle = main.getByRole('heading', {
      name: E2E_ARCHIVED_CLIP_EPISODE_TITLE,
      level: 2,
    });
    await expect(episodeTitle).toBeVisible();
    await capturePageLoad(page, testInfo, 'Clip page shows the episode title', episodeTitle);

    const clipTitle = main.getByRole('heading', { name: E2E_ARCHIVED_CLIP_TITLE, level: 3 });
    await expect(clipTitle).toBeVisible();
    await capturePageLoad(page, testInfo, 'Clip page shows the clip title', clipTitle);

    const preview = main.getByText(E2E_ARCHIVED_CLIP_PREVIEW);
    await expect(preview).toBeVisible();
    await capturePageLoad(page, testInfo, 'Summary shows the stored preview', preview);

    const fullNotesLink = main.getByRole('link', { name: 'Read Full Show Notes' });
    await expect(fullNotesLink).toBeVisible();
    await expect(fullNotesLink).toHaveAttribute('href', E2E_ARCHIVED_CLIP_LINK_URL);
    await capturePageLoad(
      page,
      testInfo,
      'Read Full Show Notes links to the episode website',
      fullNotesLink
    );

    for (const name of EMPTY_SECTION_NAMES) {
      await expect(main.getByRole('button', { name, exact: true })).toHaveCount(0);
      await expect(main.getByRole('tab', { name, exact: true })).toHaveCount(0);
    }
    await capturePageLoad(page, testInfo, 'Clip page hides empty sections', episodeTitle);
  });
});
