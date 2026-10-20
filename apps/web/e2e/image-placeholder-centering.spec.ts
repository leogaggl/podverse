import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  E2E_PODCAST_CHANNEL_ID_TEXT,
  E2E_PODCAST_ITEM_CHAPTERED_ID_TEXT,
  E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const PLACEHOLDER_FILE_NAME = 'placeholder-image.png';
const CENTER_TOLERANCE_PX = 1;

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'tablet', width: 820, height: 1180 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

type PlaceholderCentering = {
  count: number;
  maxOffsetPx: number;
};

/** Every artwork request fails, so each `Image` falls through its candidates to the placeholder. */
async function abortRemoteArtwork(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() === 'image' && !request.url().includes(PLACEHOLDER_FILE_NAME)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

/**
 * Measures each visible placeholder against the box the caller styles (the placeholder image sits
 * in an inner centering box inside it). The player is skipped; its artwork uses another component.
 */
async function measurePlaceholderCentering(page: Page): Promise<PlaceholderCentering> {
  return page.evaluate((fileName) => {
    let count = 0;
    let maxOffsetPx = 0;
    for (const img of Array.from(document.querySelectorAll('img'))) {
      const source = img.currentSrc || img.src;
      if (!source.includes(fileName) || img.closest('aside#media-player') !== null) {
        continue;
      }
      const wrapper = img.parentElement?.parentElement;
      if (!wrapper) {
        continue;
      }
      const imageBox = img.getBoundingClientRect();
      const wrapperBox = wrapper.getBoundingClientRect();
      if (imageBox.width === 0 || imageBox.height === 0 || wrapperBox.width === 0) {
        continue;
      }
      count += 1;
      const offsetX = Math.abs(
        imageBox.left + imageBox.width / 2 - (wrapperBox.left + wrapperBox.width / 2)
      );
      const offsetY = Math.abs(
        imageBox.top + imageBox.height / 2 - (wrapperBox.top + wrapperBox.height / 2)
      );
      maxOffsetPx = Math.max(maxOffsetPx, offsetX, offsetY);
    }
    return { count, maxOffsetPx };
  }, PLACEHOLDER_FILE_NAME);
}

async function expectPlaceholdersCenteredAtEveryWidth(
  page: Page,
  testInfo: TestInfo,
  pageLabel: string
): Promise<void> {
  for (const viewport of VIEWPORTS) {
    await test.step(`Every visible placeholder on the ${pageLabel} is centered at ${viewport.width} px`, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await expect
        .poll(async () => {
          const { count, maxOffsetPx } = await measurePlaceholderCentering(page);
          return count > 0 && maxOffsetPx <= CENTER_TOLERANCE_PX;
        })
        .toBe(true);

      await capturePageLoad(
        page,
        testInfo,
        `The ${pageLabel} shows centered placeholder artwork at the ${viewport.label} width.`
      );
    });
  }
}

test.describe('Placeholder artwork centering', () => {
  test.beforeEach(async ({ page }) => {
    await abortRemoteArtwork(page);
  });

  test('The podcast page header and episode rows center their placeholder artwork', async ({
    page,
  }, testInfo) => {
    await page.goto(`/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}`);
    await expectPlaceholdersCenteredAtEveryWidth(page, testInfo, 'podcast page');
  });

  test('The episode page header centers its placeholder artwork', async ({ page }, testInfo) => {
    await page.goto(`/episode/${E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT}`);
    await expectPlaceholdersCenteredAtEveryWidth(page, testInfo, 'episode page');
  });

  test('The episode clip rows center their placeholder artwork', async ({ page }, testInfo) => {
    await page.goto(`/episode/${E2E_PODCAST_ITEM_CHAPTERED_ID_TEXT}?type=clips`);
    await expectPlaceholdersCenteredAtEveryWidth(page, testInfo, 'episode clips list');
  });
});
