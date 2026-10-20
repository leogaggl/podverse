/**
 * Add by RSS plays record themselves: the handoff record names the episode, the now-playing write
 * lands in the podcast queue when the feed has no medium, and the active queue refreshes after
 * the write unless another item started first.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddByRSSHashId, MediumEnum } from '@podverse/helpers';
import type { AddByRSSItemIndexItem } from '@podverse/parser-mapping';

import {
  clearPlaybackHandoffLocalState,
  readPlaybackHandoffLocalState,
} from '../playbackHandoffState';
import { usePlayAddByRSS } from '../usePlayAddByRSS';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

const hoisted = vi.hoisted(() => {
  const playbackLoadGenerationRef = { current: 0 };
  return {
    playbackLoadGenerationRef,
    applyPlaybackLoad: vi.fn(() => {
      playbackLoadGenerationRef.current += 1;
      return { initialSeekSeconds: 0 };
    }),
    reqQueueResourceItemAddByRSSAddNowPlaying: vi.fn(),
    queueResourcesLoadActive: vi.fn(),
  };
});

vi.mock('@podverse/parser-mapping', () => ({
  buildAddByRSSResourceData: (item: { idText: string; mediumId: number | null }) => ({
    feed_url: 'https://feeds.example.com/show.xml',
    guid: 'ep-1',
    id_text: item.idText,
    title: 'Add by RSS Episode',
    medium_id: item.mediumId,
  }),
  getAddByRSSHashIds: () => ['abr-hash-1'],
}));

vi.mock('../../contexts/Account', () => ({
  useAccount: () => ({ loggedInAccount: { id: 1 } }),
}));

vi.mock('../../contexts/AutoQueue', () => ({
  useAutoQueue: () => ({ setAutoQueueResources: vi.fn(), setAutoQueueActiveRow: vi.fn() }),
}));

vi.mock('../../contexts/LocalSettings', () => ({
  useLocalSettings: () => ({ preferredMediaType: null }),
}));

vi.mock('../../contexts/MediaPlayer', () => ({
  useMediaPlayer: () => ({
    applyPlaybackLoad: hoisted.applyPlaybackLoad,
    playbackLoadGenerationRef: hoisted.playbackLoadGenerationRef,
    setMPAddByRSS: vi.fn(),
    setMPChannel: vi.fn(),
    setMPClip: vi.fn(),
    setMPItem: vi.fn(),
    setMPItemChapter: vi.fn(),
    setMPItemChapters: vi.fn(),
    setMPItemChapterShouldSeek: vi.fn(),
    setMPItemSoundbite: vi.fn(),
    setMPItemLabeledItemEnclosures: vi.fn(),
    setMPEnclosureSelectedParams: vi.fn(),
    setMPShouldPlay: vi.fn(),
    setMPDuration: vi.fn(),
  }),
}));

vi.mock('../../contexts/MediaPlayerCurrentTime', () => ({
  useMediaPlayerCurrentTime: () => ({ setMPCurrentTime: vi.fn() }),
}));

vi.mock('../../contexts/Queue', () => ({
  useQueues: () => ({
    queues: [
      { id: 1, id_text: 'queue-av', medium_id: MediumEnum.AV },
      { id: 2, id_text: 'queue-music', medium_id: MediumEnum.Music },
    ],
  }),
}));

vi.mock('../../factories/apiRequestService', () => ({
  getApiRequestService: () => ({
    reqQueueResourceItemAddByRSSAddNowPlaying: hoisted.reqQueueResourceItemAddByRSSAddNowPlaying,
  }),
}));

vi.mock('../useQueueResourcesLoadActive', () => ({
  useQueueResourcesLoadActive: () => hoisted.queueResourcesLoadActive,
}));

// The fixture carries only the fields the hook reads; a parsed index item is far wider.
const indexItemWithoutMedium = {
  idText: 'abr-1',
  mediumId: null,
} as unknown as AddByRSSItemIndexItem;

describe('usePlayAddByRSS', () => {
  beforeEach(() => {
    clearPlaybackHandoffLocalState();
    hoisted.playbackLoadGenerationRef.current = 0;
    hoisted.applyPlaybackLoad.mockClear();
    hoisted.reqQueueResourceItemAddByRSSAddNowPlaying.mockReset().mockResolvedValue(undefined);
    hoisted.queueResourcesLoadActive.mockReset().mockResolvedValue(undefined);
  });

  it('writes the handoff record with the Add by RSS hash, not the id_text, when the episode loads', () => {
    const { result } = renderHook(() => usePlayAddByRSS());

    result.current(indexItemWithoutMedium, 0);

    expect(readPlaybackHandoffLocalState()).toEqual({
      itemIdText: getAddByRSSHashId({
        feed_url: 'https://feeds.example.com/show.xml',
        guid: 'ep-1',
      }),
      itemTitle: 'Add by RSS Episode',
      lastPlayedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('records now-playing in the podcast queue when the feed has no medium', async () => {
    const { result } = renderHook(() => usePlayAddByRSS());

    result.current(indexItemWithoutMedium, 0);

    await waitFor(() => {
      expect(hoisted.reqQueueResourceItemAddByRSSAddNowPlaying).toHaveBeenCalledWith(
        'queue-av',
        expect.objectContaining({
          playback_event_kind: 'play',
          last_played_at: readPlaybackHandoffLocalState()?.lastPlayedAt,
        })
      );
    });
  });

  it('refreshes the active queue only after the now-playing write resolves', async () => {
    const postDeferred = createDeferred<undefined>();
    hoisted.reqQueueResourceItemAddByRSSAddNowPlaying.mockReturnValue(postDeferred.promise);
    const { result } = renderHook(() => usePlayAddByRSS());

    result.current(indexItemWithoutMedium, 0);

    await waitFor(() => {
      expect(hoisted.reqQueueResourceItemAddByRSSAddNowPlaying).toHaveBeenCalled();
    });
    expect(hoisted.queueResourcesLoadActive).not.toHaveBeenCalled();

    postDeferred.resolve(undefined);

    await waitFor(() => {
      expect(hoisted.queueResourcesLoadActive).toHaveBeenCalledWith(undefined, {
        queueIdText: 'queue-av',
      });
    });
  });

  it('skips the queue refresh when another item started before the write resolved', async () => {
    const postDeferred = createDeferred<undefined>();
    hoisted.reqQueueResourceItemAddByRSSAddNowPlaying.mockReturnValue(postDeferred.promise);
    const { result } = renderHook(() => usePlayAddByRSS());

    result.current(indexItemWithoutMedium, 0);

    await waitFor(() => {
      expect(hoisted.reqQueueResourceItemAddByRSSAddNowPlaying).toHaveBeenCalled();
    });

    hoisted.playbackLoadGenerationRef.current += 1;
    postDeferred.resolve(undefined);
    await postDeferred.promise;
    await Promise.resolve();

    expect(hoisted.queueResourcesLoadActive).not.toHaveBeenCalled();
  });
});
