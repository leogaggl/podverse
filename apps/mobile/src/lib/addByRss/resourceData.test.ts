import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId } from '@podverse/helpers';
import type { AddByRSSResourceData } from '@podverse/helpers/dto';

import { addByRssPlaybackMediaId } from './resourceData';

const FEED_URL = 'https://example.com/feed.xml';

describe('addByRssPlaybackMediaId', () => {
  it('hashes a real guid with the feed url', () => {
    const resourceData: AddByRSSResourceData = {
      feed_url: FEED_URL,
      guid: 'episode-guid-1',
    };

    expect(addByRssPlaybackMediaId(resourceData)).toBe(
      getAddByRSSHashId({ feed_url: FEED_URL, guid: 'episode-guid-1' })
    );
  });

  it('hashes the enclosure when the guid was made on this device', () => {
    const channelIdText = 'feed-id';
    const enclosureUrl = 'https://example.com/episode.mp3';
    const resourceData: AddByRSSResourceData = {
      channel_id_text: channelIdText,
      enclosure_url: enclosureUrl,
      feed_url: FEED_URL,
      guid: `${channelIdText}-3`,
    };

    expect(addByRssPlaybackMediaId(resourceData)).toBe(
      getAddByRSSHashId({ feed_url: FEED_URL, enclosure_url: enclosureUrl })
    );
  });

  it('ignores userinfo on the feed url', () => {
    const withUserinfo: AddByRSSResourceData = {
      feed_url: 'https://user:pass@example.com/feed.xml',
      guid: 'episode-guid-1',
    };
    const plain: AddByRSSResourceData = {
      feed_url: FEED_URL,
      guid: 'episode-guid-1',
    };

    expect(addByRssPlaybackMediaId(withUserinfo)).toBe(addByRssPlaybackMediaId(plain));
  });

  it('gives two items of one feed different ids', () => {
    const first: AddByRSSResourceData = { feed_url: FEED_URL, guid: 'one' };
    const second: AddByRSSResourceData = { feed_url: FEED_URL, guid: 'two' };

    expect(addByRssPlaybackMediaId(first)).not.toBe(addByRssPlaybackMediaId(second));
  });
});
