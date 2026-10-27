import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

async function expectListFillsContent(page: Page) {
  const loginPrompt = page.getByText('Log in to use this feature.');
  await expect(loginPrompt).toBeVisible();
  await expect(page.locator('#mainOuterWrapper main aside')).toHaveCount(0);

  const widths = await loginPrompt.evaluate((node) => {
    let current = node.parentElement;
    while (current) {
      const parent = current.parentElement;
      if (!parent) {
        break;
      }
      if (getComputedStyle(parent).flexDirection === 'row-reverse') {
        return {
          childCount: parent.children.length,
          childWidth: current.getBoundingClientRect().width,
          parentWidth: parent.getBoundingClientRect().width,
        };
      }
      current = parent;
    }
    return null;
  });

  expect(widths).not.toBeNull();
  if (!widths) {
    return;
  }
  expect(widths.childCount).toBe(1);
  expect(widths.childWidth).toBeGreaterThan(widths.parentWidth - 2);
}

test.describe('Queues and History layout', () => {
  test('When a signed-out visitor opens Queues, the list uses the full content width.', async ({
    page,
  }, testInfo) => {
    await page.goto('/queues');
    await expect(page).toHaveURL(/\/queues$/);
    const heading = page
      .locator('[data-appearance="web"]')
      .getByRole('heading', { level: 1, name: 'Queues' });
    await expect(heading).toBeVisible();
    await expectListFillsContent(page);
    await capturePageLoad(
      page,
      testInfo,
      'A signed-out Queues visit fills the content width and asks the listener to log in.',
      page.getByText('Log in to use this feature.')
    );
  });

  test('When a signed-out visitor opens History, the list uses the full content width.', async ({
    page,
  }, testInfo) => {
    await page.goto('/history');
    await expect(page).toHaveURL(/\/history$/);
    const heading = page
      .locator('[data-appearance="web"]')
      .getByRole('heading', { level: 1, name: 'History' });
    await expect(heading).toBeVisible();
    await expectListFillsContent(page);
    await capturePageLoad(
      page,
      testInfo,
      'A signed-out History visit fills the content width and asks the listener to log in.',
      page.getByText('Log in to use this feature.')
    );
  });
});
