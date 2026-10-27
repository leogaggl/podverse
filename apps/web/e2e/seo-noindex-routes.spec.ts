import { expect, test } from '@playwright/test';

import {
  E2E_EMBED_PLAYLIST_ID_TEXT,
  E2E_MUSIC_TRACK_ONE_ID_TEXT,
  E2E_PODCAST_CHANNEL_ID_TEXT,
  E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT,
  E2E_SOUNDBITE_ID_TEXT,
} from './helpers/seedConstants';
import { expectRobotsNoindex, fetchSsrHtml } from './helpers/seoHtml';

test.describe('Web SEO noindex routes', () => {
  test('SSR HTML marks auth and utility routes as noindex', async ({ request }) => {
    await test.step('Assert settings route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/settings');
      expectRobotsNoindex(html);
    });

    await test.step('Assert search route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/search');
      expectRobotsNoindex(html);
    });

    await test.step('Assert sign-up route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/sign-up');
      expectRobotsNoindex(html);
    });

    await test.step('Assert queues route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/queues');
      expectRobotsNoindex(html);
    });

    await test.step('Assert history route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/history');
      expectRobotsNoindex(html);
    });
  });

  test('guest my-profile route stays on the page and remains non-indexable', async ({
    request,
  }) => {
    const response = await request.get('/my-profile', { maxRedirects: 0 });
    expect(response.status()).toBeLessThan(300);

    const html = await response.text();
    expectRobotsNoindex(html);
  });

  test('SSR HTML marks embed routes as noindex', async ({ request }) => {
    await test.step('Assert embed demo index is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, '/embed');
      expectRobotsNoindex(html);
    });

    await test.step('Assert embed episode child route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(
        request,
        `/embed/episode/${E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT}`
      );
      expectRobotsNoindex(html);
    });

    await test.step('Assert embed podcast list child route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, `/embed/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}`);
      expectRobotsNoindex(html);
    });

    await test.step('Assert embed track child route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, `/embed/track/${E2E_MUSIC_TRACK_ONE_ID_TEXT}`);
      expectRobotsNoindex(html);
    });

    await test.step('Assert embed playlist child route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, `/embed/playlist/${E2E_EMBED_PLAYLIST_ID_TEXT}`);
      expectRobotsNoindex(html);
    });

    await test.step('Assert embed official-clip child route is noindex in SSR metadata.', async () => {
      const html = await fetchSsrHtml(request, `/embed/official-clip/${E2E_SOUNDBITE_ID_TEXT}`);
      expectRobotsNoindex(html);
    });
  });
});
