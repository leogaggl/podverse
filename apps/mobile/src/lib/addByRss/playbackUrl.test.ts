import { describe, expect, it, vi } from 'vitest';

import { hasUrlUserinfo, resolveAddByRssPlaybackUrl } from './playbackUrl';

vi.mock('../e2e/resolveE2eMediaUrl', () => ({
  resolveE2eMediaUrl: (url: string) => url,
}));

describe('hasUrlUserinfo', () => {
  it('is true when the authority carries a user, with or without a password', () => {
    expect(hasUrlUserinfo('https://u:p@host/a.mp3')).toBe(true);
    expect(hasUrlUserinfo('https://u@host/a.mp3')).toBe(true);
  });

  it('is false for an @ outside the authority', () => {
    expect(hasUrlUserinfo('https://host/a.mp3?u=a@b')).toBe(false);
    expect(hasUrlUserinfo('https://host/a.mp3')).toBe(false);
  });
});

describe('resolveAddByRssPlaybackUrl', () => {
  it('prefers the bundle enclosure', () => {
    expect(
      resolveAddByRssPlaybackUrl({
        bundle: {
          enclosures: [{ item_enclosure_sources: [{ uri: ' https://e.x/bundle.mp3 ' }] }],
        },
        enclosure_url: 'https://e.x/row.mp3',
      })
    ).toBe('https://e.x/bundle.mp3');
  });

  it('falls back to the row enclosure URL without a bundle', () => {
    expect(resolveAddByRssPlaybackUrl({ enclosure_url: 'https://e.x/row.mp3' })).toBe(
      'https://e.x/row.mp3'
    );
    expect(resolveAddByRssPlaybackUrl({})).toBeNull();
  });
});
