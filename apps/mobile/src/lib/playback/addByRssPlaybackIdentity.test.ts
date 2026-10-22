import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';

import { nowPlayingResourceFromTarget } from '../../playback/playbackEventSource';
import { addByRssPlaybackMediaId } from '../addByRss/resourceData';
import { playbackTargetRowMediaId } from './buildPlaybackTarget';
import { mediaEngineSourceMetaFromTarget } from './mediaEngineSourceMeta';

const resourceData: AddByRSSResourceData = {
  enclosure_url: 'https://example.com/episode.mp3',
  feed_url: 'https://example.com/feed.xml',
  guid: 'episode-guid-1',
  id_text: 'feed-id',
};

const target: PlaybackTarget = {
  kind: 'add-by-rss',
  resourceData,
};

describe('Add by RSS playback identity', () => {
  it('matches the row id to the item hash, not the feed id', () => {
    const mediaId = addByRssPlaybackMediaId(resourceData);

    expect(playbackTargetRowMediaId(target)).toBe(mediaId);
    expect(playbackTargetRowMediaId(target)).not.toBe('feed-id');
  });

  it('records the same id on the engine source', () => {
    expect(mediaEngineSourceMetaFromTarget(target, 'js')?.idText).toBe(
      playbackTargetRowMediaId(target)
    );
  });

  it('records the same id on the now-playing event', () => {
    expect(nowPlayingResourceFromTarget(target)?.resourceIdText).toBe(
      playbackTargetRowMediaId(target)
    );
  });
});
