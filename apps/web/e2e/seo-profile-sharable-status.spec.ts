import { expect, test } from '@playwright/test';

import {
  E2E_SEO_PRIVATE_PROFILE_PLACEHOLDER_ID_TEXT,
  E2E_SEO_PUBLIC_PROFILE_ID_TEXT,
} from './helpers/seedConstants';
import { expectRobotsIndexable, fetchSsrHtml } from './helpers/seoHtml';

test.describe('Web SEO profile sharable-status behavior', () => {
  test('a discoverable public profile remains indexable', async ({ request }) => {
    const profilesHtml = await fetchSsrHtml(request, '/profiles');
    expect(profilesHtml).toContain(`/profile/${E2E_SEO_PUBLIC_PROFILE_ID_TEXT}`);

    const publicProfileHtml = await fetchSsrHtml(
      request,
      `/profile/${E2E_SEO_PUBLIC_PROFILE_ID_TEXT}`
    );
    expectRobotsIndexable(publicProfileHtml);
  });

  test('a non-public or missing profile redirects to the profiles list', async ({ request }) => {
    const response = await request.get(`/profile/${E2E_SEO_PRIVATE_PROFILE_PLACEHOLDER_ID_TEXT}`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    const location = response.headers().location;
    expect(location).toBeDefined();
    expect(new URL(location, 'http://localhost').pathname).toBe('/profiles');
  });
});
