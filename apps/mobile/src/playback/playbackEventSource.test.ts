import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId, MediumEnum } from '@podverse/helpers';
import type { DTOChannel, DTOQueue } from '@podverse/helpers/dto';
import { getQueueForMedium } from '@podverse/helpers/queue';
import type { PlaybackTarget } from '@podverse/playback-core';

import {
  nowPlayingResourceFromTarget,
  playbackEventFromBackgroundTransition,
  playbackEventFromDiscreteSignal,
  playbackEventFromProgressSample,
  playbackEventPayloadForTarget,
  playbackMediumIdFromTarget,
  shouldClaimActiveQueueForPlaybackEvent,
  shouldPostNowPlayingImmediately,
} from './playbackEventSource';

const FEED_URL = 'https://example.com/feed.xml';

const addByRssTarget = (resourceData: Record<string, unknown>): PlaybackTarget => ({
  kind: 'add-by-rss',
  resourceData: {
    channel_id_text: 'device-channel-1',
    feed_url: FEED_URL,
    guid: 'episode-guid-1',
    title: 'Add by RSS Episode',
    ...resourceData,
  },
});

describe('playbackEventSource', () => {
  it('maps discrete playback signals directly to event kinds', () => {
    expect(playbackEventFromDiscreteSignal('play')).toBe('play');
    expect(playbackEventFromDiscreteSignal('pause')).toBe('pause');
    expect(playbackEventFromDiscreteSignal('seek')).toBe('seek');
    expect(playbackEventFromDiscreteSignal('skip')).toBe('skip');
    expect(playbackEventFromDiscreteSignal('complete')).toBe('complete');
    expect(playbackEventFromDiscreteSignal('sleep_timer_stop')).toBe('sleep_timer_stop');
    expect(playbackEventFromDiscreteSignal('queue_add')).toBe('queue_add');
    expect(playbackEventFromDiscreteSignal('queue_remove')).toBe('queue_remove');
    expect(playbackEventFromDiscreteSignal('queue_reorder')).toBe('queue_reorder');
  });

  it('never constructs progress events while paused or backgrounded paused', () => {
    expect(playbackEventFromProgressSample({ isPlaying: false })).toBeNull();
    expect(playbackEventFromBackgroundTransition({ isPlaying: false })).toBeNull();
  });

  it('classifies playing progress and background flush as progress_tick', () => {
    expect(playbackEventFromProgressSample({ isPlaying: true })).toBe('progress_tick');
    expect(playbackEventFromBackgroundTransition({ isPlaying: true })).toBe('progress_tick');
  });

  it('posts discrete position events immediately and only claims active queue on play', () => {
    expect(shouldPostNowPlayingImmediately('play')).toBe(true);
    expect(shouldPostNowPlayingImmediately('pause')).toBe(true);
    expect(shouldPostNowPlayingImmediately('seek')).toBe(true);
    expect(shouldPostNowPlayingImmediately('skip')).toBe(true);
    expect(shouldPostNowPlayingImmediately('complete')).toBe(true);
    expect(shouldPostNowPlayingImmediately('sleep_timer_stop')).toBe(true);
    expect(shouldPostNowPlayingImmediately('progress_tick')).toBe(false);
    expect(shouldClaimActiveQueueForPlaybackEvent('play')).toBe(true);
    expect(shouldClaimActiveQueueForPlaybackEvent('progress_tick')).toBe(false);
  });
});

describe('Add by RSS playback events', () => {
  it('records an Add by RSS episode under its feed URL plus guid id', () => {
    const resource = nowPlayingResourceFromTarget(addByRssTarget({}));

    expect(resource).toEqual({
      resourceIdText: getAddByRSSHashId({ feed_url: FEED_URL, guid: 'episode-guid-1' }),
      resourceKind: 'add_by_rss',
    });
  });

  it('hashes the canonical feed URL, so typed credentials never change the id', () => {
    const withUserinfo = nowPlayingResourceFromTarget(
      addByRssTarget({ feed_url: 'https://user:secret@example.com/feed.xml' })
    );

    expect(withUserinfo?.resourceIdText).toBe(
      nowPlayingResourceFromTarget(addByRssTarget({}))?.resourceIdText
    );
  });

  it('records nothing for livestreams, Add by RSS livestreams included', () => {
    expect(nowPlayingResourceFromTarget(addByRssTarget({ liveItem: { status: 'live' } }))).toBe(
      null
    );
    expect(
      nowPlayingResourceFromTarget(addByRssTarget({ livestream_item: { title: 'Live' } }))
    ).toBe(null);

    const channel = { id_text: 'channel-1', medium_id: MediumEnum.Podcast } as DTOChannel;
    expect(nowPlayingResourceFromTarget({ channel, item: null, kind: 'livestream' })).toBe(null);
  });

  it('carries the canonical resource data next to any stats payload', () => {
    const payload = playbackEventPayloadForTarget(
      addByRssTarget({ feed_url: 'https://user:secret@example.com/feed.xml' }),
      { stats_targets: { item_id_text: 'unused' } }
    );

    expect(payload).toEqual({
      add_by_rss_resource_data: {
        channel_id_text: 'device-channel-1',
        feed_url: FEED_URL,
        guid: 'episode-guid-1',
        title: 'Add by RSS Episode',
      },
      stats_targets: { item_id_text: 'unused' },
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('leaves the payload alone for linked resources', () => {
    const channel = { id_text: 'channel-1', medium_id: MediumEnum.Podcast } as DTOChannel;
    const target: PlaybackTarget = { channel, item: null, kind: 'livestream' };

    expect(playbackEventPayloadForTarget(target, undefined)).toBeUndefined();
  });

  it('writes an Add by RSS episode with no medium to the podcast queue', () => {
    const queues = [
      { id_text: 'queue-music', medium_id: MediumEnum.Music },
      { id_text: 'queue-av', medium_id: MediumEnum.AV },
    ] as DTOQueue[];

    const mediumId = playbackMediumIdFromTarget(addByRssTarget({ medium_id: null }));

    expect(mediumId).toBe(MediumEnum.Podcast);
    expect(getQueueForMedium(queues, mediumId)?.id_text).toBe('queue-av');
    expect(playbackMediumIdFromTarget(addByRssTarget({ medium_id: MediumEnum.Music }))).toBe(
      MediumEnum.Music
    );
  });
});
