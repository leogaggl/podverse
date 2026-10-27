import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

test.describe('My Clips signed out', () => {
  test('When a signed-out listener opens My Clips, the page stays put and asks them to log in.', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const myClips = page.locator('#sidebar a[href="/my-profile?tab=clips"]');
    await expect(myClips).toBeVisible();
    await myClips.click();

    await expect(page).toHaveURL(/\/my-profile\?tab=clips$/);
    const chrome = page.locator('[data-appearance="web"]');
    await expect(chrome.getByRole('heading', { level: 1, name: 'My Clips' })).toBeVisible();
    const loginPrompt = page.getByRole('main').getByText('Log in to use this feature.');
    await expect(loginPrompt).toBeVisible();
    const loginButton = page.getByRole('main').getByRole('button', { name: 'Login' });
    await expect(loginButton).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'A signed-out My Clips visit asks the listener to log in.',
      loginPrompt
    );

    await loginButton.click();
    await expect(page.getByRole('dialog', { name: 'Login' })).toBeVisible();
  });
});
