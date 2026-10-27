import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { E2E_TASTE_PROFILE_EMAIL, E2E_TASTE_PROFILE_PASSWORD } from './helpers/legalConsent';
import { capturePageLoad } from './helpers/stepScreenshots';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';

async function loginViaApi(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: E2E_TASTE_PROFILE_EMAIL, password: E2E_TASTE_PROFILE_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

test.describe('Recommendations page', () => {
  test('The sidebar lists Recommendations after Browse, and a signed-out visit asks for login.', async ({
    page,
  }, testInfo) => {
    await page.goto('/browse');
    const nav = page.getByRole('navigation');
    const links = nav.getByRole('link');
    const names = await links.allInnerTexts();
    const browseIndex = names.findIndex((name) => name.trim() === 'Browse');
    const recommendationsIndex = names.findIndex((name) => name.trim() === 'Recommendations');
    expect(browseIndex).toBeGreaterThanOrEqual(0);
    expect(recommendationsIndex).toBe(browseIndex + 1);

    await page.goto('/recommendations');
    const chrome = page.locator('[data-appearance="web"]');
    await expect(chrome.getByRole('heading', { level: 1, name: 'Recommendations' })).toBeVisible();
    const layoutButton = page.getByTestId('view-selector-button');
    await expect(layoutButton).toBeVisible();
    await expect(page.getByTestId('media-list-sort-button')).toHaveCount(0);
    await layoutButton.click();
    await expect(page.getByRole('menuitemradio', { name: 'List View' })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'Grid View' })).toBeVisible();
    await page.keyboard.press('Escape');
    const loginPrompt = page.getByText('Log in to use this feature.');
    await expect(loginPrompt).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'A signed-out Recommendations visit asks the listener to log in.',
      loginPrompt
    );
  });

  test('A signed-in listener with Taste Profile on and no computed rows is asked to check back.', async ({
    page,
  }, testInfo) => {
    await loginViaApi(page);
    await page.goto('/recommendations');
    const checkBack = page.getByText(
      'Recommendations appear after you listen, on the next nightly update.'
    );
    await expect(checkBack).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'Recommendations with nothing computed yet asks the listener to check back.',
      checkBack
    );
  });
});
