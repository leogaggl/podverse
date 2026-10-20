import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getAddByRSSHashId } from '@podverse/helpers';

import { E2E_API_BASE_URL, loginSeedUser } from './helpers/addByRSSCredentials';
import {
  clearSeededPodcastQueueResources,
  expectMediaPlayerTitleVisible,
  expectPersistentPlayerPlaying,
} from './helpers/mediaPlayerAssertions';
import {
  E2E_ADD_BY_RSS_CHANNEL_ID_TEXT,
  E2E_ADD_BY_RSS_CHANNEL_IMAGE_URL,
  E2E_ADD_BY_RSS_CHANNEL_TITLE,
  E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
  E2E_ADD_BY_RSS_ITEM_IMAGE_URL,
  E2E_ADD_BY_RSS_PUB_DATE_ISO,
  E2E_ADDBYRSS_FRESH_ENCLOSURE_URL,
  E2E_PODCAST_ITEM_RESUME_DURATION_SECONDS,
  E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT,
  E2E_PODCAST_QUEUE_ID_TEXT,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const DIRECTORY_ITEM_TITLE = 'E2E Podcast No Stored Position';
const ADD_BY_RSS_ID_TEXT = 'e2eAbRsResN01';
const ADD_BY_RSS_GUID = 'https://e2e-seed-addbyrss.example/item-guid/no-medium';
const ADD_BY_RSS_TITLE = 'E2E Add-by-RSS Without Medium';

/**
 * The feed carries no `podcast:medium`, so the resource data has no `medium_id`. The bundle lets
 * the queue row rebuild the episode without a local parse of the feed.
 */
const addByRSSResourceData: Record<string, unknown> = {
  channel_id_text: E2E_ADD_BY_RSS_CHANNEL_ID_TEXT,
  guid: ADD_BY_RSS_GUID,
  title: ADD_BY_RSS_TITLE,
  pub_date: E2E_ADD_BY_RSS_PUB_DATE_ISO,
  id_text: ADD_BY_RSS_ID_TEXT,
  channel_title: E2E_ADD_BY_RSS_CHANNEL_TITLE,
  channel_images: [{ url: E2E_ADD_BY_RSS_CHANNEL_IMAGE_URL, image_width_size: null }],
  item_images: [{ url: E2E_ADD_BY_RSS_ITEM_IMAGE_URL, image_width_size: 1400 }],
  enclosure_url: E2E_ADDBYRSS_FRESH_ENCLOSURE_URL,
  duration: E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
  bundle: {
    item: { title: ADD_BY_RSS_TITLE, guid: ADD_BY_RSS_GUID },
    about: { duration: E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS },
    images: [{ url: E2E_ADD_BY_RSS_ITEM_IMAGE_URL, image_width_size: 1400 }],
    description: { value: `${ADD_BY_RSS_TITLE} deterministic E2E add-by-RSS fixture.` },
    enclosures: [
      {
        item_enclosure: {
          type: 'audio/mpeg',
          length: 0,
          bitrate: 24,
          item_enclosure_default: true,
        },
        item_enclosure_integrity: null,
        item_enclosure_sources: [
          { uri: E2E_ADDBYRSS_FRESH_ENCLOSURE_URL, content_type: 'audio/mpeg' },
        ],
      },
    ],
  },
};

const PODCAST_QUEUE_URL = `${E2E_API_BASE_URL}/queue/${E2E_PODCAST_QUEUE_ID_TEXT}`;

async function preparePodcastQueue(page: Page): Promise<void> {
  const activate = await page.request.post(`${PODCAST_QUEUE_URL}/update-is-active`, {
    data: { is_active_queue: true },
  });
  expect(activate.ok(), await activate.text()).toBeTruthy();

  const nowPlaying = await page.request.post(
    `${PODCAST_QUEUE_URL}/item/${E2E_PODCAST_ITEM_RESUME_NONE_ID_TEXT}/now-playing`,
    {
      data: {
        playback_position: 0,
        media_file_duration: E2E_PODCAST_ITEM_RESUME_DURATION_SECONDS,
      },
    }
  );
  expect(nowPlaying.ok(), await nowPlaying.text()).toBeTruthy();

  const addLast = await page.request.post(`${PODCAST_QUEUE_URL}/item-add-by-rss/last`, {
    data: { add_by_rss_resource_data: addByRSSResourceData },
  });
  expect(addLast.ok(), await addLast.text()).toBeTruthy();
}

async function readServerNowPlayingAddByRSSIdText(page: Page): Promise<string | null> {
  const response = await page.request.get(`${PODCAST_QUEUE_URL}/resources/now-playing`);
  if (!response.ok()) {
    return null;
  }
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('add_by_rss_resource_data' in body)) {
    return null;
  }
  const resourceData = body.add_by_rss_resource_data;
  if (typeof resourceData !== 'object' || resourceData === null || !('id_text' in resourceData)) {
    return null;
  }
  return typeof resourceData.id_text === 'string' ? resourceData.id_text : null;
}

function visiblePlayerButton(page: Page, name: 'Pause' | 'Play'): Locator {
  return page.locator(`aside#media-player button[aria-label="${name}"]:visible`).first();
}

async function expectPlayerKeepsAddByRSSEpisode(page: Page): Promise<void> {
  await expectMediaPlayerTitleVisible(page, ADD_BY_RSS_TITLE);
  await expect(page.locator('aside#media-player').getByText(DIRECTORY_ITEM_TITLE)).toHaveCount(0);
  await expect(page.locator('audio').first()).toHaveAttribute(
    'src',
    E2E_ADDBYRSS_FRESH_ENCLOSURE_URL
  );
}

/**
 * The player adopts the server's now-playing directory episode on load. Playing an Add by RSS
 * episode from the queue must keep that episode in the player through play state changes and the
 * queue refresh, and record it as now-playing so a reload restores it.
 */
test.describe('Add by RSS playback keeps its item', () => {
  test.beforeEach(async ({ page }) => {
    await loginSeedUser(page);
    await clearSeededPodcastQueueResources(page);
    await preparePodcastQueue(page);
  });

  test.afterEach(async ({ page }) => {
    await page.request.delete(
      `${PODCAST_QUEUE_URL}/item-add-by-rss/${getAddByRSSHashId(addByRSSResourceData)}`
    );
  });

  test('An Add by RSS episode played from the queue stays in the player and is restored after a reload', async ({
    page,
  }, testInfo) => {
    await test.step('The home page player adopts the now-playing directory episode', async () => {
      await page.goto('/');
      await expectMediaPlayerTitleVisible(page, DIRECTORY_ITEM_TITLE);
    });

    await test.step('Playing the Add by RSS episode from the queue loads it into the player', async () => {
      await page.goto('/queues?medium=av');
      await expectMediaPlayerTitleVisible(page, DIRECTORY_ITEM_TITLE);
      await page.locator('main').getByRole('button', { name: ADD_BY_RSS_TITLE }).first().click();
      await expectPlayerKeepsAddByRSSEpisode(page);
      await expectPersistentPlayerPlaying(page, true);
    });

    await test.step('Pausing and playing again keeps the Add by RSS episode in the player', async () => {
      await visiblePlayerButton(page, 'Pause').click();
      await expectPersistentPlayerPlaying(page, false);
      await expectPlayerKeepsAddByRSSEpisode(page);

      await visiblePlayerButton(page, 'Play').click();
      await expectPersistentPlayerPlaying(page, true);
      await expectPlayerKeepsAddByRSSEpisode(page);
    });

    await test.step('After the server records the episode as now-playing, the player still holds it', async () => {
      await expect.poll(() => readServerNowPlayingAddByRSSIdText(page)).toBe(ADD_BY_RSS_ID_TEXT);
      await expectPlayerKeepsAddByRSSEpisode(page);

      await capturePageLoad(
        page,
        testInfo,
        'The player keeps the Add by RSS episode after the queue refresh.',
        page.locator('aside#media-player')
      );
    });

    await test.step('A reload restores the Add by RSS episode as now-playing', async () => {
      await page.reload();
      await expectMediaPlayerTitleVisible(page, ADD_BY_RSS_TITLE);
    });
  });
});
