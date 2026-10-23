import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import type { ApiKeyPermissions } from '@podverse/helpers';
import { API_KEY_RESOURCES, emptyApiKeyPermissions } from '@podverse/helpers';

import { capturePageLoad } from './helpers/stepScreenshots';

const API_BASE_URL = 'http://localhost:4030/api/v2';
const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const API_KEYS_URL = `${API_BASE_URL}/auth/api-keys`;
const LOGIN_PASSWORD = 'Test!1Aa';

/** Sync with tools/web/seed-e2e.mjs */
const E2E_API_KEYS_EMAIL = 'e2e-api-keys@example.com';
/** Sync with tools/web/seed-e2e.mjs */
const E2E_API_KEYS_EXPIRED_EMAIL = 'e2e-api-keys-expired@example.com';
/** Sync with tools/web/seed-e2e.mjs */
const E2E_API_KEYS_NONE_EMAIL = 'e2e-api-keys-none@example.com';

type ApiKeyListRow = {
  id_text: string;
  name: string;
};

type CreatedApiKey = {
  token: string;
};

function permissionsWithMask(mask: number): ApiKeyPermissions {
  const permissions = emptyApiKeyPermissions();
  for (const resource of API_KEY_RESOURCES) {
    permissions[resource] = mask;
  }
  return permissions;
}

function customPlaylistReadPermissions(): ApiKeyPermissions {
  const permissions = emptyApiKeyPermissions();
  permissions.playlists = 2;
  permissions.account = 1;
  return permissions;
}

function readApiKeyList(value: unknown): ApiKeyListRow[] {
  if (typeof value !== 'object' || value === null || !('rows' in value)) {
    throw new Error('API key list response has no rows array');
  }
  const rows = value.rows;
  if (!Array.isArray(rows)) {
    throw new Error('API key list response has no rows array');
  }
  return rows.map((row: unknown) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error('API key row is not an object');
    }
    if (!('id_text' in row) || typeof row.id_text !== 'string') {
      throw new Error('API key row is missing id_text');
    }
    if (!('name' in row) || typeof row.name !== 'string') {
      throw new Error('API key row is missing name');
    }
    return { id_text: row.id_text, name: row.name };
  });
}

function readCreatedToken(value: unknown): CreatedApiKey {
  if (typeof value !== 'object' || value === null || !('token' in value)) {
    throw new Error('API key create response is missing a token');
  }
  const token = value.token;
  if (typeof token !== 'string') {
    throw new Error('API key create response is missing a token');
  }
  if (token.length < 4) {
    throw new Error('API key create response token is shorter than the hint');
  }
  return { token };
}

async function expectOk(response: APIResponse, label: string): Promise<void> {
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
  }
}

async function openDeveloperTab(page: Page): Promise<void> {
  await page.goto('/settings?tab=developer');
  await expect(page).toHaveURL(/\/settings\?tab=developer/);
  await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
}

function watchApiKeyPosts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/auth/api-keys')) {
      urls.push(request.url());
    }
  });
  return urls;
}

async function login(page: Page, email: string): Promise<void> {
  const loginResponse = await page.request.post(LOGIN_URL, {
    data: { email, password: LOGIN_PASSWORD },
  });
  await expectOk(loginResponse, `POST /auth/login ${email}`);
}

async function deleteAllApiKeys(request: APIRequestContext): Promise<void> {
  const listResponse = await request.get(API_KEYS_URL);
  await expectOk(listResponse, 'GET /auth/api-keys');
  const body: unknown = await listResponse.json();
  for (const row of readApiKeyList(body)) {
    const deleteResponse = await request.delete(
      `${API_KEYS_URL}/${encodeURIComponent(row.id_text)}`
    );
    await expectOk(deleteResponse, `DELETE /auth/api-keys/${row.id_text}`);
  }
}

async function createApiKey(
  request: APIRequestContext,
  body: { name: string; expires_in_days: number | null; permissions: ApiKeyPermissions }
): Promise<CreatedApiKey> {
  const response = await request.post(API_KEYS_URL, { data: body });
  await expectOk(response, `POST /auth/api-keys ${body.name}`);
  const created: unknown = await response.json();
  return readCreatedToken(created);
}

test.describe('Developer settings', () => {
  test('When a signed-out visitor opens the Developer tab, they land on General and the Developer tab is absent.', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings?tab=developer');
    await expect(page).toHaveURL(/\/settings$/);
    const preferredMediaType = page.locator('#settings_preferred_media_type_selector');
    await expect(preferredMediaType).toBeVisible();
    await expect(page.getByRole('button', { name: 'Developer', exact: true })).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'A signed-out visitor lands on General settings instead of the Developer tab.',
      preferredMediaType
    );
  });

  test('When a signed-in member opens the Developer tab with no keys, they see the empty state and links to the API reference and the OpenAPI spec.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    await deleteAllApiKeys(page.request);

    await page.goto('/settings?tab=developer');
    await expect(page).toHaveURL(/\/settings\?tab=developer/);
    const heading = page.getByRole('heading', { name: 'API Keys' });
    await expect(heading).toBeVisible();
    await expect(page.getByText('You have no API keys.')).toBeVisible();
    const apiReference = page.getByRole('link', { name: 'API Reference' });
    const apiSpec = page.getByRole('link', { name: 'OpenAPI Spec' });
    await expect(apiReference).toHaveAttribute('href', `${API_BASE_URL}/docs`);
    await expect(apiReference).toHaveAttribute('target', '_blank');
    await expect(apiSpec).toHaveAttribute('href', `${API_BASE_URL}/docs.yaml`);
    await expect(apiSpec).toHaveAttribute('target', '_blank');
    await expect(page.getByText(/MCP/)).toHaveCount(0);
    await expect(page.getByText('Send it as an Authorization Bearer header.')).toBeVisible();

    await capturePageLoad(
      page,
      testInfo,
      'The Developer tab shows no keys and links to the API reference and the OpenAPI spec.',
      heading
    );
  });

  test('When a member has a read-only key and a full-access key, the Developer tab lists the newer key first with its hint, preset, and expiry.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      const readKey = await createApiKey(page.request, {
        name: 'Read Key',
        expires_in_days: 30,
        permissions: permissionsWithMask(2),
      });
      const fullKey = await createApiKey(page.request, {
        name: 'Full Key',
        expires_in_days: null,
        permissions: permissionsWithMask(15),
      });

      await page.goto('/settings?tab=developer');
      await expect(page).toHaveURL(/\/settings\?tab=developer/);
      const list = page.getByRole('list', { name: 'API Keys' });
      await expect(list).toBeVisible();
      const items = list.getByRole('listitem');
      await expect(items).toHaveCount(2);

      const fullKeyRow = items.nth(0);
      await expect(fullKeyRow).toContainText('Full Key');
      await expect(fullKeyRow).toContainText('Full Access');
      await expect(fullKeyRow).toContainText('No Expiration');
      await expect(fullKeyRow).toContainText('Never Used');
      await expect(fullKeyRow).toContainText(`pvk_…${fullKey.token.slice(-4)}`);

      const readKeyRow = items.nth(1);
      await expect(readKeyRow).toContainText('Read Key');
      await expect(readKeyRow).toContainText('Read Only');
      await expect(readKeyRow).toContainText('Expires');
      await expect(readKeyRow).toContainText('Never Used');
      await expect(readKeyRow).not.toContainText('No Expiration');
      await expect(readKeyRow).toContainText(`pvk_…${readKey.token.slice(-4)}`);

      await capturePageLoad(
        page,
        testInfo,
        'The Developer tab lists the full-access key before the read-only key.',
        list
      );
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When a member cancels revoke, the key stays, and confirming revoke removes it.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      await createApiKey(page.request, {
        name: 'Revoke Key',
        expires_in_days: 90,
        permissions: permissionsWithMask(2),
      });

      await page.goto('/settings?tab=developer');
      await expect(page).toHaveURL(/\/settings\?tab=developer/);
      const row = page.getByRole('listitem').filter({ hasText: 'Revoke Key' });
      await expect(row).toBeVisible();
      await capturePageLoad(
        page,
        testInfo,
        'The Developer tab lists the key that can be revoked.',
        row
      );

      const revokeButton = page.getByRole('button', { name: 'Revoke Revoke Key' });
      await revokeButton.click();
      const dialog = page.getByRole('dialog', { name: 'Revoke API Key' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row).toBeVisible();

      await revokeButton.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Revoke', exact: true }).click();
      await expect(page.getByText('API Key Revoked', { exact: true })).toBeVisible();
      await expect(row).toHaveCount(0);

      const listResponse = await page.request.get(API_KEYS_URL);
      await expectOk(listResponse, 'GET /auth/api-keys');
      const body: unknown = await listResponse.json();
      expect(readApiKeyList(body).some((apiKey) => apiKey.name === 'Revoke Key')).toBe(false);
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When a member whose membership has expired opens the Developer tab, they see the empty list.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EXPIRED_EMAIL);

    await page.goto('/settings?tab=developer');
    await expect(page).toHaveURL(/\/settings\?tab=developer/);
    const heading = page.getByRole('heading', { name: 'API Keys' });
    await expect(heading).toBeVisible();
    await expect(page.getByText('You have no API keys.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Developer', exact: true })).toBeVisible();

    await capturePageLoad(
      page,
      testInfo,
      'An expired membership can open the Developer tab and see the empty key list.',
      heading
    );
  });

  test('When a member has a custom key, the row names the supported playlist read permission and omits unsupported account access.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      await createApiKey(page.request, {
        name: 'Custom Key',
        expires_in_days: 90,
        permissions: customPlaylistReadPermissions(),
      });

      await page.goto('/settings?tab=developer');
      await expect(page).toHaveURL(/\/settings\?tab=developer/);
      const row = page.getByRole('listitem').filter({ hasText: 'Custom Key' });
      await expect(row).toBeVisible();
      await expect(row).toContainText('Playlists Read');
      await expect(row).not.toContainText('Account');
      await expect(row).not.toContainText('Full Access');
      await expect(row).not.toContainText('Read Only');

      await capturePageLoad(
        page,
        testInfo,
        'A custom key row names Playlists Read and omits unsupported account access.',
        row
      );
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When a member opens Create API Key, the form starts on Read Only and 90 days, unsupported cells are dashes, and Cancel leaves the empty list.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      await deleteAllApiKeys(page.request);
      await openDeveloperTab(page);
      await expect(page.getByText('You have no API keys.')).toBeVisible();

      await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create API Key' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Expiration 90 Days' })).toBeVisible();
      await expect(dialog.getByRole('radio', { name: 'Read Only' })).toBeChecked();

      const account = dialog.getByRole('group', { name: 'Account' });
      await expect(account.getByRole('checkbox', { name: 'Read' })).toBeChecked();
      await expect(account.getByRole('checkbox', { name: 'Create' })).toHaveCount(0);
      await expect(
        account.getByRole('img', { name: 'Account Create is not available.' })
      ).toBeVisible();

      const settings = dialog.getByRole('group', { name: 'Settings' });
      await expect(settings.getByRole('checkbox', { name: 'Read' })).toHaveCount(0);
      await expect(
        settings.getByRole('img', { name: 'Settings Read is not available.' })
      ).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'The create API key dialog opens on Read Only, 90 days, and dashes for unsupported cells.',
        dialog
      );

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('You have no API keys.')).toBeVisible();
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When a member submits an empty name or clears every Read checkbox, the form stays open, and a preset fills the checkboxes again.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      await deleteAllApiKeys(page.request);
      await openDeveloperTab(page);
      await expect(page.getByText('You have no API keys.')).toBeVisible();

      await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create API Key' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Create API Key', exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Enter a name.')).toBeVisible();

      await dialog.getByRole('textbox', { name: 'Name' }).fill('Agent Key');
      const readCheckboxes = dialog.getByRole('checkbox', { name: 'Read' });
      const readCount = await readCheckboxes.count();
      for (let index = 0; index < readCount; index += 1) {
        await readCheckboxes.nth(index).uncheck();
      }
      await dialog.getByRole('button', { name: 'Create API Key', exact: true }).click();
      await expect(dialog.getByText('Grant at least one permission.')).toBeVisible();

      await dialog.getByRole('radio', { name: 'Full Access' }).click();
      const account = dialog.getByRole('group', { name: 'Account' });
      await expect(account.getByRole('checkbox', { name: 'Update' })).toBeChecked();
      await expect(account.getByRole('checkbox', { name: 'Create' })).toHaveCount(0);

      await dialog.getByRole('radio', { name: 'Read Only' }).click();
      await expect(account.getByRole('checkbox', { name: 'Read' })).toBeChecked();
      await expect(account.getByRole('checkbox', { name: 'Update' })).not.toBeChecked();

      await capturePageLoad(
        page,
        testInfo,
        'Choosing Read Only checks Account Read and leaves Account Update unchecked.',
        dialog
      );
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When a member creates a key with no expiration, the token is shown once and the new row appears without the token.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EMAIL);
    try {
      await deleteAllApiKeys(page.request);
      await openDeveloperTab(page);
      await expect(page.getByText('You have no API keys.')).toBeVisible();

      await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create API Key' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Name' }).fill('Agent Key');
      await dialog.getByRole('button', { name: 'Expiration 90 Days' }).click();
      await dialog.getByRole('menu').getByRole('menuitem', { name: 'No Expiration' }).click();
      await expect(dialog.getByRole('button', { name: 'Expiration No Expiration' })).toBeVisible();

      await dialog.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const createdDialog = page.getByRole('dialog', { name: 'API Key Created' });
      await expect(createdDialog).toBeVisible();
      await expect(
        createdDialog.getByText('This key is shown once. Copy it now. You will not see it again.')
      ).toBeVisible();
      await expect(createdDialog.getByRole('button', { name: 'Copy' })).toBeVisible();
      const tokenField = createdDialog.getByRole('textbox', { name: 'API Key' });
      await expect(tokenField).toHaveValue(/^pvk_[A-Za-z0-9_-]{43}$/);
      const token = await tokenField.inputValue();

      await capturePageLoad(
        page,
        testInfo,
        'The created API key dialog shows the token once with a copy control.',
        createdDialog
      );

      await createdDialog.getByRole('button', { name: 'Done' }).click();
      await expect(createdDialog).toHaveCount(0);
      const row = page.getByRole('listitem').filter({ hasText: 'Agent Key' });
      await expect(row).toBeVisible();
      await expect(row).toContainText('Read Only');
      await expect(row).toContainText('No Expiration');
      await expect(page.getByText(token)).toHaveCount(0);
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When an expired member clicks Create API Key, no key is posted and the dialog keeps the expired membership copy.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_EXPIRED_EMAIL);
    try {
      await deleteAllApiKeys(page.request);
      const apiKeyPosts = watchApiKeyPosts(page);
      await openDeveloperTab(page);

      await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const loginDialog = page.getByRole('dialog', { name: 'Login Required' });
      await expect(loginDialog).toBeVisible();
      await expect(loginDialog).toContainText('Your membership has expired.');
      await expect(loginDialog.getByRole('button', { name: 'Buy Membership' })).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Create API Key' })).toHaveCount(0);
      await expect(page.getByText('API Keys Require a Membership')).toHaveCount(0);
      expect(apiKeyPosts).toEqual([]);

      await capturePageLoad(
        page,
        testInfo,
        'An expired membership sees the existing expired copy and Buy Membership.',
        loginDialog
      );
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });

  test('When an account that never had a membership clicks Create API Key, no key is posted and the dialog says API Keys Require a Membership.', async ({
    page,
  }, testInfo) => {
    await login(page, E2E_API_KEYS_NONE_EMAIL);
    try {
      await deleteAllApiKeys(page.request);
      const apiKeyPosts = watchApiKeyPosts(page);
      await openDeveloperTab(page);

      await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
      const membershipDialog = page.getByRole('dialog', { name: 'API Keys Require a Membership' });
      await expect(membershipDialog).toBeVisible();
      await expect(membershipDialog).toContainText('Buy a membership to create an API key.');
      await expect(membershipDialog.getByRole('button', { name: 'Buy Membership' })).toBeVisible();
      await expect(membershipDialog).not.toContainText('Your membership has expired.');
      await expect(page.getByRole('dialog', { name: 'Create API Key' })).toHaveCount(0);
      expect(apiKeyPosts).toEqual([]);

      await capturePageLoad(
        page,
        testInfo,
        'An account that never had a membership sees API Keys Require a Membership and Buy Membership.',
        membershipDialog
      );
    } finally {
      await deleteAllApiKeys(page.request);
    }
  });
});
