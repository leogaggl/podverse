import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_PLAYBACK_STREAM_EVENT,
  getQueueMediumIdFromMediumId,
  MediumEnum,
} from '@podverse/helpers';

import { crossDevicePlaybackStore } from '../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { useAddByRSSPositionSave } from '../useAddByRSSPositionSave';

const hoisted = vi.hoisted(() => {
  const api = {
    reqQueueResourceItemAddByRSSAddNowPlaying: vi.fn(() => Promise.resolve()),
    reqQueueResourceItemAddByRSSAddHistory: vi.fn(() => Promise.resolve()),
  };

  return {
    api,
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
    queues: [
      {
        id: 1,
        id_text: 'queue-1',
        medium_id: getQueueMediumIdFromMediumId(MediumEnum.Podcast),
      },
    ],
  }),
}));

vi.mock('../../contexts/MediaPlayer', () => ({
  useMediaPlayer: () => ({
    mpAddByRSS: {
      idText: 'feed-1',
      resourceData: {
        medium_id: MediumEnum.Podcast,
        title: 'Example feed item',
      },
    },
  }),
}));

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

describe('useAddByRSSPositionSave', () => {
  afterEach(() => {
    crossDevicePlaybackStore.reset({ accountId: null, enabled: false });
  });

  beforeEach(() => {
    hoisted.api.reqQueueResourceItemAddByRSSAddNowPlaying.mockClear();
    hoisted.api.reqQueueResourceItemAddByRSSAddHistory.mockClear();
  });

  it('skips add-by-RSS progress ticks when playback is paused', async () => {
    const { result } = renderHook(() => useAddByRSSPositionSave());

    await act(async () => {
      result.current.savePosition(15, 'progress_tick', false);
      await Promise.resolve();
    });

    expect(hoisted.api.reqQueueResourceItemAddByRSSAddNowPlaying).not.toHaveBeenCalled();
  });

  it('stamps add-by-RSS now-playing writes with timestamp and event kind', async () => {
    const { result } = renderHook(() => useAddByRSSPositionSave());

    await act(async () => {
      result.current.savePosition(42, 'pause');
      await Promise.resolve();
    });

    expect(hoisted.api.reqQueueResourceItemAddByRSSAddNowPlaying).toHaveBeenCalledWith(
      'queue-1',
      expect.objectContaining({
        playback_position: '42',
        playback_event_kind: 'pause',
        last_played_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('saves no position and adds no history while another device is the active playback device', async () => {
    setRoleRemote();
    expect(crossDevicePlaybackStore.getSnapshot().role).toBe('remote');
    const { result } = renderHook(() => useAddByRSSPositionSave());

    await act(async () => {
      result.current.savePosition(42, 'pause');
      await result.current.handleEnded(600);
    });

    expect(hoisted.api.reqQueueResourceItemAddByRSSAddNowPlaying).not.toHaveBeenCalled();
    expect(hoisted.api.reqQueueResourceItemAddByRSSAddHistory).not.toHaveBeenCalled();
  });
});
