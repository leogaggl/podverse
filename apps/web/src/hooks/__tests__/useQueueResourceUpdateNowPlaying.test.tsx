import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import {
  ACCOUNT_PLAYBACK_STREAM_EVENT,
  getQueueMediumIdFromMediumId,
  MediumEnum,
} from '@podverse/helpers';

import { crossDevicePlaybackStore } from '../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { useQueueResourcesUpdateNowPlaying } from '../useQueueResourceUpdateNowPlaying';

const hoisted = vi.hoisted(() => {
  const api = {
    reqQueueUpdateIsActiveQueue: vi.fn(),
    reqQueueResourceClipAddNowPlaying: vi.fn(() => Promise.resolve()),
    reqQueueResourceItemSoundbiteAddNowPlaying: vi.fn(() => Promise.resolve()),
    reqQueueResourceItemAddNowPlaying: vi.fn(() => Promise.resolve()),
  };

  return {
    api,
    setActiveQueue: vi.fn(),
    updateAbridgedIndex: vi.fn(),
    setQueueResourcesAbridgedIndex: vi.fn(),
  };
});

vi.mock('../../factories/apiRequestService', () => ({
  getApiRequestService: () => hoisted.api,
}));

vi.mock('../../contexts/Config', () => ({
  useConfig: () => ({
    public: {
      cookieConsent: {
        bannerEnabled: false,
      },
    },
  }),
}));

vi.mock('../../contexts/LocalSettings', () => ({
  useLocalSettings: () => ({
    cookieConsent: null,
  }),
}));

vi.mock('../../contexts/Account', () => ({
  useAccount: () => ({
    loggedInAccount: { id: 1 },
  }),
}));

vi.mock('../../contexts/Queue', () => ({
  useQueues: () => ({
    queues: [
      {
        id: 1,
        id_text: 'queue-1',
        medium_id: getQueueMediumIdFromMediumId(MediumEnum.Podcast),
      },
    ],
    setActiveQueue: hoisted.setActiveQueue,
  }),
}));

vi.mock('../../contexts/QueueResourcesAbridgedIndex', () => ({
  useQueueResourcesAbridgedIndex: () => ({
    queueResourcesAbridgedIndex: {
      items: {},
      clips: {},
      item_soundbites: {},
      add_by_rss_resource_datas: {},
    },
    setQueueResourcesAbridgedIndex: hoisted.setQueueResourcesAbridgedIndex,
  }),
}));

vi.mock('../useQueueResourcesAbridgedIndexUpdate', () => ({
  useQueueResourcesAbridgedIndexUpdate: () => hoisted.updateAbridgedIndex,
}));

const channel: DTOChannel = {
  id: 1,
  id_text: 'channel-1',
  medium_id: MediumEnum.Podcast,
  title: 'Test channel',
} as unknown as DTOChannel;

const item: DTOItem = {
  id: 10,
  id_text: 'item-10',
  title: 'Test item',
  channel_id: 1,
} as unknown as DTOItem;

/** Puts this tab in the remote role: checked in as `session-this` while `session-other` plays. */
function setRoleRemote() {
  crossDevicePlaybackStore.reset({ accountId: 1, enabled: true });
  crossDevicePlaybackStore.applyPresenceResponse(
    { session_id_text: 'session-this', devices: { revision: 1, devices: [] }, state: null },
    Date.now()
  );
  crossDevicePlaybackStore.applyStreamEvent(
    {
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.state,
      data: {
        revision: 1,
        active_session_id_text: 'session-other',
        resource: {
          ref: { kind: 'item', item_id_text: 'item-20' },
          medium: MediumEnum.Podcast,
          title: 'Other item',
          channel_title: 'Other channel',
          image_url: null,
        },
        status: 'playing',
        is_live: false,
        position_seconds: 10,
        duration_seconds: 600,
        rate: 1,
        updated_at_ms: 0,
        sent_at_ms: 0,
      },
    },
    Date.now()
  );
}

describe('useQueueResourcesUpdateNowPlaying', () => {
  afterEach(() => {
    crossDevicePlaybackStore.reset({ accountId: null, enabled: false });
  });

  beforeEach(() => {
    hoisted.api.reqQueueUpdateIsActiveQueue.mockClear();
    hoisted.api.reqQueueResourceClipAddNowPlaying.mockClear();
    hoisted.api.reqQueueResourceItemSoundbiteAddNowPlaying.mockClear();
    hoisted.api.reqQueueResourceItemAddNowPlaying.mockClear();
    hoisted.setActiveQueue.mockClear();
    hoisted.updateAbridgedIndex.mockClear();
    hoisted.setQueueResourcesAbridgedIndex.mockClear();
  });

  it('skips progress_tick writes while paused', async () => {
    const { result } = renderHook(() => useQueueResourcesUpdateNowPlaying());

    await act(async () => {
      await result.current({
        mpChannel: channel,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
        mpCurrentTime: 32,
        eventKind: 'progress_tick',
        isPlaying: false,
      });
    });

    expect(hoisted.api.reqQueueUpdateIsActiveQueue).not.toHaveBeenCalled();
    expect(hoisted.api.reqQueueResourceItemAddNowPlaying).not.toHaveBeenCalled();
  });

  it('posts progress_tick while playing with event kind and timestamp', async () => {
    const { result } = renderHook(() => useQueueResourcesUpdateNowPlaying());

    await act(async () => {
      await result.current({
        mpChannel: channel,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
        mpDuration: 3600,
        mpCurrentTime: 120,
        eventKind: 'progress_tick',
        isPlaying: true,
      });
    });

    expect(hoisted.api.reqQueueResourceItemAddNowPlaying).toHaveBeenCalledWith(
      'queue-1',
      'item-10',
      expect.objectContaining({
        playback_position: '120',
        media_file_duration: '3600',
        playback_event_kind: 'progress_tick',
        last_played_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('posts pause writes with pause event kind and timestamp', async () => {
    const { result } = renderHook(() => useQueueResourcesUpdateNowPlaying());

    await act(async () => {
      await result.current({
        mpChannel: channel,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
        mpCurrentTime: 98,
        eventKind: 'pause',
      });
    });

    expect(hoisted.api.reqQueueResourceItemAddNowPlaying).toHaveBeenCalledWith(
      'queue-1',
      'item-10',
      expect.objectContaining({
        playback_position: '98',
        playback_event_kind: 'pause',
        last_played_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('writes nothing while another device is the active playback device', async () => {
    setRoleRemote();
    expect(crossDevicePlaybackStore.getSnapshot().role).toBe('remote');
    const { result } = renderHook(() => useQueueResourcesUpdateNowPlaying());

    await act(async () => {
      await result.current({
        mpChannel: channel,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
        mpCurrentTime: 98,
        eventKind: 'pause',
      });
    });

    expect(hoisted.api.reqQueueUpdateIsActiveQueue).not.toHaveBeenCalled();
    expect(hoisted.api.reqQueueResourceItemAddNowPlaying).not.toHaveBeenCalled();
    expect(hoisted.updateAbridgedIndex).not.toHaveBeenCalled();
    expect(hoisted.setQueueResourcesAbridgedIndex).not.toHaveBeenCalled();
  });
});
