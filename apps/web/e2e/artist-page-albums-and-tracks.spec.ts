import { expect, test } from '@playwright/test';

import {
  E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID,
  E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE,
  E2E_MUSIC_ALBUM_ID_TEXT,
  E2E_MUSIC_ALBUM_TITLE,
  E2E_MUSIC_ALBUM_UNCLAIMED_TITLE,
  E2E_MUSIC_CHANNEL_ID_TEXT,
} from './helpers/seedConstants';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const NOT_YET_ADDED_ALBUMS_NOTE =
  "This artist's feed lists these albums. They move up once both feeds confirm the link.";

/**
 * The message catalog embeds "Your Add by RSS Albums" in script payloads on every page.
 * The rendered document is the part that must omit that heading.
 */
function htmlWithoutScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

test.describe('Artist page albums and tracks', () => {
  test('When a visitor opens the seeded artist, verified albums sit above Not Yet Added, and a Not Yet Added row opens the Podcast Index preview.', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}`);
    expect(response?.status()).toBe(200);
    const html = (await response?.text()) ?? '';
    const renderedHtml = htmlWithoutScripts(html);
    expect(renderedHtml).toContain('Verified Albums');
    expect(renderedHtml).toContain('Not Yet Added');
    expect(renderedHtml).not.toContain('Your Add by RSS Albums');
    expect(html).not.toContain('artist-your-add-by-rss-albums');

    await expect(page).toHaveURL(new RegExp(`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}$`));

    const verifiedSection = page.getByTestId('artist-verified-albums');
    await expect(
      verifiedSection.getByRole('heading', { name: 'Verified Albums', exact: true })
    ).toBeVisible();
    const verifiedAlbumLink = verifiedSection.getByRole('link', { name: E2E_MUSIC_ALBUM_TITLE });
    await expect(verifiedAlbumLink).toBeVisible();
    await expect(verifiedAlbumLink).toHaveAttribute('href', `/album/${E2E_MUSIC_ALBUM_ID_TEXT}`);

    const notYetAddedSection = page.getByTestId('artist-not-yet-added-albums');
    await expect(
      notYetAddedSection.getByRole('heading', { name: 'Not Yet Added', exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('artist-not-yet-added-albums-note')).toHaveText(
      NOT_YET_ADDED_ALBUMS_NOTE
    );
    const notYetAddedLink = notYetAddedSection.getByRole('link', {
      name: E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE,
    });
    await expect(notYetAddedLink).toBeVisible();

    const verifiedBox = await verifiedSection.boundingBox();
    const notYetAddedBox = await notYetAddedSection.boundingBox();
    if (verifiedBox === null || notYetAddedBox === null) {
      throw new Error('Verified Albums and Not Yet Added must both be visible.');
    }
    expect(verifiedBox.y).toBeLessThan(notYetAddedBox.y);

    await expect(page.getByText(E2E_MUSIC_ALBUM_UNCLAIMED_TITLE)).toHaveCount(0);
    await expect(page.getByText('E2E Unknown Album')).toHaveCount(0);
    await expect(page.getByTestId('artist-your-add-by-rss-albums')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Your Add by RSS Albums', exact: true })
    ).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'The artist page shows verified albums above albums that are not yet added.',
      notYetAddedSection
    );

    const previewHeading = page.getByRole('heading', {
      name: E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE,
    });
    await actionAndCapture(
      page,
      testInfo,
      'The Not Yet Added album opens its Podcast Index preview.',
      async () => {
        await notYetAddedLink.click();
        await expect(page).toHaveURL(
          new RegExp(`/podcast-index/feed/${E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID}$`)
        );
        await expect(previewHeading).toBeVisible();
      },
      previewHeading
    );
  });

  test("When a visitor opens the Tracks chip, they see the verified album's tracks, newer track first.", async ({
    page,
  }, testInfo) => {
    await page.goto(`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}$`));

    await page.getByRole('button', { name: 'Tracks', exact: true }).click();

    // Track titles are headings inside the row's play control.
    const tracks = page.getByRole('heading', { name: /E2E Music Track/ });
    const trackOne = tracks.nth(0);
    const trackTwo = tracks.nth(1);
    await expect(trackOne).toBeVisible();
    await expect(trackOne).toHaveText('E2E Music Track One');
    await expect(trackTwo).toBeVisible();
    await expect(trackTwo).toHaveText('E2E Music Track Two');
    await expect(page.getByTestId('artist-your-add-by-rss-tracks')).toHaveCount(0);

    await capturePageLoad(
      page,
      testInfo,
      'The Tracks chip lists the verified album tracks with the newer track first.',
      trackOne
    );
  });
});
