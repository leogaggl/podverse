import { expect, test } from '@playwright/test';

test.describe('Mobile app link association files', () => {
  test('apple-app-site-association is absent until iOS app ids are configured', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/apple-app-site-association', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
    expect(await response.text()).toBe('');
  });

  test('assetlinks.json is absent until Android certificate fingerprints are configured', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/assetlinks.json', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
    expect(await response.text()).toBe('');
  });
});
