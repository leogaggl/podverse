import { describe, expect, it } from 'vitest';

import type { LineArtist } from './lineArtist';
import { directoryLineArtist, joinLineArtistTitles, lineArtistKey } from './lineArtist';

const addByRssArtist = (title: string): LineArtist => ({
  kind: 'add-by-rss',
  feedIdText: 'abc123',
  feedUrl: 'https://example.com/artist.xml',
  title,
});

describe('lineArtistKey', () => {
  it('prefixes each kind so a directory id and an Add by RSS id never collide', () => {
    expect(
      lineArtistKey(directoryLineArtist({ id_text: 'abc123', title: 'A', medium_id: 22 }))
    ).toBe('directory:abc123');
    expect(lineArtistKey(addByRssArtist('B'))).toBe('add-by-rss:abc123');
  });
});

describe('joinLineArtistTitles', () => {
  it('skips a directory artist with no title and joins the rest with a comma', () => {
    expect(
      joinLineArtistTitles([
        directoryLineArtist({ id_text: 'one', title: ' Directory Artist ', medium_id: 22 }),
        directoryLineArtist({ id_text: 'two', title: null, medium_id: 22 }),
        directoryLineArtist({ id_text: 'three', title: '   ', medium_id: 22 }),
        addByRssArtist('Feed Artist'),
      ])
    ).toBe('Directory Artist, Feed Artist');
  });
});
