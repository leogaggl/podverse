import { expect, test } from '@playwright/test';

import { ROUTES } from './helpers/routes';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

/**
 * Admins detail Force Logout is exercised with route mocks so the target stays deterministic.
 * Signed in as the seeded superuser, whose id is not 7001.
 */

const MOCK_ADMIN_ROW = {
  id: 7001,
  id_text: 'e2e_admin_row',
  role: 'admin',
  email: 'e2e-admin-row@example.com',
  username: null,
  permissions: {
    feeds_crud: 15,
    feed_takedown_reasons_crud: 0,
    admins_crud: 15,
    stats_crud: 15,
    billing_prices_crud: 0,
    bucket_crud: 0,
    embed_demo_crud: 0,
  },
  created_at: '2026-02-01T15:30:00.000Z',
};

const FORCE_LOGOUT_SUCCESS = 'This admin was signed out of every device.';

test.describe('Force logout on admin detail', () => {
  test('When a superuser confirms Force Logout, the admin detail page says that admin was signed out of every device.', async ({
    page,
  }, testInfo) => {
    await page.route('**/api/v2/admins', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_ADMIN_ROW]),
      });
    });

    await page.route(`**/api/v2/admins/${MOCK_ADMIN_ROW.id}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_ROW),
      });
    });

    await page.route(`**/api/v2/admins/${MOCK_ADMIN_ROW.id}/invite-link`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ invite_link: null }),
      });
    });

    let forceLogoutPosts = 0;
    await page.route(`**/api/v2/admins/${MOCK_ADMIN_ROW.id}/force-logout`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      forceLogoutPosts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ revoked_count: 1 }),
      });
    });

    await page.goto(ROUTES.HOME);
    await page.locator('#email').fill('e2e-superadmin@example.com');
    await page.locator('#password').fill('Test!1Aa');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(`${ROUTES.ADMINS}/${MOCK_ADMIN_ROW.id}`);
    await expect(page).toHaveURL(new RegExp(`/admins/${MOCK_ADMIN_ROW.id}$`));
    await expect(page.getByRole('heading', { name: 'Admin detail', level: 1 })).toBeVisible();

    const forceLogoutButton = page.getByRole('button', { name: 'Force Logout' });
    await expect(forceLogoutButton).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'The admin detail page shows Force Logout.',
      forceLogoutButton
    );

    const success = page.getByText(FORCE_LOGOUT_SUCCESS, { exact: true });
    await actionAndCapture(
      page,
      testInfo,
      'Confirming Force Logout shows the admin was signed out of every device.',
      async () => {
        await forceLogoutButton.click();
        const dialog = page.getByRole('dialog', { name: 'Confirm force logout' });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText('Sign this admin out of every device?', { exact: true })
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Force Logout' }).click();
        await expect(success).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/admins/${MOCK_ADMIN_ROW.id}$`));
      },
      success
    );
    expect(forceLogoutPosts).toBe(1);
  });
});
