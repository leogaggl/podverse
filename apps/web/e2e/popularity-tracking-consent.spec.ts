import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  E2E_CONSENT_ORDER_EMAIL,
  E2E_CONSENT_ORDER_PASSWORD,
  E2E_POPULARITY_STALE_EMAIL,
} from './helpers/legalConsent';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const API_ME_URL = 'http://localhost:4030/api/v2/auth/me';
const UNDECIDED_EMAIL = 'e2e-popularity-undecided@example.com';
const DECIDED_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const POPULARITY_SCREEN_NAME = 'Popularity Tracking';
const TERMS_SCREEN_NAME = 'Terms of Service';
const TERMS_CHECKBOX_NAME = 'I have read and agree to the Terms of Service.';

async function loginViaApi(page: Page, email: string, password = LOGIN_PASSWORD): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email, password },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

async function listenStatsAccepted(page: Page): Promise<boolean | null | undefined> {
  const meResponse = await page.request.get(API_ME_URL);
  expect(meResponse.ok(), await meResponse.text()).toBeTruthy();
  const meBody = (await meResponse.json()) as {
    account_settings?: { listen_stats_accepted?: boolean | null };
  };
  return meBody.account_settings?.listen_stats_accepted;
}

function popularitySwitch(page: Page) {
  return page.getByRole('switch', { name: POPULARITY_SCREEN_NAME });
}

function optOutDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Turn Off Popularity Tracking?' });
}

test.describe('Popularity tracking consent', () => {
  test.describe.configure({ mode: 'serial' });

  test('When the popularity-tracking copy is loading, the screen shows a loading spinner before content.', async ({
    page,
  }) => {
    await loginViaApi(page, UNDECIDED_EMAIL);
    await page.route(
      '**/api/v2/legal/popularity-tracking',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.continue();
      },
      { times: 1 }
    );

    await page.goto('/');
    await expect(page).toHaveURL('/');

    const screen = page.getByRole('main', { name: POPULARITY_SCREEN_NAME });
    await expect(screen).toBeVisible();
    await expect(screen.getByLabel('Loading…')).toBeVisible();
    await expect(screen.getByText('Popularity Tracking is optional')).toBeVisible();
    await expect(screen.getByLabel('Loading…')).toBeHidden();
    await expect(page.getByRole('main', { name: TERMS_SCREEN_NAME })).toHaveCount(0);
  });

  test('When a logged-in account has never decided, Yes records accept and the screen closes without leaving the page.', async ({
    page,
  }, testInfo) => {
    await loginViaApi(page, UNDECIDED_EMAIL);
    await page.goto('/');
    await expect(page).toHaveURL('/');

    const screen = page.getByRole('main', { name: POPULARITY_SCREEN_NAME });
    await expect(screen).toBeVisible();

    await actionAndCapture(
      page,
      testInfo,
      'How It Works opens above the choice buttons.',
      async () => {
        await expect(screen.getByText('Popularity Tracking is optional')).toBeVisible();
        const disclosure = screen.getByText('How It Works');
        const yes = screen.getByRole('button', { name: 'Yes, Track Me' });
        const disclosureBox = await disclosure.boundingBox();
        const yesBox = await yes.boundingBox();
        expect(disclosureBox).not.toBeNull();
        expect(yesBox).not.toBeNull();
        expect(disclosureBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(yesBox?.y ?? 0);
        await disclosure.click();
        await expect(page).toHaveURL('/');
        await expect(screen.getByRole('heading', { name: 'What We Store' })).toBeVisible();
      },
      screen.getByRole('heading', { name: 'What We Store' })
    );

    await actionAndCapture(
      page,
      testInfo,
      'Yes records accept and closes the Popularity Tracking screen.',
      async () => {
        await screen.getByRole('button', { name: 'Yes, Track Me' }).click();
        await expect(page).toHaveURL('/');
        await expect(page.getByRole('main', { name: POPULARITY_SCREEN_NAME })).toHaveCount(0);
        expect(await listenStatsAccepted(page)).toBe(true);
      }
    );
  });

  test('When an account still needs updated terms, the terms screen appears before popularity tracking.', async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);

    await loginViaApi(page, E2E_CONSENT_ORDER_EMAIL, E2E_CONSENT_ORDER_PASSWORD);
    await page.goto('/');
    await expect(page).toHaveURL('/');

    const termsScreen = page.getByRole('main', { name: TERMS_SCREEN_NAME });
    await expect(termsScreen).toBeVisible();
    await expect(page.getByRole('main', { name: POPULARITY_SCREEN_NAME })).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'Updated terms block the app before the Popularity Tracking screen can open.',
      termsScreen
    );

    await actionAndCapture(
      page,
      testInfo,
      'After the updated terms are accepted, No Thanks opts out of popularity tracking.',
      async () => {
        await page.getByRole('checkbox', { name: TERMS_CHECKBOX_NAME }).check();
        await page.getByRole('button', { name: 'Accept' }).click();
        const popularityScreen = page.getByRole('main', { name: POPULARITY_SCREEN_NAME });
        await expect(popularityScreen).toBeVisible();
        await popularityScreen.getByRole('button', { name: 'No Thanks' }).click();
        await expect(page.getByRole('main', { name: TERMS_SCREEN_NAME })).toHaveCount(0);
        await expect(page.getByRole('main', { name: POPULARITY_SCREEN_NAME })).toHaveCount(0);
        expect(await listenStatsAccepted(page)).toBe(false);
      }
    );
  });

  test('When the account already accepted, turning the settings switch off asks first, and tracking turns back on only after Yes.', async ({
    page,
  }, testInfo) => {
    await loginViaApi(page, DECIDED_EMAIL);
    await page.goto('/settings?tab=account');
    await expect(page).toHaveURL(/\/settings\?tab=account/);
    await expect(page.getByRole('main', { name: POPULARITY_SCREEN_NAME })).toHaveCount(0);
    await expect(popularitySwitch(page)).toBeChecked();

    await capturePageLoad(
      page,
      testInfo,
      'Account settings show popularity tracking as a switch.',
      popularitySwitch(page)
    );

    const dialog = optOutDialog(page);

    await actionAndCapture(
      page,
      testInfo,
      'Turning the switch off asks first, and Cancel keeps tracking on.',
      async () => {
        await popularitySwitch(page).click();
        await expect(dialog).toBeVisible();
      },
      dialog
    );

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(popularitySwitch(page)).toBeChecked();
    expect(await listenStatsAccepted(page)).toBe(true);

    await actionAndCapture(
      page,
      testInfo,
      'Confirming Turn Off and Delete turns tracking off.',
      async () => {
        await popularitySwitch(page).click();
        await dialog.getByRole('button', { name: 'Turn Off and Delete' }).click();
        await expect(popularitySwitch(page)).not.toBeChecked();
        expect(await listenStatsAccepted(page)).toBe(false);
      },
      popularitySwitch(page)
    );

    await actionAndCapture(
      page,
      testInfo,
      'Turning the switch on opens the agreement, and No Thanks leaves tracking off.',
      async () => {
        await popularitySwitch(page).click();
        await expect(page).toHaveURL('/popularity-tracking');
        const screen = page.getByRole('main', { name: POPULARITY_SCREEN_NAME });
        await expect(screen).toBeVisible();
        expect(await listenStatsAccepted(page)).toBe(false);
        await screen.getByRole('button', { name: 'No Thanks' }).click();
        await expect(optOutDialog(page)).toHaveCount(0);
        await expect(page).toHaveURL(/\/settings\?tab=account/);
        await expect(popularitySwitch(page)).not.toBeChecked();
        expect(await listenStatsAccepted(page)).toBe(false);
      },
      popularitySwitch(page)
    );

    await actionAndCapture(
      page,
      testInfo,
      'Yes on the agreement screen turns the settings switch on.',
      async () => {
        await popularitySwitch(page).click();
        await expect(page).toHaveURL('/popularity-tracking');
        await page.getByRole('button', { name: 'Yes, Track Me' }).click();
        await expect(page).toHaveURL(/\/settings\?tab=account/);
        await expect(popularitySwitch(page)).toBeChecked();
        expect(await listenStatsAccepted(page)).toBe(true);
      },
      popularitySwitch(page)
    );
  });

  test('When an account accepted an older version, No Thanks on the prompt asks first, and confirming turns tracking off.', async ({
    page,
  }, testInfo) => {
    await loginViaApi(page, E2E_POPULARITY_STALE_EMAIL);
    await page.goto('/');
    await expect(page).toHaveURL('/');

    const screen = page.getByRole('main', { name: POPULARITY_SCREEN_NAME });
    await expect(screen).toBeVisible();

    const dialog = optOutDialog(page);

    await actionAndCapture(
      page,
      testInfo,
      'No Thanks on an older acceptance asks before turning tracking off.',
      async () => {
        await screen.getByRole('button', { name: 'No Thanks' }).click();
        await expect(dialog).toBeVisible();
      },
      dialog
    );

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(screen).toBeVisible();
    expect(await listenStatsAccepted(page)).toBe(true);

    await screen.getByRole('button', { name: 'No Thanks' }).click();
    await dialog.getByRole('button', { name: 'Turn Off and Delete' }).click();
    await expect(page.getByRole('main', { name: POPULARITY_SCREEN_NAME })).toHaveCount(0);
    expect(await listenStatsAccepted(page)).toBe(false);
  });
});
