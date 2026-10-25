import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DTOItem } from '@podverse/helpers';
import { ACCOUNT_PLAYBACK_STREAM_EVENT, MediumEnum } from '@podverse/helpers';

import { crossDevicePlaybackStore } from '../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { useQueueResourcesMoveNowPlayingToHistory } from '../useQueueResourceMoveNowPlayingToHistory';

const hoisted = vi.hoisted(() => {
  const api = {
    reqQueueResourceClipAddHistory: vi.fn(() => Promise.resolve()),
    reqQueueResourceItemSoundbiteAddHistory: vi.fn(() => Promise.resolve()),
    reqQueueResourceItemAddHistory: vi.fn(() => Promise.resolve()),
  };

  return {
    api,
    updateAbridgedIndex: vi.fn(),
  };
});

vi.mock('../../factories/apiRequestService', () => ({
  getApiRequestService: () => hoisted.api,
}));

vi.mock('../../contexts/Account', () => ({
  useAccount: () => ({
    loggedInAccount: { id: 1 },
  }),
}));

vi.mock('../../contexts/Queue', () => ({
  useQueues: () => ({
    activeQueue: {
      id: 1,
      id_text: 'queue-1',
    },
  }),
}));

vi.mock('../useQueueResourcesAbridgedIndexUpdate', () => ({
  useQueueResourcesAbridgedIndexUpdate: () => hoisted.updateAbridgedIndex,
}));

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

describe('useQueueResourcesMoveNowPlayingToHistory', () => {
  afterEach(() => {
    crossDevicePlaybackStore.reset({ accountId: null, enabled: false });
  });

  beforeEach(() => {
    hoisted.api.reqQueueResourceClipAddHistory.mockClear();
    hoisted.api.reqQueueResourceItemSoundbiteAddHistory.mockClear();
    hoisted.api.reqQueueResourceItemAddHistory.mockClear();
    hoisted.updateAbridgedIndex.mockClear();
  });

  it('posts complete when moving ended now-playing item to history', async () => {
    const { result } = renderHook(() => useQueueResourcesMoveNowPlayingToHistory());

    await act(async () => {
      await result.current({
        completed: true,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
      });
    });

    expect(hoisted.api.reqQueueResourceItemAddHistory).toHaveBeenCalledWith(
      'queue-1',
      'item-10',
      expect.objectContaining({
        completed: true,
        playback_position: '0',
        playback_event_kind: 'complete',
        last_played_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('posts skip when moving manually skipped now-playing item to history', async () => {
    const { result } = renderHook(() => useQueueResourcesMoveNowPlayingToHistory());

    await act(async () => {
      await result.current({
        completed: false,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
      });
    });

    expect(hoisted.api.reqQueueResourceItemAddHistory).toHaveBeenCalledWith(
      'queue-1',
      'item-10',
      expect.objectContaining({
        completed: false,
        playback_event_kind: 'skip',
        last_played_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('writes nothing while another device is the active playback device', async () => {
    setRoleRemote();
    expect(crossDevicePlaybackStore.getSnapshot().role).toBe('remote');
    const { result } = renderHook(() => useQueueResourcesMoveNowPlayingToHistory());

    await act(async () => {
      await result.current({
        completed: true,
        mpClip: null,
        mpItem: item,
        mpItemSoundbite: null,
      });
    });

    expect(hoisted.api.reqQueueResourceItemAddHistory).not.toHaveBeenCalled();
    expect(hoisted.updateAbridgedIndex).not.toHaveBeenCalled();
  });
});
