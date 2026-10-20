import { expect, test } from '@playwright/test';

import {
  loginSeedUser,
  stubAddByRSSParse,
  stubAddByRSSParseAll,
} from './helpers/addByRSSCredentials';
import {
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL,
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
  E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const EPISODE_TITLE = 'E2E Auto-Parse Episode';

/** Partytime-shaped feed the stubbed parse returns for the seeded test-assets follow. */
const PARSED_FEED = {
  title: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
  link: 'http://localhost:2111/',
  description: 'E2E auto-parse fixture',
  explicit: false,
  image: { url: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL },
  items: [
    {
      title: EPISODE_TITLE,
      guid: 'e2e-auto-parse-episode',
      duration: 61,
      explicit: false,
      enclosure: {
        url: 'http://localhost:2111/audio/audio-001.mp3',
        type: 'audio/mpeg',
        length: 0,
      },
      pubDate: '2025-07-02T11:21:52.000Z',
    },
  ],
};

/**
 * The seeded account follows the test-assets feed from another device: the follow row has the
 * feed's real title and artwork, and this browser has never parsed it. Web shows that name at
 * once, parses the feed without being asked, and refreshes followed feeds at most once per
 * interval.
 */
test.describe('Add by RSS parses on its own', () => {
  test('a feed followed elsewhere shows its name, parses itself, and refreshes once', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await loginSeedUser(page);

    let releaseStatus: () => void = () => undefined;
    const statusReleased = new Promise<void>((resolve) => {
      releaseStatus = resolve;
    });
    const parse = await stubAddByRSSParse(page, {
      feedUrl: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
      outcomes: [{ status: 'parsed', payload: PARSED_FEED }],
      statusReleased,
    });
    const parseAll = await stubAddByRSSParseAll(page);

    let feedPath = '';
    await test.step('The podcasts list names the followed feed by its title, not its URL', async () => {
      await page.goto('/add-by-rss/podcasts');
      const feedLink = page
        .locator('a[href*="/add-by-rss/podcast/"]')
        .filter({ hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE })
        .first();
      await expect(feedLink).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('a[href*="/add-by-rss/podcast/"]').filter({
          hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
        })
      ).toHaveCount(0);
      feedPath = new URL((await feedLink.getAttribute('href')) ?? '', page.url()).pathname;
      expect(feedPath).toMatch(/^\/add-by-rss\/podcast\/[^/]+$/);

      await capturePageLoad(
        page,
        testInfo,
        'The followed feed is listed under its real title before this browser has parsed it.',
        feedLink
      );
    });

    await test.step('Opening the feed page directly shows its title while the parse runs', async () => {
      await page.goto(feedPath);
      const heading = page.getByRole('heading', {
        name: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
        level: 1,
      });
      await expect(heading).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('add-by-rss-episodes-processing').first()).toBeVisible();
      await expect(page.getByText(EPISODE_TITLE)).toHaveCount(0);
      await expect.poll(() => parse.enqueueBodies.length).toBeGreaterThan(0);

      await capturePageLoad(
        page,
        testInfo,
        'The feed page shows the real title and a parsing status before any episode arrives.',
        heading
      );
    });

    await test.step('The episodes appear in place when the parse finishes, without pressing anything', async () => {
      releaseStatus();
      const episode = page.getByText(EPISODE_TITLE).first();
      await expect(episode).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('add-by-rss-episodes-processing')).toHaveCount(0);

      await capturePageLoad(
        page,
        testInfo,
        'The parsed episode is listed on the feed page without a reload or a button press.',
        episode
      );
    });

    await test.step('The background refresh sends one refresh-all, and a reload sends no second one', async () => {
      await page.goto('/');
      await expect.poll(() => parseAll.count(), { timeout: 15_000 }).toBe(1);

      await page.reload();
      await expect(page).toHaveURL('/');
      await page.waitForLoadState('load');
      // Proving that no request is sent needs a window: an unthrottled refresh would have synced
      // follows and sent its refresh-all within this time.
      await page.waitForTimeout(3_000);
      expect(parseAll.count()).toBe(1);

      await capturePageLoad(
        page,
        testInfo,
        'Home loads after the refresh; reloading within the interval does not refresh again.',
        page.locator('body')
      );
    });
  });
});
