import { expect, test } from '@playwright/test';

import { E2E_CONFIGURED_TERMS_VERSION, E2E_SIGNUP_TEST_PASSWORD } from './helpers/legalConsent';
import { waitForMailpitMessageTo } from './helpers/mailpit';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const uniqueSignupEmail = (): string =>
  `e2e-signup-legal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe('Sign-up legal consent', () => {
  test('When terms are not accepted, the sign-up form cannot be submitted.', async ({
    page,
  }, testInfo) => {
    await page.goto('/sign-up');

    await expect(page).toHaveURL('/sign-up');

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password1"]');
    const confirmPasswordInput = page.locator('input[name="password2"]');
    const submitButton = page.getByRole('button', { name: 'Submit' });

    await emailInput.fill('e2e-signup-blocked@example.com');
    await passwordInput.fill(E2E_SIGNUP_TEST_PASSWORD);
    await confirmPasswordInput.fill(E2E_SIGNUP_TEST_PASSWORD);

    await expect(submitButton).toBeDisabled();

    await capturePageLoad(
      page,
      testInfo,
      'The sign-up submit button stays disabled until the visitor accepts the Terms of Service.',
      submitButton
    );
  });

  test('When terms are accepted, the account is created with the expected legal payload.', async ({
    page,
  }, testInfo) => {
    const signupEmail = uniqueSignupEmail();

    await page.goto('/sign-up');

    await expect(page).toHaveURL('/sign-up');

    const createAccountRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/v2/account')
    );

    const termsCheckbox = page.getByRole('checkbox', {
      name: /I have read and agree to the terms/i,
    });
    await page.locator('input[name="email"]').fill(signupEmail);
    await page.locator('input[name="password1"]').fill(E2E_SIGNUP_TEST_PASSWORD);
    await page.locator('input[name="password2"]').fill(E2E_SIGNUP_TEST_PASSWORD);
    await termsCheckbox.check();

    await actionAndCapture(
      page,
      testInfo,
      'Submitting the sign-up form with legal consent creates the account and shows the success message.',
      async () => {
        await page.getByRole('button', { name: 'Submit' }).click();
        const request = await createAccountRequest;
        const payload = request.postDataJSON() as {
          terms_version?: string;
          allow_listen_stats?: boolean;
        };
        expect(payload.terms_version).toBe(E2E_CONFIGURED_TERMS_VERSION);
        expect(payload.allow_listen_stats).toBeUndefined();
        await expect(
          page.getByText(
            'Account created successfully. Please check your email for a verification link.'
          )
        ).toBeVisible();
        await waitForMailpitMessageTo(signupEmail);
      },
      page.getByText(
        'Account created successfully. Please check your email for a verification link.'
      )
    );
  });

  test('When the verification email is not sent, sign-up explains that and links the contact address.', async ({
    page,
  }, testInfo) => {
    const signupEmail = uniqueSignupEmail();

    await page.route('**/api/v2/account**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname.replace(/\/$/, '');
      if (request.method() !== 'POST' || !pathname.endsWith('/account')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Account created',
          code: 'verification_email_not_sent',
        }),
      });
    });

    await page.goto('/sign-up');
    await page.locator('input[name="email"]').fill(signupEmail);
    await page.locator('input[name="password1"]').fill(E2E_SIGNUP_TEST_PASSWORD);
    await page.locator('input[name="password2"]').fill(E2E_SIGNUP_TEST_PASSWORD);
    await page.getByRole('checkbox', { name: /I have read and agree to the terms/i }).check();

    const dialog = page.getByRole('dialog', { name: 'Verification Email Not Sent' });

    await actionAndCapture(
      page,
      testInfo,
      'A failed verification email shows a notice with the contact address instead of the success message.',
      async () => {
        await page.getByRole('button', { name: 'Submit' }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/our email service isn't working right now/)).toBeVisible();
        await expect(dialog.getByRole('link', { name: 'contact-e2e@example.com' })).toBeVisible();
        await expect(
          page.getByText(
            'Account created successfully. Please check your email for a verification link.'
          )
        ).toHaveCount(0);
      },
      dialog
    );
  });
});
