import { expect, test } from '@playwright/test';

import {
  expectHeadDoesNotContain,
  expectMetaDescriptionContains,
  fetchSsrHtml,
} from './helpers/seoHtml';

test.describe('Web SEO static page metadata', () => {
  test('SSR HTML for curated pages uses i18n SEO copy and not feed descriptions', async ({
    request,
  }) => {
    await test.step('Fetch home page SSR HTML and assert curated home metadata.', async () => {
      const html = await fetchSsrHtml(request, '/');
      expect(html).toContain('<title>PodverseE2E');
      expectMetaDescriptionContains(
        html,
        'Discover podcasts, music, and livestreams on PodverseE2E.'
      );
      expectHeadDoesNotContain(
        html,
        'E2E seeded channel for deterministic media-player podcast tests.'
      );
    });

    await test.step('Fetch Browse page SSR HTML and assert curated Browse metadata.', async () => {
      const html = await fetchSsrHtml(request, '/browse');
      expect(html).toContain('<title>Browse');
      expectMetaDescriptionContains(
        html,
        'Browse podcasts, episodes, clips, music, playlists, and profiles on PodverseE2E.'
      );
      expectHeadDoesNotContain(
        html,
        'E2E seeded channel for deterministic media-player podcast tests.'
      );
    });
  });
});
