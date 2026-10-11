import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

const LOGIN_EMAIL = 'e2e-user@example.com';
const LOGIN_PASSWORD = 'Test!1Aa';
const API_LOGIN_URL = 'http://localhost:4030/api/v2/auth/login';
const API_ORIGIN = 'http://localhost:4030/api/v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function processedAndEntitled(body: unknown): boolean {
  if (!isRecord(body) || !isRecord(body.outcome) || !isRecord(body.status)) {
    return false;
  }
  return body.outcome.status === 'processed' && body.status.is_entitled === true;
}

function testProductId(body: unknown, cadence: 'monthly' | 'annual'): string | null {
  if (!isRecord(body) || !Array.isArray(body.processors)) {
    return null;
  }
  for (const processor of body.processors) {
    if (
      !isRecord(processor) ||
      processor.processor_id !== 'test' ||
      !Array.isArray(processor.products)
    ) {
      continue;
    }
    for (const product of processor.products) {
      if (
        isRecord(product) &&
        product.cadence === cadence &&
        typeof product.external_product_id === 'string'
      ) {
        return product.external_product_id;
      }
    }
  }
  return null;
}

function settledProductId(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.event)) {
    return null;
  }
  if (body.event.type !== 'payment_settled' || typeof body.event.externalProductId !== 'string') {
    return null;
  }
  return body.event.externalProductId;
}

test.describe('Checkout membership', () => {
  test.describe.configure({ timeout: 20_000 });
  test('When the test processor is offered, a monthly purchase confirms membership.', async ({
    page,
  }, testInfo) => {
    const loginResponse = await page.request.post(API_LOGIN_URL, {
      data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    });
    expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();

    const optionsResponse = await page.request.get(
      `${API_ORIGIN}/billing/checkout-options?platform=web`
    );
    expect(optionsResponse.ok(), await optionsResponse.text()).toBeTruthy();
    const monthlyProductId = testProductId(await optionsResponse.json(), 'monthly');
    expect(monthlyProductId).not.toBeNull();

    await page.goto('/checkout');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    const intro = page.getByTestId('checkout-intro');
    await expect(intro).toBeVisible();
    await expect(intro).toContainText(
      'Choose a Premium plan, then complete payment below. Time left on your current membership is added to your purchase.'
    );
    await expect(page.getByRole('radiogroup', { name: 'Choose a Plan' })).toBeVisible();

    const simulateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/billing/test/simulate') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Complete Test Purchase' }).click();
    const response = await simulateResponse;
    expect(response.ok(), await response.text()).toBeTruthy();
    const posted: unknown = response.request().postDataJSON();
    expect(settledProductId(posted)).toBe(monthlyProductId);
    expect(processedAndEntitled(await response.json())).toBe(true);

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

    await expect(page).toHaveURL(/\/membership\/?$/);
    const expiry = page.getByTestId('membership-expiry');
    await expect(expiry).toContainText('Premium');
    await expect(expiry).toContainText('Expires On');

    await capturePageLoad(
      page,
      testInfo,
      'Membership shows the Premium expiration at the top.',
      expiry
    );
  });

  test('When the test processor is offered, an annual purchase confirms membership.', async ({
    page,
  }, testInfo) => {
    const loginResponse = await page.request.post(API_LOGIN_URL, {
      data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    });
    expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();

    const optionsResponse = await page.request.get(
      `${API_ORIGIN}/billing/checkout-options?platform=web`
    );
    expect(optionsResponse.ok(), await optionsResponse.text()).toBeTruthy();
    const annualProductId = testProductId(await optionsResponse.json(), 'annual');
    expect(annualProductId).not.toBeNull();

    await page.goto('/checkout');
    await page.getByRole('radio', { name: /Annually/ }).check();

    const simulateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/billing/test/simulate') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Complete Test Purchase' }).click();
    const response = await simulateResponse;
    expect(response.ok(), await response.text()).toBeTruthy();
    const posted: unknown = response.request().postDataJSON();
    expect(settledProductId(posted)).toBe(annualProductId);
    expect(processedAndEntitled(await response.json())).toBe(true);

    await expect(page).toHaveURL(/\/checkout\/success/);
    const success = page.getByTestId('checkout-success-detail');
    await expect(success).toContainText(
      'Your Premium purchase is complete. Membership was extended by 1 year.'
    );

    await capturePageLoad(
      page,
      testInfo,
      'The success page says the Premium purchase added 1 year.',
      success
    );

    await expect(page).toHaveURL(/\/membership\/?$/);
    const expiry = page.getByTestId('membership-expiry');
    await expect(expiry).toContainText('Premium');
    await expect(expiry).toContainText('Expires On');

    await capturePageLoad(
      page,
      testInfo,
      'Membership shows the Premium expiration at the top.',
      expiry
    );
  });

});
