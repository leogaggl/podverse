import { expect, test } from '@playwright/test';

import { capturePageLoad } from './helpers/stepScreenshots';

test.describe('Settings: keyboard shortcuts', () => {
  test('The Keyboard tab lists play, seek, and volume instructions.', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings?tab=keyboard');
    await expect(page).toHaveURL(/\/settings\?tab=keyboard/);

    const play = page.getByRole('heading', { name: 'Play or Pause' });
    await expect(play).toBeVisible();
    await expect(page.getByText('Space', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Seek Backward or Forward 10 Seconds' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Volume (when the volume slider is focused)' })
    ).toBeVisible();

    await capturePageLoad(
      page,
      testInfo,
      'The Keyboard settings tab shows play, seek, and volume shortcut instructions.',
      play
    );
  });
});
