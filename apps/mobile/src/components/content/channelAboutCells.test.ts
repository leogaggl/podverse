import { describe, expect, it } from 'vitest';

import { buildChannelAboutCells } from './channelAboutCells';

describe('buildChannelAboutCells', () => {
  it('lists description when prose is present', () => {
    const kinds = buildChannelAboutCells({
      channel_description: { value: 'A show about feeds.' },
    }).map((cell) => cell.kind);

    expect(kinds).toEqual(['description']);
  });

  it('lists nothing when description and links are missing', () => {
    expect(buildChannelAboutCells({})).toEqual([]);
  });

  it('lists links as description when prose is empty', () => {
    const kinds = buildChannelAboutCells({
      feed: { url: 'https://example.com/feed.xml' },
    }).map((cell) => cell.kind);

    expect(kinds).toEqual(['description']);
  });
});
