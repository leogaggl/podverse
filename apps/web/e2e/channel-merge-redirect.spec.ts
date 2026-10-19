import { expect, test } from '@playwright/test';

import {
  E2E_MERGED_OLD_CHANNEL_ID_TEXT,
  E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT,
  E2E_MERGED_UNMATCHED_ITEM_ID_TEXT,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const OLD_SORT_KEY = `channel:${E2E_MERGED_OLD_CHANNEL_ID_TEXT}`;
const SURVIVOR_SORT_KEY = `channel:${E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT}`;

function decodeCookie(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

test.describe('Merged channel redirects', () => {
  test('An old podcast URL ends on the surviving podcast and keeps the query.', async ({
    page,
  }, testInfo) => {
    const settings = {
      uit: 'dark',
      vs: 'grid',
      seda: false,
      aqc: { rp: false, rd: false },
      sba: { podcasts: true, music: true, addByRSS: true, library: true },
      sp: [[OLD_SORT_KEY, { s: 'top' }]],
    };
    const baseURL =
      typeof testInfo.project.use.baseURL === 'string'
        ? testInfo.project.use.baseURL
        : 'http://localhost:4032';
    await page.context().addCookies([
      {
        name: 'local-settings',
        value: JSON.stringify(settings),
        url: baseURL,
      },
    ]);

    const response = await page.goto(`/podcast/${E2E_MERGED_OLD_CHANNEL_ID_TEXT}?sort=top`);
    await expect(page).toHaveURL(
      new RegExp(`/podcast/${E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT}\\?sort=top$`)
    );
    await expect(page.getByRole('heading', { name: 'E2E Merge Survivor' })).toBeVisible();

    let firstRequest = response?.request() ?? null;
    while (firstRequest?.redirectedFrom()) {
      firstRequest = firstRequest.redirectedFrom();
    }
    const firstResponse = await firstRequest?.response();
    expect(firstResponse?.status()).toBe(308);

    const localSettings = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'local-settings'
    );
    const decoded = decodeCookie(localSettings?.value ?? '');
    expect(decoded).toContain(SURVIVOR_SORT_KEY);
    expect(decoded).not.toContain(OLD_SORT_KEY);

    await capturePageLoad(
      page,
      testInfo,
      'The surviving podcast loads after the old podcast URL redirects.'
    );
  });

  test('An episode with no match on the survivor stays on that episode.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/episode/${E2E_MERGED_UNMATCHED_ITEM_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/episode/${E2E_MERGED_UNMATCHED_ITEM_ID_TEXT}$`));
    await expect(page.getByRole('heading', { name: 'E2E Unmatched Episode' })).toBeVisible();
    expect(response?.request().redirectedFrom()).toBeNull();
    await capturePageLoad(page, testInfo, 'The unmatched episode stays on its own URL.');
  });
});
