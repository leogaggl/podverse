import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const SIGNED_OUT_SENTENCES = [
  'You were signed out from another device',
  'Your password was changed',
  'An administrator signed you out',
  'You were signed out for your security',
] as const;

async function expectLoginForm(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

async function expectNoSignedOutSentences(page: Page): Promise<void> {
  for (const sentence of SIGNED_OUT_SENTENCES) {
    await expect(page.getByText(sentence, { exact: true })).toHaveCount(0);
  }
}

test.describe('Signed-out reason on the management login page', () => {
  test('When the login page is opened with notice=password_changed, it shows that the password was changed.', async ({
    page,
  }, testInfo) => {
    await page.goto('/?notice=password_changed');

    await expect(page).toHaveURL(/\/\?notice=password_changed$/);
    const alert = page.getByText('Your password was changed', { exact: true });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'The login page shows that the password was changed.',
      alert
    );
  });

  test('When the login page is opened with notice=admin_force_logout, it shows that an administrator signed them out.', async ({
    page,
  }, testInfo) => {
    await page.goto('/?notice=admin_force_logout');

    await expect(page).toHaveURL(/\/\?notice=admin_force_logout$/);
    const alert = page.getByText('An administrator signed you out', { exact: true });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'The login page shows that an administrator signed them out.',
      alert
    );
  });

  test('When the login page is opened with a notice value outside the four, it shows none of the signed-out sentences.', async ({
    page,
  }, testInfo) => {
    await page.goto('/?notice=not-a-notice');

    await expect(page).toHaveURL(/\/\?notice=not-a-notice$/);
    await expectLoginForm(page);
    await expectNoSignedOutSentences(page);
    await capturePageLoad(
      page,
      testInfo,
      'A notice value outside the four leaves the login page without a signed-out sentence.',
      page.getByRole('button', { name: 'Sign in' })
    );
  });

  test('When the login page is opened with no notice query, it shows none of the signed-out sentences.', async ({
    page,
  }, testInfo) => {
    await page.goto('/');

    await expect(page).toHaveURL(/:\/\/[^/]+\/$/);
    await expectLoginForm(page);
    await expectNoSignedOutSentences(page);
    await capturePageLoad(
      page,
      testInfo,
      'The login page with no notice query shows none of the signed-out sentences.',
      page.getByRole('button', { name: 'Sign in' })
    );
  });
});
