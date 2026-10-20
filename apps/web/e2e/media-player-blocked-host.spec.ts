import type { Page } from '@playwright/test';
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
  expectMediaPlayerTitleVisible,
  expectPersistentPlayerPlaying,
} from './helpers/mediaPlayerAssertions';
import { E2E_PODCAST_QUEUE_ID_TEXT } from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const PODCAST_QUEUE_URL = `${E2E_API_BASE_URL}/queue/${E2E_PODCAST_QUEUE_ID_TEXT}`;
const ASSET_ORIGIN = 'http://localhost:2111';
const ART_PATH = 'e2e/images/e2e-embed-item-art-1400.png';
const AUDIO_PATH = 'e2e/audio/e2e-podcast-resume-60s-440hz.mp3';
const FEED_URL = 'http://localhost:2111/e2e/feeds/blocked-host.xml';
const EPISODE_TITLE = 'E2E Blocked Host Episode';

const hopUrl = (prefix: string, assetPath: string): string =>
  `${ASSET_ORIGIN}/${prefix}/${assetPath}`;

let postedResource: Record<string, unknown> | null = null;

const resourceFor = (prefix: string): Record<string, unknown> => {
  const art = hopUrl(prefix, ART_PATH);
  return {
    feed_url: FEED_URL,
    channel_id_text: 'e2eBlkHostCh01',
    guid: `e2e-blocked-host-${prefix}`,
    id_text: 'e2eBlkHost01',
    title: EPISODE_TITLE,
    enclosure_url: hopUrl(prefix, AUDIO_PATH),
    channel_image_url: art,
    channel_images: [{ url: art, image_width_size: 1400, is_resized: false }],
    item_images: [{ url: art, image_width_size: 1400, is_resized: false }],
    duration: 60,
    medium_id: 2,
  };
};

async function postNowPlaying(page: Page, resource: Record<string, unknown>): Promise<void> {
  postedResource = resource;
  const art =
    typeof resource['channel_image_url'] === 'string' ? resource['channel_image_url'] : '';
  const enclosure = typeof resource['enclosure_url'] === 'string' ? resource['enclosure_url'] : '';
  const guid = typeof resource['guid'] === 'string' ? resource['guid'] : '';
  await stubAddByRSSParse(page, {
    feedUrl: FEED_URL,
    outcomes: [
      {
        status: 'parsed',
        payload: {
          title: 'E2E Blocked Host',
          items: [
            {
              title: EPISODE_TITLE,
              guid,
              enclosure: { url: enclosure, type: 'audio/mpeg', length: 0 },
              image: art,
            },
          ],
        },
      },
    ],
  });
  await stubAddByRSSParseAll(page);

  const activate = await page.request.post(`${PODCAST_QUEUE_URL}/update-is-active`, {
    data: { is_active_queue: true },
  });
  expect(activate.ok(), await activate.text()).toBeTruthy();

  const nowPlaying = await page.request.post(`${PODCAST_QUEUE_URL}/item-add-by-rss/now-playing`, {
    data: {
      add_by_rss_resource_data: resource,
      playback_position: 0,
      media_file_duration: 60,
    },
  });
  expect(nowPlaying.ok(), await nowPlaying.text()).toBeTruthy();
}

async function artworkUsesFinalFile(page: Page): Promise<boolean> {
  return page.locator('aside#media-player img[alt="Media Player Image"]').evaluateAll((nodes) =>
    nodes.some((node) => {
      if (!(node instanceof HTMLImageElement)) {
        return false;
      }
      const src = node.currentSrc || node.getAttribute('src') || '';
      return (
        node.naturalWidth > 0 &&
        src.includes('e2e-embed-item-art-1400.png') &&
        !src.includes('redirect/corp-hop')
      );
    })
  );
}

/**
 * A redirect answers with a policy that blocks websites, while the file it points at does not.
 * The player asks for the final address and loads that file itself.
 */
test.describe('Media behind a blocking redirect', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginSeedUser(page);
    await clearSeededPodcastQueueResources(page);
  });

  test.afterEach(async ({ page }) => {
    if (postedResource === null) {
      return;
    }
    await page.request.delete(
      `${PODCAST_QUEUE_URL}/item-add-by-rss/${getAddByRSSHashId(postedResource)}`
    );
    postedResource = null;
  });

  test('Artwork and audio load from the final file when only the redirect blocks websites', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await postNowPlaying(page, resourceFor('redirect/corp-hop'));

    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expectMediaPlayerTitleVisible(page, EPISODE_TITLE, { timeout: 15_000 });

    await expect.poll(() => artworkUsesFinalFile(page), { timeout: 20_000 }).toBe(true);
    await capturePageLoad(
      page,
      testInfo,
      'The mini player shows artwork from the file after the blocking redirect.',
      page.locator('aside#media-player img[alt="Media Player Image"]').first()
    );

    await page.locator('aside#media-player button[aria-label="Play"]:visible').first().click();
    await expectPersistentPlayerPlaying(page, true);

    const audio = page.locator('audio').first();
    await expect
      .poll(
        async () => {
          const src = (await audio.getAttribute('src')) ?? '';
          const time = await audio.evaluate((element) =>
            element instanceof HTMLAudioElement ? element.currentTime : 0
          );
          return (
            src.includes('e2e-podcast-resume-60s-440hz.mp3') &&
            !src.includes('redirect/corp-hop') &&
            time > 0.2
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);
  });

  test('The player explains the failure when the final file also blocks websites', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await postNowPlaying(page, resourceFor('redirect/corp-final'));

    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expectMediaPlayerTitleVisible(page, EPISODE_TITLE, { timeout: 15_000 });

    const playButton = page.locator('aside#media-player button[aria-label="Play"]:visible').first();
    const errorButton = page.getByRole('button', { name: 'Playback Error' }).first();
    await expect(errorButton.or(playButton)).toBeVisible({ timeout: 15_000 });
    if (await playButton.isVisible()) {
      await playButton.click();
    }

    await expect(errorButton).toBeVisible({ timeout: 15_000 });
    await errorButton.click();
    const dialog = page.getByRole('dialog', { name: 'Playback Error' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/does not allow playback on websites/)).toBeVisible();
    await capturePageLoad(
      page,
      testInfo,
      'The player explains that the final host does not allow playback on websites.',
      dialog
    );
  });
});
