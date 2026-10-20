import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getAddByRSSHashId } from '@podverse/helpers';

import {
  E2E_API_BASE_URL,
  loginSeedUser,
  stubAddByRSSParse,
  stubAddByRSSParseAll,
} from './helpers/addByRSSCredentials';
import {
  clearSeededPodcastQueueResources,
  expectMediaPlayerTitleAbsent,
  expectMediaPlayerTitleVisible,
  expectPersistentPlayerPlaying,
  waitForAudioReadyAtLeast,
} from './helpers/mediaPlayerAssertions';
import {
  E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL,
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
  E2E_ADDBYRSS_WITH_POSITION_ENCLOSURE_URL,
  E2E_PODCAST_QUEUE_ID_TEXT,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const PODCAST_QUEUE_URL = `${E2E_API_BASE_URL}/queue/${E2E_PODCAST_QUEUE_ID_TEXT}`;
const PHONE_POSITION_SECONDS = 30;
const EPISODE_GUID = 'e2e-cross-device-episode';
const PHONE_TITLE = 'E2E Phone Row Title';
const PARSED_TITLE = 'E2E Cross-Device Parsed Episode';

/**
 * The now-playing row the phone writes: feed URL, guid, enclosure, and title, under the phone's
 * own channel id and item id. There is no bundle, and this browser has never seen either id.
 */
const phoneResourceData: Record<string, unknown> = {
  feed_url: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
  channel_id_text: `phone${Date.now().toString(36)}`,
  guid: EPISODE_GUID,
  id_text: 'e2eXDevPhone01',
  title: PHONE_TITLE,
  enclosure_url: E2E_ADDBYRSS_WITH_POSITION_ENCLOSURE_URL,
  duration: E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
};

/** Partytime-shaped parse of the seeded test-assets feed, holding the phone's episode. */
const PARSED_FEED = {
  title: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
  link: 'http://localhost:2111/',
  description: 'E2E cross-device fixture',
  explicit: false,
  image: { url: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL },
  items: [
    {
      title: PARSED_TITLE,
      guid: EPISODE_GUID,
      duration: E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
      explicit: false,
      enclosure: {
        url: E2E_ADDBYRSS_WITH_POSITION_ENCLOSURE_URL,
        type: 'audio/mpeg',
        length: 0,
      },
      pubDate: '2025-07-02T11:21:52.000Z',
    },
  ],
};

async function postPhoneNowPlaying(page: Page): Promise<void> {
  const activate = await page.request.post(`${PODCAST_QUEUE_URL}/update-is-active`, {
    data: { is_active_queue: true },
  });
  expect(activate.ok(), await activate.text()).toBeTruthy();

  const nowPlaying = await page.request.post(`${PODCAST_QUEUE_URL}/item-add-by-rss/now-playing`, {
    data: {
      add_by_rss_resource_data: phoneResourceData,
      playback_position: PHONE_POSITION_SECONDS,
      media_file_duration: E2E_ADD_BY_RSS_ITEM_DURATION_SECONDS,
    },
  });
  expect(nowPlaying.ok(), await nowPlaying.text()).toBeTruthy();
}

function audioLocator(page: Page): Locator {
  return page.locator('audio').first();
}

async function readAudioCurrentTime(page: Page): Promise<number> {
  return audioLocator(page).evaluate((el) =>
    el instanceof HTMLAudioElement ? el.currentTime : Number.NaN
  );
}

function visiblePlayerButton(page: Page, name: 'Pause' | 'Play'): Locator {
  return page.locator(`aside#media-player button[aria-label="${name}"]:visible`).first();
}

function playerFeedArtwork(page: Page): Locator {
  return page.locator(`aside#media-player img[src="${E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL}"]`);
}

/**
 * The phone played an Add by RSS episode and recorded it as now-playing. Web, in a browser that
 * never parsed the feed, loads the episode at the phone's position from the row alone, then fills
 * in the title and artwork once its own parse of the feed finishes, without reloading the audio.
 */
test.describe('Add by RSS resume from another device', () => {
  test.beforeEach(async ({ page }) => {
    await loginSeedUser(page);
    await clearSeededPodcastQueueResources(page);
    await postPhoneNowPlaying(page);
  });

  test.afterEach(async ({ page }) => {
    await page.request.delete(
      `${PODCAST_QUEUE_URL}/item-add-by-rss/${getAddByRSSHashId(phoneResourceData)}`
    );
  });

  test('The phone episode loads at its position and its metadata fills in without restarting the audio', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    let releaseParse: () => void = () => undefined;
    const parseReleased = new Promise<void>((resolve) => {
      releaseParse = resolve;
    });
    const parse = await stubAddByRSSParse(page, {
      feedUrl: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
      outcomes: [{ status: 'parsed', payload: PARSED_FEED }],
      statusReleased: parseReleased,
    });
    await stubAddByRSSParseAll(page);

    await test.step('Home shows the phone episode in the mini player under the title from the row', async () => {
      await page.goto('/');
      await expectMediaPlayerTitleVisible(page, PHONE_TITLE, { timeout: 15_000 });
      await expect(audioLocator(page)).toHaveAttribute(
        'src',
        E2E_ADDBYRSS_WITH_POSITION_ENCLOSURE_URL,
        {
          timeout: 15_000,
        }
      );
      await expectPersistentPlayerPlaying(page, false);

      await capturePageLoad(
        page,
        testInfo,
        'The mini player holds the episode from the phone, paused, before this browser parsed its feed.',
        page.locator('aside#media-player')
      );
    });

    await test.step('Pressing play starts the audio near the position the phone saved', async () => {
      await waitForAudioReadyAtLeast(page, 1);
      await visiblePlayerButton(page, 'Play').click();
      await expectPersistentPlayerPlaying(page, true);
      await expect
        .poll(() => readAudioCurrentTime(page))
        .toBeGreaterThanOrEqual(PHONE_POSITION_SECONDS - 0.25);
      expect(await readAudioCurrentTime(page)).toBeLessThan(PHONE_POSITION_SECONDS + 5);
      await expect.poll(() => parse.enqueueBodies.length).toBeGreaterThan(0);
    });

    let timeBeforeUpgrade = 0;
    await test.step('The parse finishing changes the title and artwork, not the audio source or position', async () => {
      await audioLocator(page).evaluate((el) => {
        el.setAttribute('data-e2e-before-upgrade', 'true');
        el.addEventListener('loadstart', () => {
          el.setAttribute('data-e2e-reloaded', 'true');
        });
      });
      timeBeforeUpgrade = await readAudioCurrentTime(page);

      releaseParse();

      await expectMediaPlayerTitleVisible(page, PARSED_TITLE, { timeout: 15_000 });
      await expectMediaPlayerTitleAbsent(page, PHONE_TITLE);
      await expect(playerFeedArtwork(page).first()).toBeAttached();

      const audio = audioLocator(page);
      await expect(audio).toHaveAttribute('data-e2e-before-upgrade', 'true');
      await expect(audio).not.toHaveAttribute('data-e2e-reloaded', 'true');
      await expect(audio).toHaveAttribute('src', E2E_ADDBYRSS_WITH_POSITION_ENCLOSURE_URL);
      expect(await readAudioCurrentTime(page)).toBeGreaterThanOrEqual(timeBeforeUpgrade);
      await expectPersistentPlayerPlaying(page, true);

      await capturePageLoad(
        page,
        testInfo,
        'The player shows the parsed title and feed artwork while the same audio keeps playing.',
        page.locator('aside#media-player')
      );
    });
  });
});
