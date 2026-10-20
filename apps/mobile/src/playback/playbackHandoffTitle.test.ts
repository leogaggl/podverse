import { describe, expect, it } from 'vitest';

import { addByRssResourceDataTitle, queueResourceTitle } from './playbackHandoffTitle';

describe('playback handoff titles', () => {
  it('names a server Add by RSS row by its episode title, never its hash', () => {
    expect(
      queueResourceTitle({
        add_by_rss_resource_data: {
          feed_url: 'https://example.com/feed.xml',
          guid: 'episode-guid-1',
          title: 'Add by RSS Episode',
        },
        item: null,
      })
    ).toBe('Add by RSS Episode');
  });

  it('returns null for an Add by RSS row without a title, so the caller picks a label', () => {
    expect(
      queueResourceTitle({
        add_by_rss_resource_data: { feed_url: 'https://example.com/feed.xml', title: '  ' },
        item: null,
      })
    ).toBeNull();
    expect(addByRssResourceDataTitle(null)).toBeNull();
  });

  it('keeps naming linked rows by their item title', () => {
    expect(queueResourceTitle({ item: { title: 'Linked Episode' } })).toBe('Linked Episode');
  });
});
