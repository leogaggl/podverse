import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { ROUTES } from './helpers/routes';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

async function signIn(page: Page): Promise<void> {
  await page.goto(ROUTES.HOME);
  await page.locator('#email').fill('e2e-superadmin@example.com');
  await page.locator('#password').fill('Test!1Aa');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

test.describe('Management-web merge review', () => {
  test('approve marks a needs-review pair verified and leaves the old feed active', async ({
    page,
  }, testInfo: TestInfo) => {
    await signIn(page);
    await page.goto(ROUTES.FEEDS);

    const reviewCard = page.getByRole('link', { name: /Merge Review/ });
    await expect(reviewCard).toBeVisible();
    await actionAndCapture(
      page,
      testInfo,
      'Open Merge Review from the feeds hub.',
      async () => {
        await reviewCard.click();
        await expect(page.getByRole('heading', { name: 'Merge Review', level: 1 })).toBeVisible();
      },
      page.getByRole('heading', { name: 'Merge Review', level: 1 })
    );

    const approveRow = page.getByRole('row', { name: /E2E Review Approve/ });
    await expect(approveRow).toBeVisible();
    await capturePageLoad(page, testInfo, 'A needs-review pair is waiting.', approveRow);

    await approveRow.getByRole('button', { name: 'Review E2E Review Approve' }).click();
    const dialog = page.getByRole('dialog', { name: 'Merge Pair' });
    await expect(dialog.getByRole('button', { name: 'Approve E2E Review Approve' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Revert E2E Review Approve' })).toBeDisabled();
    await expect(dialog.getByText('Active', { exact: true })).toBeVisible();

    const verifiedDialog = page.getByRole('dialog', { name: 'Merge Pair' });
    await actionAndCapture(
      page,
      testInfo,
      'Approve marks the pair verified and the old feed stays active.',
      async () => {
        await dialog.getByRole('button', { name: 'Approve E2E Review Approve' }).click();
        await expect(dialog).toBeHidden();
        await page.locator('#feed-merge-review-status').click();
        await page.getByRole('menuitem', { name: 'Verified' }).click();
        const verifiedRow = page.getByRole('row', { name: /E2E Review Approve/ });
        await expect(verifiedRow).toBeVisible();
        await verifiedRow.getByRole('button', { name: 'Review E2E Review Approve' }).click();
        await expect(verifiedDialog.getByText('Verified', { exact: true })).toBeVisible();
        await expect(verifiedDialog.getByText('Active', { exact: true })).toBeVisible();
      },
      verifiedDialog
    );
  });

  test('reject hides the pair from the needs-review list', async ({ page }, testInfo) => {
    await signIn(page);
    await page.goto(ROUTES.FEEDS_MERGE_REVIEW);
    await expect(page.getByRole('heading', { name: 'Merge Review', level: 1 })).toBeVisible();

    const rejectRow = page.getByRole('row', { name: /E2E Review Reject/ });
    await expect(rejectRow).toBeVisible();
    await capturePageLoad(page, testInfo, 'A pair that can be rejected is listed.', rejectRow);

    await rejectRow.getByRole('button', { name: 'Review E2E Review Reject' }).click();
    const dialog = page.getByRole('dialog', { name: 'Merge Pair' });
    await actionAndCapture(
      page,
      testInfo,
      'Reject removes the pair from Needs Review.',
      async () => {
        await dialog.getByRole('button', { name: 'Reject E2E Review Reject' }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole('row', { name: /E2E Review Reject/ })).toHaveCount(0);
      },
      page.getByRole('heading', { name: 'Merge Review', level: 1 })
    );
  });
});
