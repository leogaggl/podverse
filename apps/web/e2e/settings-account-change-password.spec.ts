import type { APIRequestContext, Locator, Page, PlaywrightWorkerArgs } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const E2E_API_BASE_URL = 'http://localhost:4030/api/v2';

/** Dedicated account. Sync the email with tools/web/seed-e2e.mjs (`E2E_CHANGE_PASSWORD_WEB_EMAIL`). */
const CHANGE_PASSWORD_EMAIL = 'e2e-change-password-web@example.com';

const STABLE_PASSWORD = 'Test!1Aa';
const TEMPORARY_PASSWORD = 'E2e-web-pw2';

const CURRENT_INCORRECT = 'Current password is incorrect.';
const SUCCESS_SENTENCE =
  'Your password was changed. Every other device signed in to this account was signed out.';

async function postLogin(request: APIRequestContext, password: string) {
  return request.post(`${E2E_API_BASE_URL}/auth/login`, {
    data: { email: CHANGE_PASSWORD_EMAIL, password },
  });
}

async function loginChangePasswordUser(page: Page): Promise<void> {
  const stableLogin = await postLogin(page.request, STABLE_PASSWORD);
  if (stableLogin.status() === 401) {
    // A previous run can stop after the password changed. Sign in with the temporary
    // password, put the stable password back, and sign in again.
    const temporaryLogin = await postLogin(page.request, TEMPORARY_PASSWORD);
    if (!temporaryLogin.ok()) {
      throw new Error('Change-password account login failed');
    }
    const restored = await page.request.post(`${E2E_API_BASE_URL}/account/change-password`, {
      data: {
        current_password: TEMPORARY_PASSWORD,
        new_password: STABLE_PASSWORD,
      },
    });
    if (!restored.ok()) {
      throw new Error('Change-password account login failed');
    }
    const retry = await postLogin(page.request, STABLE_PASSWORD);
    if (!retry.ok()) {
      throw new Error('Change-password account login failed');
    }
    return;
  }
  if (!stableLogin.ok()) {
    throw new Error('Change-password account login failed');
  }
}

async function restoreStablePassword(page: Page): Promise<void> {
  await page.request.post(`${E2E_API_BASE_URL}/account/change-password`, {
    data: {
      current_password: TEMPORARY_PASSWORD,
      new_password: STABLE_PASSWORD,
    },
  });
}

async function expectStablePasswordWorks(
  playwright: PlaywrightWorkerArgs['playwright']
): Promise<void> {
  const request = await playwright.request.newContext();
  try {
    const response = await postLogin(request, STABLE_PASSWORD);
    expect(response.status()).toBe(200);
  } finally {
    await request.dispose();
  }
}

async function expectStillSignedIn(page: Page): Promise<void> {
  const me = await page.request.get(`${E2E_API_BASE_URL}/auth/me`);
  expect(me.status()).toBe(200);
}

async function openAccountTab(page: Page): Promise<void> {
  await page.goto('/settings?tab=account');
  await expect(page).toHaveURL(/\/settings\?tab=account/);
  await expect(page.getByRole('heading', { name: 'Change Password', exact: true })).toBeVisible();
}

async function openChangePasswordDialog(page: Page): Promise<Locator> {
  const section = page.getByRole('heading', { name: 'Change Password', exact: true }).locator('..');
  await section.getByRole('button', { name: 'Change Password', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Change Password' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Change password in Settings', () => {
  test('When the current password is wrong, the dialog explains that and the browser stays signed in.', async ({
    page,
    playwright,
  }, testInfo) => {
    await loginChangePasswordUser(page);
    await openAccountTab(page);
    const dialog = await openChangePasswordDialog(page);
    await dialog
      .getByRole('textbox', { name: 'Current Password', exact: true })
      .fill('wrong-password');
    await dialog
      .getByRole('textbox', { name: 'New Password', exact: true })
      .fill(TEMPORARY_PASSWORD);
    await dialog.getByRole('button', { name: 'Change Password', exact: true }).click();
    await expect(dialog).toBeVisible();
    const incorrect = dialog.getByText(CURRENT_INCORRECT, { exact: true });
    await expect(incorrect).toBeVisible();
    await expectStillSignedIn(page);
    await expectStablePasswordWorks(playwright);
    await capturePageLoad(
      page,
      testInfo,
      'The dialog explains that the current password is incorrect.',
      incorrect
    );
  });

  test('When the new password is accepted, the dialog closes and the browser stays on Account, signed in.', async ({
    page,
  }, testInfo) => {
    await loginChangePasswordUser(page);
    try {
      await openAccountTab(page);
      const dialog = await openChangePasswordDialog(page);
      const currentPassword = dialog.getByRole('textbox', {
        name: 'Current Password',
        exact: true,
      });
      const newPassword = dialog.getByRole('textbox', { name: 'New Password', exact: true });
      await expect(currentPassword).toBeVisible();
      await expect(newPassword).toBeVisible();
      await expect(dialog.locator('input[name="currentPassword"]')).toHaveAttribute(
        'type',
        'password'
      );
      await expect(dialog.locator('input[name="newPassword"]')).toHaveAttribute('type', 'password');
      await expect(dialog.getByRole('textbox', { name: 'Confirm Password' })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: /show password/i })).toHaveCount(0);
      await currentPassword.fill(STABLE_PASSWORD);
      await newPassword.fill(TEMPORARY_PASSWORD);
      await dialog.getByRole('button', { name: 'Change Password', exact: true }).click();
      await expect(dialog).toBeHidden();
      const success = page.getByText(SUCCESS_SENTENCE, { exact: true });
      await expect(success).toBeVisible();
      await expect(page).toHaveURL(/\/settings\?tab=account/);
      await expectStillSignedIn(page);
      await capturePageLoad(
        page,
        testInfo,
        'The dialog closes and the success sentence says the password was changed.',
        success
      );
    } finally {
      await restoreStablePassword(page);
    }
  });

  test('Cancel closes the dialog without changing the password.', async ({
    page,
    playwright,
  }, testInfo) => {
    await loginChangePasswordUser(page);
    await openAccountTab(page);
    const dialog = await openChangePasswordDialog(page);
    await dialog
      .getByRole('textbox', { name: 'Current Password', exact: true })
      .fill(STABLE_PASSWORD);
    await dialog
      .getByRole('textbox', { name: 'New Password', exact: true })
      .fill(TEMPORARY_PASSWORD);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expectStablePasswordWorks(playwright);
    const reopened = await openChangePasswordDialog(page);
    await expect(reopened.locator('input[name="currentPassword"]')).toHaveValue('');
    await expect(reopened.locator('input[name="newPassword"]')).toHaveValue('');
    const heading = page.getByRole('heading', { name: 'Change Password', exact: true });
    await capturePageLoad(
      page,
      testInfo,
      'Cancel closes the dialog and the Change Password section stays on Account.',
      heading
    );
  });
});
