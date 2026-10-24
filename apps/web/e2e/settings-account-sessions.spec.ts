import type {
  APIRequestContext,
  APIResponse,
  Locator,
  Page,
  PlaywrightWorkerArgs,
} from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  E2E_API_BASE_URL,
  endOtherSessions,
  FIREFOX_WINDOWS_USER_AGENT,
  loginSessionsUser,
  loginSessionsUserMobile,
  newOtherDeviceRequest,
} from './helpers/accountSessions';
import { capturePageLoad } from './helpers/stepScreenshots';

type SignedInDevices = {
  firefox: APIRequestContext;
  phone: APIRequestContext;
  phoneAccessToken: string;
  list: Locator;
};

async function openSignedInDevices(
  page: Page,
  playwright: PlaywrightWorkerArgs['playwright']
): Promise<SignedInDevices> {
  await loginSessionsUser(page.request);
  await endOtherSessions(page.request);
  const firefox = await newOtherDeviceRequest(playwright, FIREFOX_WINDOWS_USER_AGENT);
  let phone: APIRequestContext | undefined;
  try {
    phone = await playwright.request.newContext();
    const phoneAccessToken = await loginSessionsUserMobile(phone, 'E2E Phone');
    await page.goto('/settings?tab=account');
    await expect(page).toHaveURL(/\/settings\?tab=account/);
    const list = page.getByRole('list', { name: 'Signed-In Devices' });
    await expect(page.getByRole('heading', { name: 'Signed-In Devices' })).toBeVisible();
    await expect(list).toBeVisible();
    return { firefox, phone, phoneAccessToken, list };
  } catch (error) {
    await firefox.dispose();
    if (phone !== undefined) {
      await phone.dispose();
    }
    throw error;
  }
}

async function disposeDevices(devices: SignedInDevices): Promise<void> {
  await devices.firefox.dispose();
  await devices.phone.dispose();
}

async function expectSessionEndedElsewhere(
  request: APIRequestContext,
  headers?: Record<string, string>
): Promise<void> {
  const response = await request.get(`${E2E_API_BASE_URL}/auth/me`, { headers });
  expect(response.status()).toBe(401);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    code: 'session_ended',
    notice: 'signed_out_elsewhere',
  });
}

async function expectSignedOutNavbar(page: Page): Promise<void> {
  const chrome = page.locator('[data-appearance="web"]');
  await chrome.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Logout' })).toHaveCount(0);
}

function phoneAuthHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

test.describe('Signed-in devices in account settings', () => {
  test('The Account tab lists every signed-in device with this browser first.', async ({
    page,
    playwright,
  }, testInfo) => {
    const devices = await openSignedInDevices(page, playwright);
    try {
      const items = devices.list.getByRole('listitem');
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText('This Device');
      const firefoxRow = items.filter({ hasText: 'Firefox · Windows' });
      await expect(firefoxRow).toHaveCount(1);
      await expect(firefoxRow).toContainText('Last Used');
      const phoneRow = items.filter({ hasText: 'E2E Phone' });
      await expect(phoneRow).toHaveCount(1);
      await expect(phoneRow).toContainText('Last Used');
      await capturePageLoad(
        page,
        testInfo,
        'The Account tab lists this browser first and every other signed-in device.',
        devices.list
      );
    } finally {
      await disposeDevices(devices);
    }
  });

  test('Signing out one other device ends only that session.', async ({ page, playwright }) => {
    const devices = await openSignedInDevices(page, playwright);
    try {
      await page.getByRole('button', { name: 'Sign Out Firefox · Windows' }).click();
      await expect(page.getByText('Device Signed Out', { exact: true })).toBeVisible();
      await expect(devices.list.getByRole('listitem')).toHaveCount(2);
      await expect(devices.list.getByText('Firefox · Windows')).toHaveCount(0);
      await expectSessionEndedElsewhere(devices.firefox);
      const phoneMe: APIResponse = await devices.phone.get(`${E2E_API_BASE_URL}/auth/me`, {
        headers: phoneAuthHeader(devices.phoneAccessToken),
      });
      expect(phoneMe.status()).toBe(200);
    } finally {
      await disposeDevices(devices);
    }
  });

  test('Sign Out of All Other Devices keeps only this browser.', async ({
    page,
    playwright,
  }, testInfo) => {
    const devices = await openSignedInDevices(page, playwright);
    try {
      await page.getByRole('button', { name: 'Sign Out of All Other Devices' }).click();
      const dialog = page.getByRole('dialog', { name: 'Sign Out of All Other Devices' });
      await expect(dialog).toBeVisible();
      await capturePageLoad(
        page,
        testInfo,
        'Sign Out of All Other Devices asks for confirmation.',
        dialog
      );
      await dialog.getByRole('button', { name: 'Sign Out', exact: true }).click();
      await expect(page.getByText('Other Devices Signed Out', { exact: true })).toBeVisible();
      await expect(devices.list.getByRole('listitem')).toHaveCount(1);
      await expect(devices.list.getByRole('listitem').first()).toContainText('This Device');
      await expect(page.getByRole('button', { name: 'Sign Out of All Other Devices' })).toHaveCount(
        0
      );
      await expectSessionEndedElsewhere(devices.firefox);
      await expectSessionEndedElsewhere(devices.phone, phoneAuthHeader(devices.phoneAccessToken));
    } finally {
      await disposeDevices(devices);
    }
  });

  test('Signing out this browser from the list signs it out with no notice.', async ({
    context,
    page,
    playwright,
  }) => {
    const devices = await openSignedInDevices(page, playwright);
    try {
      const thisDevice = devices.list.getByRole('listitem').filter({ hasText: 'This Device' });
      await thisDevice.getByRole('button', { name: /^Sign Out / }).click();
      // A signed-out visit to the account tab is replaced with the general settings page.
      await expect(page).toHaveURL(/\/settings\/?$/);
      await expectSignedOutNavbar(page);
      const jwtCookies = (await context.cookies()).filter((cookie) => cookie.name === 'jwt');
      expect(jwtCookies).toEqual([]);
      await expect(page.getByRole('dialog', { name: "You've Been Signed Out" })).toHaveCount(0);
    } finally {
      await disposeDevices(devices);
    }
  });
});
