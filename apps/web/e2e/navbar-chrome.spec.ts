import { expect, test } from '@playwright/test';

import { actionAndCapture } from './helpers/stepScreenshots';

test.describe('Main layout navbar chrome', () => {
  test('the home page shows account menu and history controls on a wide viewport', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await actionAndCapture(
      page,
      testInfo,
      'The wide home page shows account menu and history controls.',
      async () => {
        await page.goto('/');
        const chrome = page.locator('[data-appearance="web"]');
        await expect(chrome).toBeVisible();
        await expect(chrome.getByRole('button', { name: 'Account' })).toBeVisible();
        await expect(chrome.getByRole('button', { name: 'Back' })).toBeVisible();
        await expect(chrome.getByRole('button', { name: 'Forward' })).toBeVisible();
      },
      page.locator('[data-appearance="web"]')
    );
  });

  test('the sidebar shows Subscribed, Browse, and an expanded Library', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await actionAndCapture(
      page,
      testInfo,
      'The wide home page shows Subscribed, Browse, and an expanded Library.',
      async () => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/$/);
        const sections = page.locator('#sidebar details');
        await expect(sections).toHaveCount(1);
        await expect(sections).toHaveJSProperty('open', true);
        await expect(
          page.locator('#sidebar a[href="/"]').filter({ hasText: 'Subscribed' })
        ).toBeVisible();
        await expect(page.locator('#sidebar a[href="/browse"]')).toBeVisible();
        await expect(page.locator('#sidebar a[href="/add-by-rss"]')).toBeVisible();
        await expect(page.locator('#sidebar a[href="/playlists"]')).toBeVisible();
        await expect(page.locator('#sidebar a[href="/podcasts"]')).toHaveCount(0);
        await expect(page.locator('#sidebar a[href="/profiles"]')).toHaveCount(0);
      },
      page.locator('#sidebar')
    );
  });

  test('a narrow viewport shows search, the mobile menu toggle in its closed state', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await actionAndCapture(
      page,
      testInfo,
      'The narrow home page shows search and the closed mobile menu toggle.',
      async () => {
        await page.goto('/');
        const chrome = page.locator('[data-appearance="web"]');
        await expect(chrome.getByRole('link', { name: 'Search' })).toBeVisible();
        await expect(chrome.getByRole('button', { name: 'Open Menu' })).toBeVisible();
      },
      page.locator('[data-appearance="web"]')
    );
  });
});
