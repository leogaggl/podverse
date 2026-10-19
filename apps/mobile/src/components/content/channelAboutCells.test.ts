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

  it('falls back to the stored preview and carries the shortened flag', () => {
    const [cell] = buildChannelAboutCells({
      channel_description: { is_truncated: true, preview: 'A shortened show.' },
    });

    expect(cell).toMatchObject({ isTruncated: true, text: 'A shortened show.' });
  });

  it('reads an older payload with no shortened flag as complete', () => {
    const [cell] = buildChannelAboutCells({
      channel_description: { value: 'A show about feeds.' },
    });

    expect(cell?.isTruncated).toBe(false);
  });
});
