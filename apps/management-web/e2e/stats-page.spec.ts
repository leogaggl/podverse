import { expect, test } from '@playwright/test';

import { ROUTES } from './helpers/routes';
import { capturePageLoad } from './helpers/stepScreenshots';

/**
 * E2E seed: superuser e2e-superadmin@example.com / Test!1Aa
 * (see tools/management-web/seed-e2e.mjs, make e2e_seed_management_web)
 */

const MOCK_STATS_ROW = {
  id: 4242,
  title: 'E2E stats mock title',
  day_count: 3,
  week_count: 10,
  month_count: 20,
  all_time_count: 999,
  range_count: 42,
};

const MOCK_STATS_DETAIL = {
  id: MOCK_STATS_ROW.id,
  title: MOCK_STATS_ROW.title,
  day_count: MOCK_STATS_ROW.day_count,
  week_count: MOCK_STATS_ROW.week_count,
  month_count: MOCK_STATS_ROW.month_count,
  all_time_count: MOCK_STATS_ROW.all_time_count,
  daily: [
    { day: '2026-10-20', listener_count: 1 },
    { day: '2026-10-21', listener_count: 2 },
  ],
};

test.describe('Management-web stats page', () => {
  test('When a superuser opens the stats page with mocked stats API responses, they can switch the entity tab, open a table row, and use the close control in the detail panel.', async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);

    await page.route(/\/stats\/[a-z]+\/top(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rows: [MOCK_STATS_ROW],
          total: 1,
          page: 1,
          pageSize: 25,
        }),
      });
    });

    await page.route(/\/stats\/[a-z]+\/\d+(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STATS_DETAIL),
      });
    });

    await page.goto(ROUTES.HOME);
    await page.locator('#email').fill('e2e-superadmin@example.com');
    await page.locator('#password').fill('Test!1Aa');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(ROUTES.STATS);
    await expect(page).toHaveURL(/\/stats$/);

    await expect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Sort by Title' })).toBeVisible();

    await page.getByRole('button', { name: 'Items' }).click();
    await expect(page.getByText(/Top 10 Items/)).toBeVisible();

    await page.getByRole('row', { name: /E2E stats mock title/ }).click();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'E2E stats mock title', level: 3 })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Daily Breakdown' })).toBeVisible();
    await expect(page.getByText('Weekly breakdown')).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'The stats detail panel opens for the selected row on the Items tab.',
      page.getByRole('heading', { name: 'E2E stats mock title', level: 3 })
    );

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible();

    await capturePageLoad(
      page,
      testInfo,
      'The stats detail panel closes and returns to the table view.',
      page.getByRole('heading', { name: 'Stats', level: 1 })
    );

    const weekTopRequest = page.waitForRequest(
      (statsRequest) =>
        statsRequest.method() === 'GET' &&
        statsRequest.url().includes('/stats/item/top') &&
        statsRequest.url().includes('range=week')
    );
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page).toHaveURL(/range=week/);
    expect(new URL(page.url()).searchParams.get('entity')).toBe('item');
    expect(new URL(page.url()).searchParams.get('range')).toBe('week');
    const topRequest = await weekTopRequest;
    expect(topRequest.url()).toContain('range=week');
  });
});
