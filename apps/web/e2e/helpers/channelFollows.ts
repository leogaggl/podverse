import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { E2E_API_BASE_URL } from './addByRSSCredentials';

export async function followChannelOnServer(page: Page, channelIdText: string): Promise<void> {
  const response = await page.request.post(`${E2E_API_BASE_URL}/account/follow/channel`, {
    data: { channel_id_text: channelIdText },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Best-effort cleanup. */
export async function unfollowChannelOnServer(page: Page, channelIdText: string): Promise<void> {
  await page.request.post(`${E2E_API_BASE_URL}/account/unfollow/channel`, {
    data: { channel_id_text: channelIdText },
  });
}
