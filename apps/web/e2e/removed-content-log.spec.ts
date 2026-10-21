import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { E2E_CONTENT_LOG_CHANNEL_TITLE } from './helpers/seedConstants';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const LEFT_DIRECTORY = `${E2E_CONTENT_LOG_CHANNEL_TITLE} is no longer in the directory.`;
const FOLLOW_ENDED = 'Your follow ended.';

async function loginSeedUser(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

test.describe('Settings Advanced', () => {
  test('When a signed-out visitor opens the Advanced settings tab, they land on General and the Advanced tab is absent.', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings?tab=advanced');
    await expect(page).toHaveURL(/\/settings$/);
    const preferredMediaType = page.locator('#settings_preferred_media_type_selector');
    await expect(preferredMediaType).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advanced', exact: true })).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'The unsigned visitor lands on General settings instead of the Advanced tab.',
      preferredMediaType
    );
  });

  test('A signed-in user can open Advanced and read the removed-content row for the seeded show.', async ({
    page,
  }, testInfo) => {
    await test.step('Log in as the seeded E2E user.', async () => {
      await loginSeedUser(page);
    });

    const advanced = page.getByRole('button', { name: 'Advanced', exact: true });
    const leftDirectory = page.getByText(LEFT_DIRECTORY);
    // A paragraph exposes no accessible name, so the row is the paragraph that
    // contains both sentences.
    const removedContentRow = page.getByRole('paragraph').filter({
      hasText: `${LEFT_DIRECTORY} ${FOLLOW_ENDED}`,
    });

    await test.step('Open Settings and confirm the Advanced tab is present.', async () => {
      await page.goto('/settings');
      await expect(advanced).toBeVisible();
    });

    await actionAndCapture(
      page,
      testInfo,
      'Advanced lists the seeded show that left the directory and the ended follow.',
      async () => {
        await advanced.click();
        await expect(page).toHaveURL(/\/settings\?tab=advanced/);
        await expect(page.getByRole('heading', { name: 'Removed Content' })).toBeVisible();
        await expect(leftDirectory).toBeVisible();
        await expect(page.getByText(FOLLOW_ENDED)).toBeVisible();
        await expect(removedContentRow).toBeVisible();
      },
      removedContentRow
    );
  });
});
