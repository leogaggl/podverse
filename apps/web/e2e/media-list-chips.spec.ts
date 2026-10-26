import type { Locator, Page } from '@playwright/test';
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
  E2E_DIRECTORY_ARTIST_TITLE,
  E2E_LIVE_AV_AUDIO_ITEM_TITLE,
  E2E_LIVE_AV_SCHEDULED_ITEM_TITLE,
  E2E_LIVESTREAM_ITEM_TITLE,
  E2E_PODCAST_CHANNEL_ID_TEXT,
  E2E_PODCAST_CHANNEL_TITLE,
} from './helpers/seedConstants';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const EPISODE_TITLE = 'E2E Chips Add by RSS Episode';
const E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE = 'E2E Chips Add by RSS Livestream';
const E2E_CHIPS_ADD_BY_RSS_SCHEDULED_TITLE = 'E2E Chips Add by RSS Scheduled';
const E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE = 'E2E Chips Add by RSS Ended Recent';
const E2E_CHIPS_ADD_BY_RSS_ENDED_OLD_TITLE = 'E2E Chips Add by RSS Ended Old';

const E2E_CHIPS_MINUTE_MS = 60 * 1000;
const E2E_CHIPS_HOUR_MS = 60 * E2E_CHIPS_MINUTE_MS;
const E2E_CHIPS_DAY_MS = 24 * E2E_CHIPS_HOUR_MS;
const E2E_CHIPS_NOW_MS = Date.now();

const e2eChipsIsoBeforeNow = (deltaMs: number): string =>
  new Date(E2E_CHIPS_NOW_MS - deltaMs).toISOString();

const E2E_CHIPS_ADD_BY_RSS_LIVE_ENCLOSURE = {
  url: 'http://localhost:2111/audio/audio-001.mp3',
  type: 'audio/mpeg',
  length: 0,
};

const BROWSE_CHIP_LABELS = [
  'Podcasts',
  'Episodes',
  'Clips',
  'Artists',
  'Albums',
  'Tracks',
  'Livestreams',
  'Playlists',
  'Users',
] as const;

const SUBSCRIBED_CHIP_LABELS = [
  'Podcasts',
  'Episodes',
  'Clips',
  'Artists',
  'Albums',
  'Tracks',
  'Livestreams',
] as const;

const ADD_BY_RSS_CHIP_LABELS = [
  'Podcasts',
  'Episodes',
  'Artists',
  'Albums',
  'Tracks',
  'Livestreams',
] as const;

/** List routes the chips pages replace. A podcast detail URL is not in this list. */
const REMOVED_LIST_PATHS = [
  '/podcasts',
  '/episodes',
  '/clips',
  '/artists',
  '/albums',
  '/tracks',
  '/podcasts/livestreams',
  '/music/livestreams',
  '/add-by-rss/podcasts',
  '/add-by-rss/livestreams',
] as const;

/** Partytime-shaped feed the stubbed parse returns for the seeded test-assets follow. */
const PARSED_FEED = {
  title: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
  link: 'http://localhost:2111/',
  description: 'E2E chips fixture',
  explicit: false,
  image: { url: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_IMAGE_URL },
  items: [
    {
      title: EPISODE_TITLE,
      guid: 'e2e-chips-add-by-rss-episode',
      duration: 61,
      explicit: false,
      enclosure: {
        url: 'http://localhost:2111/audio/audio-001.mp3',
        type: 'audio/mpeg',
        length: 0,
      },
      pubDate: '2025-04-08T15:00:00.000Z',
    },
  ],
  podcastLiveItems: [
    {
      title: E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE,
      guid: 'e2e-chips-add-by-rss-live',
      status: 'live',
      start: e2eChipsIsoBeforeNow(2 * E2E_CHIPS_HOUR_MS),
      enclosure: E2E_CHIPS_ADD_BY_RSS_LIVE_ENCLOSURE,
    },
    {
      title: E2E_CHIPS_ADD_BY_RSS_SCHEDULED_TITLE,
      guid: 'e2e-chips-add-by-rss-scheduled',
      status: 'pending',
      start: e2eChipsIsoBeforeNow(30 * E2E_CHIPS_MINUTE_MS),
      enclosure: E2E_CHIPS_ADD_BY_RSS_LIVE_ENCLOSURE,
    },
    {
      title: E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE,
      guid: 'e2e-chips-add-by-rss-ended-recent',
      status: 'ended',
      start: e2eChipsIsoBeforeNow(10 * E2E_CHIPS_MINUTE_MS),
      end: e2eChipsIsoBeforeNow(5 * E2E_CHIPS_MINUTE_MS),
      enclosure: E2E_CHIPS_ADD_BY_RSS_LIVE_ENCLOSURE,
    },
    {
      title: E2E_CHIPS_ADD_BY_RSS_ENDED_OLD_TITLE,
      guid: 'e2e-chips-add-by-rss-ended-old',
      status: 'ended',
      start: e2eChipsIsoBeforeNow(3 * E2E_CHIPS_DAY_MS),
      end: e2eChipsIsoBeforeNow(2 * E2E_CHIPS_DAY_MS),
      enclosure: E2E_CHIPS_ADD_BY_RSS_LIVE_ENCLOSURE,
    },
  ],
};

const chipRow = (page: Page) => page.getByTestId('media-list-chips-items');

const chipButton = (page: Page, name: string) =>
  chipRow(page).getByRole('button', { name, exact: true });

const chipTrailing = (page: Page) => page.getByTestId('media-list-chips-trailing');

const sortChip = (page: Page) => chipTrailing(page).getByRole('button', { name: /^Sort: / });

const categoryChip = (page: Page) => chipTrailing(page).getByTestId('media-list-category-chip');

const layoutChip = (page: Page) =>
  chipTrailing(page).getByRole('button', { name: 'Change Layout View', exact: true });

const expectAppPath = async (page: Page, path: string): Promise<void> => {
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === path);
};

const expectChipOrder = async (page: Page, labels: readonly string[]): Promise<void> => {
  await expect(chipRow(page).getByRole('button')).toHaveText([...labels]);
};

const expectPressedChip = async (page: Page, name: string): Promise<void> => {
  await expect(chipButton(page, name)).toHaveAttribute('aria-pressed', 'true');
};

const liveItemRow = (page: Page, title: string): Locator =>
  page.getByTestId('list-live-item-row').filter({ hasText: title });

const addByRssLivestreamRow = (page: Page, title: string): Locator =>
  page.getByTestId('add-by-rss-livestream-row').filter({ hasText: title });

const rowTop = async (row: Locator): Promise<number> => {
  const box = await row.boundingBox();
  expect(box, 'livestream row is in the layout').not.toBeNull();
  if (box === null) {
    return 0;
  }
  return box.y;
};

const expectStatusLeftOfDate = async (row: Locator, statusLabel: string): Promise<void> => {
  const date = row.getByTestId('live-item-row-date');
  const status = row.getByTestId('live-item-row-status');
  await expect(date).toBeVisible();
  await expect(status.getByText(statusLabel, { exact: true })).toBeVisible();
  const dateBox = await date.boundingBox();
  const statusBox = await status.boundingBox();
  expect(dateBox, 'date line is in the layout').not.toBeNull();
  expect(statusBox, 'status slot is in the layout').not.toBeNull();
  if (dateBox === null || statusBox === null) {
    return;
  }
  expect(dateBox.x).toBeGreaterThanOrEqual(statusBox.x + statusBox.width - 1);
  const statusCenterY = statusBox.y + statusBox.height / 2;
  expect(statusCenterY).toBeGreaterThan(dateBox.y);
  expect(statusCenterY).toBeLessThan(dateBox.y + dateBox.height);
};

test.describe('Subscribed, Browse, and Add by RSS chips pages', () => {
  test('Browse chips keep the chosen chip in the URL and in this browser', async ({
    page,
  }, testInfo) => {
    await test.step('Browse opens on Podcasts with nine chips and no tab in the URL', async () => {
      await page.goto('/browse');
      await expectAppPath(page, '/browse');
      await expect(page.getByRole('heading', { name: 'Browse', exact: true })).toBeVisible();
      await expectChipOrder(page, BROWSE_CHIP_LABELS);
      await expectPressedChip(page, 'Podcasts');

      await capturePageLoad(
        page,
        testInfo,
        'Browse opens with Podcasts pressed and no tab query.',
        chipButton(page, 'Podcasts')
      );
    });

    await test.step('Clicking Artists puts artists in the URL and shows the directory artist', async () => {
      await chipButton(page, 'Artists').click();
      await expectAppPath(page, '/browse?tab=artists');
      await expectPressedChip(page, 'Artists');
      const artistTitle = page.getByRole('heading', {
        name: E2E_DIRECTORY_ARTIST_TITLE,
        level: 3,
      });
      await expect(artistTitle).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'The Artists chip is pressed and the directory artist is listed.',
        artistTitle
      );
    });

    await test.step('Reloading keeps Artists, and a plain Browse URL restores the stored chip', async () => {
      await page.reload();
      await expectAppPath(page, '/browse?tab=artists');
      await expectPressedChip(page, 'Artists');

      await page.goto('/browse');
      await expectAppPath(page, '/browse');
      await expectPressedChip(page, 'Artists');

      await capturePageLoad(
        page,
        testInfo,
        'Opening Browse with no query restores the stored Artists chip.',
        chipButton(page, 'Artists')
      );
    });

    await test.step('Clicking Podcasts returns to Browse with no tab', async () => {
      await chipButton(page, 'Podcasts').click();
      await expectAppPath(page, '/browse');
      await expectPressedChip(page, 'Podcasts');

      await capturePageLoad(
        page,
        testInfo,
        'Podcasts is pressed again and the URL has no tab.',
        chipButton(page, 'Podcasts')
      );
    });
  });

  test('Browse Playlists and Users chips show public lists without type tabs', async ({
    page,
  }, testInfo) => {
    await test.step('Playlists is pressed and the page has no Create Playlist button or My Playlists tab', async () => {
      await page.goto('/browse?tab=playlists');
      await expectAppPath(page, '/browse?tab=playlists');
      await expectPressedChip(page, 'Playlists');
      await expect(page.getByRole('button', { name: 'Create Playlist' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'My Playlists' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'My Playlists', exact: true })).toHaveCount(0);
      await expect(
        chipTrailing(page).getByRole('button', { name: 'Filter: Podcasts', exact: true })
      ).toBeVisible();
      await expect(sortChip(page)).toHaveAccessibleName('Sort: Week');
      await sortChip(page).click();
      await expect(page.getByRole('menu', { name: 'Range' })).toBeVisible();
      await expect(page.getByRole('menu', { name: 'Sort' })).toHaveCount(0);
      await expect(page.getByTestId('media-list-chips').getByRole('menu')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu', { name: 'Range' })).toHaveCount(0);

      await capturePageLoad(
        page,
        testInfo,
        'Browse Playlists is pressed with no create button or My Playlists tab.',
        chipButton(page, 'Playlists')
      );
    });

    await test.step('Users is pressed and the page header has no Global type label', async () => {
      await page.goto('/browse?tab=users');
      await expectAppPath(page, '/browse?tab=users');
      await expectPressedChip(page, 'Users');
      await expect(page.locator('header').getByText('Global', { exact: true })).toHaveCount(0);
      await expect(sortChip(page)).toHaveAccessibleName('Sort: Recent');

      await capturePageLoad(
        page,
        testInfo,
        'Browse Users is pressed and the header has no Global label.',
        chipButton(page, 'Users')
      );
    });
  });

  test('On a narrow screen the Browse chips stay on one line and the chosen chip is scrolled into view', async ({
    page,
  }, testInfo) => {
    // The row scrolls the selected chip into view on mount, so the viewport is narrow first.
    await page.setViewportSize({ width: 390, height: 844 });

    await test.step('Browse Users stays on one line, and the Users chip sits inside the row', async () => {
      await page.goto('/browse?tab=users');
      await expectAppPath(page, '/browse?tab=users');
      await expect(page.getByRole('heading', { name: 'Browse', exact: true })).toBeVisible();

      const usersChip = page.getByTestId('media-list-chips-users');
      const podcastsChip = page.getByTestId('media-list-chips-podcasts');
      const chipRowRoot = page.getByTestId('media-list-chips');
      await expect(usersChip).toHaveAttribute('aria-pressed', 'true');

      const usersBox = await usersChip.boundingBox();
      const podcastsBox = await podcastsChip.boundingBox();
      const rowBox = await chipRowRoot.boundingBox();
      expect(usersBox, 'Users chip is in the layout').not.toBeNull();
      expect(podcastsBox, 'Podcasts chip is in the layout').not.toBeNull();
      expect(rowBox, 'chip row is in the layout').not.toBeNull();
      if (usersBox === null || podcastsBox === null || rowBox === null) {
        return;
      }

      expect(podcastsBox.y).toBe(usersBox.y);
      expect(usersBox.x).toBeGreaterThanOrEqual(rowBox.x);
      expect(usersBox.x + usersBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);

      await capturePageLoad(
        page,
        testInfo,
        'On a narrow screen the Users chip stays on one line and inside the chip row.',
        usersChip
      );
    });
  });

  test('On Browse, the Categories chip shows the category list in place of the list and hides Sort until a category is chosen', async ({
    page,
  }, testInfo) => {
    const categoriesList = page.getByTestId('media-list-categories');

    await test.step('Pressing the Categories chip on Browse Episodes shows the category list and hides Sort and the gear', async () => {
      await page.goto('/browse?tab=episodes');
      await expectAppPath(page, '/browse?tab=episodes');
      await expectPressedChip(page, 'Episodes');
      await expect(categoryChip(page)).toHaveAccessibleName('Categories');
      await expect(categoryChip(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(sortChip(page)).toBeVisible();

      await categoryChip(page).click();
      await expect(categoryChip(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(categoriesList).toBeVisible();
      await expect(sortChip(page)).toHaveCount(0);
      await expect(layoutChip(page)).toHaveCount(0);

      await capturePageLoad(
        page,
        testInfo,
        'The category list replaces the episodes, and Sort and the gear are hidden.',
        categoriesList
      );
    });

    await test.step('Choosing Arts keeps Episodes pressed, names Arts on the chip, and brings Sort back', async () => {
      await categoriesList.getByRole('button', { name: 'Arts', exact: true }).click();

      await expectAppPath(page, '/browse?tab=episodes&category=arts');
      await expectPressedChip(page, 'Episodes');
      await expect(categoryChip(page)).toHaveAccessibleName('Categories: Arts');
      await expect(categoryChip(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(categoriesList).toHaveCount(0);
      await expect(sortChip(page)).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'The Categories chip names Arts and the episodes list is back.',
        categoryChip(page)
      );
    });

    await test.step('Reopening the list marks Arts as current, and All Categories clears the category', async () => {
      await categoryChip(page).click();
      await expect(
        categoriesList.getByRole('button', { name: 'Arts', exact: true })
      ).toHaveAttribute('aria-current', 'true');

      await categoriesList.getByRole('button', { name: 'All Categories', exact: true }).click();

      await expectAppPath(page, '/browse?tab=episodes');
      await expect(categoryChip(page)).toHaveAccessibleName('Categories');

      await capturePageLoad(
        page,
        testInfo,
        'All Categories clears the category and the chip reads Categories again.',
        categoryChip(page)
      );
    });
  });

  test('Subscribed and Browse lists put Sort and the gear after the media chips, and only where the list uses them', async ({
    page,
  }, testInfo) => {
    await test.step('Signed-out Subscribed Episodes has a plain title, no Categories chip, Sort on Recent, and the gear', async () => {
      await page.goto('/?tab=episodes&category=arts');
      await expect(page.getByRole('heading', { name: 'Subscribed', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Subscribed >/ })).toHaveCount(0);
      await expect(categoryChip(page)).toHaveCount(0);
      await expect(sortChip(page)).toHaveAccessibleName('Sort: Recent');
      await expect(layoutChip(page)).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'Subscribed Episodes shows Sort and the gear after the media chips.',
        sortChip(page)
      );
    });

    await test.step('On Browse Podcasts, choosing Top then Month puts Month on the sort chip', async () => {
      await page.goto('/browse');
      await sortChip(page).click();
      await expect(page.getByRole('menu', { name: 'Sort' })).toBeVisible();
      await expect(page.getByTestId('media-list-chips').getByRole('menu')).toHaveCount(0);

      await page.getByRole('menuitemradio', { name: 'Top', exact: true }).click();
      const rangeMenu = page.getByRole('menu', { name: 'Range' });
      await expect(rangeMenu).toBeVisible();
      await rangeMenu.getByRole('menuitemradio', { name: 'Month', exact: true }).click();
      await expect(sortChip(page)).toHaveAccessibleName('Sort: Month');

      await capturePageLoad(
        page,
        testInfo,
        'The sort chip reads Month after choosing Top and then Month.',
        sortChip(page)
      );
    });

    await test.step('Browse Clips has Categories and Sort but no gear, and Browse Artists has Sort and the gear but no Categories', async () => {
      await page.goto('/browse?tab=clips');
      await expect(categoryChip(page)).toBeVisible();
      await expect(sortChip(page)).toBeVisible();
      await expect(layoutChip(page)).toHaveCount(0);

      await page.goto('/browse?tab=artists');
      await expect(categoryChip(page)).toHaveCount(0);
      await expect(sortChip(page)).toBeVisible();
      await expect(layoutChip(page)).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'Browse Artists shows Sort and the gear and no Categories chip.',
        sortChip(page)
      );
    });
  });

  test('When Browse Livestreams is opened signed out, live streams are listed before scheduled ones', async ({
    page,
  }, testInfo) => {
    await test.step('Browse Livestreams is pressed, live rows come before the scheduled row, and the page has no Ended label, Global header, or view selector, and each status sits on the date line to the left of the date', async () => {
      await page.goto('/browse?tab=livestreams');
      await expectAppPath(page, '/browse?tab=livestreams');
      await expectPressedChip(page, 'Livestreams');
      await expect(page.getByRole('heading', { name: 'Browse', exact: true })).toBeVisible();

      const audioRow = liveItemRow(page, E2E_LIVE_AV_AUDIO_ITEM_TITLE);
      const followedLiveRow = liveItemRow(page, E2E_LIVESTREAM_ITEM_TITLE);
      const scheduledRow = liveItemRow(page, E2E_LIVE_AV_SCHEDULED_ITEM_TITLE);
      await expect(audioRow).toBeVisible();
      await expect(followedLiveRow).toBeVisible();
      await expect(scheduledRow).toBeVisible();
      await expect(audioRow.getByText('Live', { exact: true })).toBeVisible();
      await expect(followedLiveRow.getByText('Live', { exact: true })).toBeVisible();
      await expect(scheduledRow.getByText('Scheduled', { exact: true })).toBeVisible();
      await expectStatusLeftOfDate(audioRow, 'Live');
      await expectStatusLeftOfDate(followedLiveRow, 'Live');
      await expectStatusLeftOfDate(scheduledRow, 'Scheduled');

      const scheduledTop = await rowTop(scheduledRow);
      expect(scheduledTop).toBeGreaterThan(await rowTop(audioRow));
      expect(scheduledTop).toBeGreaterThan(await rowTop(followedLiveRow));

      await expect(
        page.locator('#mainOuterWrapper').getByText('Ended', { exact: true })
      ).toHaveCount(0);
      await expect(page.locator('header').getByText('Global', { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Change Layout View', exact: true })
      ).toHaveCount(0);

      await capturePageLoad(
        page,
        testInfo,
        'Browse Livestreams lists live streams above the scheduled stream.',
        scheduledRow
      );
    });

    await test.step('Clicking the live audio title opens its podcast livestream page', async () => {
      const audioTitle = liveItemRow(page, E2E_LIVE_AV_AUDIO_ITEM_TITLE).getByRole('heading', {
        name: E2E_LIVE_AV_AUDIO_ITEM_TITLE,
        exact: true,
      });
      const detailTitle = page.getByRole('heading', {
        name: E2E_LIVE_AV_AUDIO_ITEM_TITLE,
        exact: true,
      });

      await actionAndCapture(
        page,
        testInfo,
        'The live audio title opens the podcast livestream page.',
        async () => {
          await audioTitle.click();
          await expect(page).toHaveURL(/\/podcast\/livestream\//);
          await expect(detailTitle).toBeVisible();
        },
        detailTitle
      );
    });
  });

  test('Signed-out Subscribed points to Browse', async ({ page }, testInfo) => {
    await test.step('Subscribed shows seven chips and a Browse link in the getting-started message', async () => {
      await page.goto('/');
      await expectAppPath(page, '/');
      await expect(page.getByRole('heading', { name: 'Subscribed', exact: true })).toBeVisible();
      await expectChipOrder(page, SUBSCRIBED_CHIP_LABELS);
      const browseLink = page.locator('a[href="/browse"]').filter({ hasText: 'podcasts' });
      await expect(page.getByText('Your subscriptions will appear here.')).toBeVisible();
      await expect(browseLink).toBeVisible();

      await capturePageLoad(
        page,
        testInfo,
        'Signed-out Subscribed links to Browse from the getting-started message.',
        browseLink
      );
    });
  });

  test('When Subscribed Livestreams is opened signed in, only a followed channel is listed', async ({
    page,
  }, testInfo) => {
    // Login outlasts the default budget before the followed livestream row settles.
    test.setTimeout(60_000);

    await test.step('Subscribed Livestreams is pressed and lists the followed live stream without the unfollowed scheduled stream', async () => {
      await loginSeedUser(page);
      await page.goto('/?tab=livestreams');
      await expectAppPath(page, '/?tab=livestreams');
      await expectPressedChip(page, 'Livestreams');

      const followedLiveRow = liveItemRow(page, E2E_LIVESTREAM_ITEM_TITLE);
      await expect(followedLiveRow).toBeVisible();
      await expect(followedLiveRow.getByText('Live', { exact: true })).toBeVisible();
      await expect(liveItemRow(page, E2E_LIVE_AV_SCHEDULED_ITEM_TITLE)).toHaveCount(0);

      await capturePageLoad(
        page,
        testInfo,
        'Subscribed Livestreams lists the followed live stream.',
        followedLiveRow
      );
    });
  });

  test.describe('When the seeded account is signed in, Subscribed and Add by RSS include followed feeds', () => {
    test.beforeEach(async ({ page }) => {
      // Login plus the stubbed parse outlast the default budget before the followed row settles.
      test.setTimeout(60_000);
      await loginSeedUser(page);
      await stubAddByRSSParse(page, {
        feedUrl: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL,
        outcomes: [{ status: 'parsed', payload: PARSED_FEED }],
      });
      await stubAddByRSSParseAll(page);
    });

    test('Subscribed lists server and Add by RSS follows together', async ({ page }, testInfo) => {
      await test.step('Subscribed opens on Podcasts with seven chips, the seeded show, and the followed feed', async () => {
        await page.goto('/');
        await expectAppPath(page, '/');
        await expect(page.getByRole('heading', { name: 'Subscribed', exact: true })).toBeVisible();
        await expectChipOrder(page, SUBSCRIBED_CHIP_LABELS);
        await expectPressedChip(page, 'Podcasts');
        await expect(page.getByText(E2E_PODCAST_CHANNEL_TITLE).first()).toBeVisible();
        const feedLink = page
          .locator('a[href*="/add-by-rss/podcast/"]')
          .filter({ hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE })
          .first();
        await expect(feedLink).toBeVisible({ timeout: 15_000 });

        await capturePageLoad(
          page,
          testInfo,
          'Subscribed Podcasts lists the seeded show and the followed Add by RSS feed.',
          feedLink
        );
      });

      await test.step('Clicking Episodes shows the parsed Add by RSS episode', async () => {
        await chipButton(page, 'Episodes').click();
        await expectAppPath(page, '/?tab=episodes');
        await expectPressedChip(page, 'Episodes');
        const episode = page.getByText(EPISODE_TITLE).first();
        await expect(episode).toBeVisible({ timeout: 15_000 });

        await capturePageLoad(
          page,
          testInfo,
          'Subscribed Episodes lists the parsed Add by RSS episode.',
          episode
        );
      });

      await test.step('Clicking Clips shows no Add by RSS row in the main column', async () => {
        await chipButton(page, 'Clips').click();
        await expectAppPath(page, '/?tab=clips');
        await expectPressedChip(page, 'Clips');
        await expect(page.locator('#mainOuterWrapper a[href*="/add-by-rss/"]')).toHaveCount(0);

        await capturePageLoad(
          page,
          testInfo,
          'Subscribed Clips has no Add by RSS link in the main column.',
          chipButton(page, 'Clips')
        );
      });
    });

    test('The Add by RSS page has its own chips and Add Feed', async ({ page }, testInfo) => {
      await test.step('The Library link opens Add by RSS with six chips and the followed feed', async () => {
        await page.goto('/');
        const libraryLink = page.locator('#sidebar a[href="/add-by-rss"]');
        await expect(libraryLink).toBeVisible();
        await libraryLink.click();
        await expectAppPath(page, '/add-by-rss');
        await expect(page.getByRole('heading', { name: 'Add by RSS', exact: true })).toBeVisible();
        await expectChipOrder(page, ADD_BY_RSS_CHIP_LABELS);
        await expectPressedChip(page, 'Podcasts');
        const feedLink = page
          .locator('a[href*="/add-by-rss/podcast/"]')
          .filter({ hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE })
          .first();
        await expect(feedLink).toBeVisible({ timeout: 15_000 });

        await capturePageLoad(
          page,
          testInfo,
          'Add by RSS lists the followed feed under its Podcasts chip.',
          feedLink
        );
      });

      await test.step('Add Feed and Check for Updates sit above the chips, and choosing Oldest updates the Sort chip', async () => {
        const actions = page.locator('#mainOuterWrapper').getByTestId('add-by-rss-list-actions');
        const addFeed = actions.getByRole('button', { name: 'Add Feed', exact: true });
        const checkUpdates = actions.getByRole('button', {
          name: 'Check for Updates',
          exact: true,
        });
        await expect(addFeed).toBeVisible();
        await expect(checkUpdates).toBeVisible();

        const header = page.locator('header');
        await expect(header.getByRole('button', { name: 'Add Feed', exact: true })).toHaveCount(0);
        await expect(
          header.getByRole('button', { name: 'Check for Updates', exact: true })
        ).toHaveCount(0);

        const chips = page.getByTestId('media-list-chips');
        const actionsBox = await actions.boundingBox();
        const chipsBox = await chips.boundingBox();
        const addFeedBox = await addFeed.boundingBox();
        const checkUpdatesBox = await checkUpdates.boundingBox();
        expect(actionsBox, 'actions row is in the layout').not.toBeNull();
        expect(chipsBox, 'chip row is in the layout').not.toBeNull();
        expect(addFeedBox, 'Add Feed is in the layout').not.toBeNull();
        expect(checkUpdatesBox, 'Check for Updates is in the layout').not.toBeNull();
        if (
          actionsBox !== null &&
          chipsBox !== null &&
          addFeedBox !== null &&
          checkUpdatesBox !== null
        ) {
          expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(chipsBox.y);
          expect(addFeedBox.x).toBeLessThan(checkUpdatesBox.x);
        }

        const trailing = page.getByTestId('media-list-chips-trailing');
        const sortButton = trailing.getByRole('button', { name: 'Sort: Recent', exact: true });
        const layoutButton = trailing.getByRole('button', {
          name: 'Change Layout View',
          exact: true,
        });
        await expect(sortButton).toBeVisible();
        await expect(layoutButton).toBeVisible();
        const sortBox = await sortButton.boundingBox();
        const layoutBox = await layoutButton.boundingBox();
        expect(sortBox, 'Sort chip is in the layout').not.toBeNull();
        expect(layoutBox, 'layout gear is in the layout').not.toBeNull();
        if (sortBox !== null && layoutBox !== null) {
          expect(sortBox.x).toBeLessThan(layoutBox.x);
        }

        await expect(page.getByRole('button', { name: 'Recent', exact: true })).toHaveCount(0);

        await sortButton.click();
        // The open menu is portaled on document.body, outside the trailing slot.
        await page.getByRole('menuitemradio', { name: 'Oldest', exact: true }).click();
        await expect(
          trailing.getByRole('button', { name: 'Sort: Oldest', exact: true })
        ).toBeVisible();

        await capturePageLoad(
          page,
          testInfo,
          'Add Feed and Check for Updates sit above the chips, and the Sort chip shows Oldest.',
          actions
        );
      });

      await test.step('Add Feed opens the add-feed page', async () => {
        const addFeed = page.getByRole('button', { name: 'Add Feed', exact: true });
        await addFeed.click();
        await expectAppPath(page, '/add-by-rss/add');
        const feedUrlField = page.getByLabel('RSS Feed URL');
        await expect(feedUrlField).toBeVisible();

        await capturePageLoad(
          page,
          testInfo,
          'Add Feed opens the page where a feed URL is entered.',
          feedUrlField
        );
      });
    });

    test('When an Add by RSS feed has a live item, that livestream is listed and the feed stays on Podcasts', async ({
      page,
    }, testInfo) => {
      await test.step('Add by RSS Livestreams is pressed and lists the parsed live item', async () => {
        await page.goto('/add-by-rss?tab=livestreams');
        await expectAppPath(page, '/add-by-rss?tab=livestreams');
        await expectPressedChip(page, 'Livestreams');

        const liveLink = page
          .locator('a[href*="/add-by-rss/podcast/livestream/"]')
          .filter({ hasText: E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE });
        // The stubbed parse lands before the livestream row.
        await expect(liveLink).toBeVisible({ timeout: 15_000 });
        const liveRow = page.getByTestId('add-by-rss-livestream-row').filter({
          hasText: E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE,
        });
        await expect(liveRow.getByText('Live', { exact: true })).toBeVisible();
        const actions = page.getByTestId('add-by-rss-list-actions');
        await expect(
          actions.getByRole('button', { name: 'Check for Updates', exact: true })
        ).toBeVisible();
        await expect(actions.getByRole('button', { name: 'Add Feed', exact: true })).toBeVisible();
        const header = page.locator('header');
        await expect(
          header.getByRole('button', { name: 'Check for Updates', exact: true })
        ).toHaveCount(0);
        await expect(header.getByRole('button', { name: 'Add Feed', exact: true })).toHaveCount(0);
        await expect(page.getByTestId('media-list-chips-trailing')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Sort: Recent', exact: true })).toHaveCount(
          0
        );
        await expect(
          page.getByRole('button', { name: 'Change Layout View', exact: true })
        ).toHaveCount(0);

        await capturePageLoad(
          page,
          testInfo,
          'Add by RSS Livestreams lists the parsed live item.',
          liveLink
        );
      });

      await test.step('The feed that has a live item is still listed on the Podcasts chip', async () => {
        await chipButton(page, 'Podcasts').click();
        await expectPressedChip(page, 'Podcasts');
        await expectAppPath(page, '/add-by-rss');
        const feedLink = page
          .locator('a[href*="/add-by-rss/podcast/"]:not([href*="/livestream/"])')
          .filter({ hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE });
        await expect(feedLink).toBeVisible();

        await capturePageLoad(
          page,
          testInfo,
          'The feed that has a live item is still listed on the Podcasts chip.',
          feedLink
        );
      });

      await test.step('Subscribed Livestreams lists that Add by RSS livestream beside the followed live stream', async () => {
        await page.goto('/?tab=livestreams');
        await expectAppPath(page, '/?tab=livestreams');
        await expectPressedChip(page, 'Livestreams');
        const addByRssLink = page
          .locator('a[href*="/add-by-rss/podcast/livestream/"]')
          .filter({ hasText: E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE });
        await expect(addByRssLink).toBeVisible();
        await expect(liveItemRow(page, E2E_LIVESTREAM_ITEM_TITLE)).toBeVisible();

        await capturePageLoad(
          page,
          testInfo,
          'Subscribed Livestreams lists the Add by RSS livestream beside the followed live stream.',
          addByRssLink
        );
      });
    });

    test('When an Add by RSS podcast page lists livestreams, live comes first, then scheduled, then one that ended within the day, and Oldest leaves that order in place', async ({
      page,
    }, testInfo) => {
      await test.step('Opening Add by RSS Livestreams waits until the parsed live item is listed', async () => {
        await page.goto('/add-by-rss?tab=livestreams');
        await expectAppPath(page, '/add-by-rss?tab=livestreams');

        const liveLink = page
          .locator('a[href*="/add-by-rss/podcast/livestream/"]')
          .filter({ hasText: E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE });
        // The stubbed parse lands before the livestream row.
        await expect(liveLink).toBeVisible({ timeout: 15_000 });

        await capturePageLoad(
          page,
          testInfo,
          'Add by RSS Livestreams has finished parsing the followed feed.',
          liveLink
        );
      });

      await test.step('Opening the followed feed from the Podcasts chip loads its podcast page', async () => {
        await chipButton(page, 'Podcasts').click();
        const feedLink = page
          .locator('a[href*="/add-by-rss/podcast/"]:not([href*="/livestream/"])')
          .filter({ hasText: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE });
        await expect(feedLink).toBeVisible();
        await feedLink.click();
        await expect(page).toHaveURL((url) => /^\/add-by-rss\/podcast\/[^/]+$/.test(url.pathname));
        const feedHeading = page.getByRole('heading', {
          name: E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE,
          level: 1,
        });
        await expect(feedHeading).toBeVisible();

        await capturePageLoad(
          page,
          testInfo,
          'The followed Add by RSS feed opens on its podcast page.',
          feedHeading
        );
      });

      await test.step('The podcast page lists the live item, then the scheduled item, then the item that ended within the day, and each status sits on the date line to the left of the date', async () => {
        const liveRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE);
        const scheduledRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_SCHEDULED_TITLE);
        const endedRecentRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE);

        await expect(page.getByTestId('add-by-rss-livestream-row')).toHaveCount(3);
        await expect(liveRow).toBeVisible();
        await expect(liveRow.getByText('Live', { exact: true })).toBeVisible();
        await expect(scheduledRow).toBeVisible();
        await expect(scheduledRow.getByText('Scheduled', { exact: true })).toBeVisible();
        await expect(endedRecentRow).toBeVisible();
        await expect(endedRecentRow.getByText('Ended', { exact: true })).toBeVisible();
        await expectStatusLeftOfDate(liveRow, 'Live');
        await expectStatusLeftOfDate(scheduledRow, 'Scheduled');
        await expectStatusLeftOfDate(endedRecentRow, 'Ended');

        const liveTop = await rowTop(liveRow);
        const scheduledTop = await rowTop(scheduledRow);
        const endedRecentTop = await rowTop(endedRecentRow);
        expect(liveTop).toBeLessThan(scheduledTop);
        expect(scheduledTop).toBeLessThan(endedRecentTop);

        await capturePageLoad(
          page,
          testInfo,
          'The podcast page lists live, then scheduled, then the recent ended livestream.',
          liveRow
        );
      });

      await test.step('An ended livestream older than a day is not listed', async () => {
        const endedRecentRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE);
        await expect(page.getByText(E2E_CHIPS_ADD_BY_RSS_ENDED_OLD_TITLE)).toHaveCount(0);

        await capturePageLoad(
          page,
          testInfo,
          'The livestream that ended more than a day ago is absent.',
          endedRecentRow
        );
      });

      await test.step('Choosing Oldest leaves the livestream rows in the same vertical order', async () => {
        const liveRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE);
        const scheduledRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_SCHEDULED_TITLE);
        const endedRecentRow = addByRssLivestreamRow(page, E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE);

        await page.getByRole('button', { name: 'Sort: Recent', exact: true }).click();
        await page.getByRole('menuitemradio', { name: 'Oldest', exact: true }).click();

        const liveTop = await rowTop(liveRow);
        const scheduledTop = await rowTop(scheduledRow);
        const endedRecentTop = await rowTop(endedRecentRow);
        expect(liveTop).toBeLessThan(scheduledTop);
        expect(scheduledTop).toBeLessThan(endedRecentTop);

        await capturePageLoad(
          page,
          testInfo,
          'Oldest reorders episodes and leaves the livestream rows in channel order.',
          liveRow
        );
      });
    });
  });

  test('Old list URLs are gone, and a podcast detail URL still loads', async ({ request }) => {
    await test.step('The removed list paths each answer 404', async () => {
      for (const path of REMOVED_LIST_PATHS) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(404);
      }
    });

    await test.step('A podcast detail URL still answers 200', async () => {
      const response = await request.get(`/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}`);
      expect(response.status()).toBe(200);
    });
  });
});
