import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const BOLT11 = 'lnbc30n1pe2einvoice';
const RENEWED_BOLT11 = 'lnbc30n1pe2einvoicerenew';
const MONTHLY_PRODUCT_ID = 91001;

const ENTITLED_STATUS = {
  tier: 'premium',
  is_entitled: true,
  membership_expires_at: '2027-06-01T12:00:00.000Z',
  in_grace_period: false,
  billing_cadence: 'monthly',
  billing_customer_ref: 'e2e-strike',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strikeProcessor() {
  return {
    processor_id: 'strike',
    min_client_version: null,
    products: [
      {
        id: MONTHLY_PRODUCT_ID,
        product_code: 'premium',
        cadence: 'monthly',
        external_product_id: 'podverse-premium-monthly',
        external_base_plan_id: null,
      },
      {
        id: 91002,
        product_code: 'premium',
        cadence: 'annual',
        external_product_id: 'podverse-premium-annual',
        external_base_plan_id: null,
      },
    ],
  };
}

async function login(page: Page): Promise<void> {
  const loginResponse = await page.request.post(API_LOGIN_URL, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
}

/** Checkout options come from the API, with Lightning added for this spec only. */
async function offerStrike(page: Page): Promise<void> {
  await page.route('**/billing/checkout-options**', async (route) => {
    const response = await route.fetch();
    const json: unknown = await response.json();
    if (!isRecord(json) || !Array.isArray(json.processors)) {
      await route.fulfill({ response });
      return;
    }
    const processors = json.processors.filter(
      (processor) => !isRecord(processor) || processor.processor_id !== 'strike'
    );
    processors.push(strikeProcessor());
    await route.fulfill({
      body: JSON.stringify({ ...json, processors }),
      contentType: 'application/json',
      status: response.status(),
    });
  });
}

function checkoutBody(params: {
  bolt11: string;
  checkoutId: number;
  expiresAt: string;
  state: 'unpaid' | 'pending' | 'settled' | 'expired';
}) {
  return {
    checkout_id: params.checkoutId,
    bolt11: params.bolt11,
    amount: '3.00',
    currency_code: 'USD',
    expires_at: params.expiresAt,
    state: params.state,
    ...(params.state === 'settled'
      ? { confirmed: true, outcomes: [], status: ENTITLED_STATUS }
      : {}),
  };
}

type SettlePhase = 'unpaid' | 'pending' | 'settled';

/**
 * Drives create and poll without Strike. `settle` follows `phase`, which the test advances
 * after each screen is checked. `expire` makes the first invoice already past its expiry
 * and the next one payable.
 */
async function mockStrikeCheckout(
  page: Page,
  script: 'settle' | 'expire',
  createdBodies: unknown[]
): Promise<{ phase: SettlePhase }> {
  const phase: { phase: SettlePhase } = { phase: 'unpaid' };
  let created = 0;
  await page.route('**/billing/strike/checkouts**', async (route) => {
    const url = route.request().url().split('?')[0] ?? '';
    const method = route.request().method();
    const isCreate = method === 'POST' && /\/billing\/strike\/checkouts\/?$/.test(url);
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    if (isCreate) {
      created += 1;
      const posted: unknown = route.request().postDataJSON();
      createdBodies.push(posted);
      const firstIsExpired = script === 'expire' && created === 1;
      let bolt11 = BOLT11;
      if (script === 'expire' && !firstIsExpired) {
        bolt11 = RENEWED_BOLT11;
      }
      await route.fulfill({
        body: JSON.stringify(
          checkoutBody({
            bolt11,
            checkoutId: created,
            expiresAt: firstIsExpired ? past : future,
            state: 'unpaid',
          })
        ),
        contentType: 'application/json',
        status: 201,
      });
      return;
    }
    if (method === 'GET') {
      let state: 'unpaid' | 'pending' | 'settled' | 'expired' = 'unpaid';
      if (script === 'settle') {
        state = phase.phase;
      } else if (created <= 1) {
        state = 'expired';
      }
      const bolt11 = script === 'expire' && created > 1 ? RENEWED_BOLT11 : BOLT11;
      await route.fulfill({
        body: JSON.stringify(
          checkoutBody({
            bolt11,
            checkoutId: created,
            expiresAt: state === 'expired' ? past : future,
            state,
          })
        ),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }
    await route.continue();
  });
  return phase;
}

test.describe('Checkout with Lightning', () => {
  // The invoice is polled every 3 seconds before the success page opens.
  test.describe.configure({ timeout: 20_000 });

  test('When Lightning is the only web payment method, the member sees the invoice and membership confirms after it settles.', async ({
    page,
  }, testInfo) => {
    const createdBodies: unknown[] = [];
    await login(page);
    await offerStrike(page);
    const settlement = await mockStrikeCheckout(page, 'settle', createdBodies);
    await page.route('**/billing/status**', async (route) => {
      await route.fulfill({
        body: JSON.stringify(ENTITLED_STATUS),
        contentType: 'application/json',
        status: 200,
      });
    });

    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout\/?$/);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(page.url()).origin,
    });
    await expect(page.getByTestId('checkout-intro')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Choose a Payment Method' })).toHaveCount(0);

    const panel = page.getByTestId('checkout-strike');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Lightning Invoice' })).toBeVisible();
    const qr = panel.getByRole('img', { name: 'Lightning invoice' });
    await expect(qr).toBeVisible();
    await expect(panel).toContainText('$3.00');
    await expect(panel.getByText(/Expires in/)).toBeVisible();
    const copy = panel.getByRole('button', { name: 'Copy Invoice' });
    await expect(copy).toBeVisible();
    const wallet = panel.getByRole('link', { name: 'Open Wallet' });
    await expect(wallet).toHaveAttribute('href', `lightning:${BOLT11}`);

    const posted = createdBodies[0];
    expect(isRecord(posted)).toBe(true);
    if (isRecord(posted)) {
      expect(posted.processor_product_id).toBe(MONTHLY_PRODUCT_ID);
      expect(posted.platform).toBeUndefined();
    }

    await copy.click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(BOLT11);
    await capturePageLoad(
      page,
      testInfo,
      'The Lightning invoice shows a QR code, Copy Invoice, and Open Wallet.',
      qr
    );

    settlement.phase = 'pending';
    const pending = panel.getByText('Payment detected, confirming…');
    await expect(pending).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'The invoice says the payment was detected and is confirming.',
      pending
    );

    settlement.phase = 'settled';
    await expect(page).toHaveURL(/\/checkout\/success/);
    const success = page.getByTestId('checkout-success-detail');
    await expect(success).toContainText(
      'Your Premium purchase is complete. Membership was extended by 1 month.'
    );
    await capturePageLoad(
      page,
      testInfo,
      'The success page says the Premium purchase added 1 month.',
      success
    );
  });

  test('When a Lightning invoice expires, the member can get a new invoice.', async ({
    page,
  }, testInfo) => {
    const createdBodies: unknown[] = [];
    await login(page);
    await offerStrike(page);
    await mockStrikeCheckout(page, 'expire', createdBodies);

    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout\/?$/);

    const expired = page.getByText('This invoice has expired.');
    await expect(expired).toBeVisible();
    const renew = page.getByRole('button', { name: 'Get a New Invoice' });
    await expect(renew).toBeVisible();
    await expect(page.getByRole('img', { name: 'Lightning invoice' })).toHaveCount(0);
    await capturePageLoad(
      page,
      testInfo,
      'The expired Lightning invoice offers a new invoice.',
      renew
    );

    await renew.click();
    const qr = page.getByRole('img', { name: 'Lightning invoice' });
    await expect(qr).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Invoice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Wallet' })).toHaveAttribute(
      'href',
      `lightning:${RENEWED_BOLT11}`
    );
    await expect(page.getByText('This invoice has expired.')).toHaveCount(0);
    await expect(page).toHaveURL(/\/checkout\/?$/);
    expect(createdBodies).toHaveLength(2);
    await capturePageLoad(page, testInfo, 'A new Lightning invoice replaces the expired one.', qr);
  });
});
