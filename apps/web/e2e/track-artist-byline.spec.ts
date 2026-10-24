import { expect, test } from '@playwright/test';

import {
  E2E_MUSIC_ALBUM_ID_TEXT,
  E2E_MUSIC_ALBUM_TITLE,
  E2E_MUSIC_CHANNEL_ID_TEXT,
  E2E_MUSIC_TRACK_ONE_ID_TEXT,
} from './helpers/seedConstants';
import { capturePageLoad } from './helpers/stepScreenshots';

const E2E_MUSIC_ARTIST_TITLE = 'E2E Music Artist';
const E2E_MUSIC_TRACK_ONE_TITLE = 'E2E Music Track One';

test.describe('Track page artist byline', () => {
  test('When a visitor opens a directory track whose album names a verified artist, the artist name links to the artist page.', async ({
    page,
  }, testInfo) => {
    await page.goto(`/track/${E2E_MUSIC_TRACK_ONE_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/track/${E2E_MUSIC_TRACK_ONE_ID_TEXT}$`));

    const trackHeading = page.getByRole('heading', { name: E2E_MUSIC_TRACK_ONE_TITLE });
    await expect(trackHeading).toBeVisible();

    const artistLink = page.getByRole('link', { name: E2E_MUSIC_ARTIST_TITLE, exact: true });
    await expect(artistLink).toBeVisible();
    await expect(artistLink).toHaveAttribute(
      'href',
      new RegExp(`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}$`)
    );

    await capturePageLoad(
      page,
      testInfo,
      'The track page links the verified artist under the track title.',
      artistLink
    );
  });

  test('When a visitor opens the album page for that track, the artist name is not a link.', async ({
    page,
  }, testInfo) => {
    await page.goto(`/album/${E2E_MUSIC_ALBUM_ID_TEXT}`);
    await expect(page).toHaveURL(new RegExp(`/album/${E2E_MUSIC_ALBUM_ID_TEXT}$`));

    const albumHeading = page.getByRole('heading', { name: E2E_MUSIC_ALBUM_TITLE });
    await expect(albumHeading).toBeVisible();
    await expect(page.getByRole('link', { name: E2E_MUSIC_ARTIST_TITLE, exact: true })).toHaveCount(
      0
    );

    await capturePageLoad(
      page,
      testInfo,
      'The album page does not link the verified artist.',
      albumHeading
    );
  });
});
