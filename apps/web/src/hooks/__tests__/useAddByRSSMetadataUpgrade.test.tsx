/**
 * A loaded add-by-RSS item built from its row picks up this browser's parse of the feed: a feed
 * change replaces the metadata for the loaded identity only, and a different item stops the watch.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers';
import {
  buildAddByRSSResourceData,
  buildMinimalAddByRSSItemFromResourceData,
} from '@podverse/parser-mapping';

import type { MediaPlayerAddByRSSState } from '../../contexts/MediaPlayer';
import { emitAddByRSSFeedChanged } from '../../utils/addByRSS/feedChangedEvent';
import { addByRSSPlaybackIdentity } from '../playbackHandoffState';
import type { AddByRSSMetadataUpgradeTarget } from '../useAddByRSSMetadataUpgrade';
import { useAddByRSSMetadataUpgrade } from '../useAddByRSSMetadataUpgrade';

const hoisted = vi.hoisted(() => ({
  player: { mpAddByRSS: null as MediaPlayerAddByRSSState },
  updateMPAddByRSSMetadata: vi.fn(),
  findAddByRSSItemInStoredFeed: vi.fn(),
  hasStoredAddByRSSFeed: vi.fn(),
  enqueueAddByRSSFirstParses: vi.fn(),
  syncAddByRSSFollowStubs: vi.fn(),
}));

vi.mock('../../contexts/Account', () => ({
  useAccount: () => ({ loggedInAccount: { id_text: 'acct-1' } }),
}));

vi.mock('../../contexts/MediaPlayer', () => ({
  useMediaPlayer: () => ({
    mpAddByRSS: hoisted.player.mpAddByRSS,
    updateMPAddByRSSMetadata: hoisted.updateMPAddByRSSMetadata,
  }),
}));

vi.mock('../../utils/addByRSS/playFromQueueResource', () => ({
  findAddByRSSItemInStoredFeed: hoisted.findAddByRSSItemInStoredFeed,
  hasStoredAddByRSSFeed: hoisted.hasStoredAddByRSSFeed,
}));

vi.mock('../../utils/addByRSS/firstParse', () => ({
  enqueueAddByRSSFirstParses: hoisted.enqueueAddByRSSFirstParses,
}));

vi.mock('../../utils/addByRSS/sync', () => ({
  syncAddByRSSFollowStubs: hoisted.syncAddByRSSFollowStubs,
}));

const FEED_URL = 'https://feeds.example.com/show.xml';

const phoneRow: AddByRSSResourceData = {
  feed_url: FEED_URL,
  channel_id_text: 'phonechan1',
  guid: 'ep-1',
  id_text: 'phone-item-1',
  title: 'Episode From The Phone',
  enclosure_url: 'https://cdn.example.com/ep-1.mp3',
  duration: 60,
};

function loadedFromRow(row: AddByRSSResourceData): NonNullable<MediaPlayerAddByRSSState> {
  const minimal = buildMinimalAddByRSSItemFromResourceData(row);
  if (minimal === null) {
    throw new Error('fixture row must have an enclosure');
  }
  return { idText: minimal.idText, resourceData: buildAddByRSSResourceData(minimal) };
}

function upgradeTarget(row: AddByRSSResourceData): AddByRSSMetadataUpgradeTarget {
  const identity = addByRSSPlaybackIdentity(loadedFromRow(row).resourceData);
  if (identity === null) {
    throw new Error('fixture row must have an identity');
  }
  return { identity, feedUrl: FEED_URL, resourceData: row };
}

const parsedItem = buildMinimalAddByRSSItemFromResourceData({
  ...phoneRow,
  channel_id_text: 'webchan1',
  id_text: 'web-item-1',
  title: 'Parsed Title',
});

describe('useAddByRSSMetadataUpgrade', () => {
  beforeEach(() => {
    hoisted.player.mpAddByRSS = loadedFromRow(phoneRow);
    hoisted.updateMPAddByRSSMetadata.mockReset();
    hoisted.findAddByRSSItemInStoredFeed.mockReset().mockResolvedValue(null);
    hoisted.hasStoredAddByRSSFeed.mockReset().mockResolvedValue(true);
    hoisted.enqueueAddByRSSFirstParses.mockReset().mockResolvedValue([]);
    hoisted.syncAddByRSSFollowStubs.mockReset().mockResolvedValue(undefined);
  });

  it('replaces the metadata of the loaded identity when its feed changes', async () => {
    const { result } = renderHook(() => useAddByRSSMetadataUpgrade());

    result.current(upgradeTarget(phoneRow));
    await waitFor(() => {
      expect(hoisted.enqueueAddByRSSFirstParses).toHaveBeenCalledWith({
        accountId: 'acct-1',
        feedUrls: [FEED_URL],
      });
    });
    expect(hoisted.updateMPAddByRSSMetadata).not.toHaveBeenCalled();

    hoisted.findAddByRSSItemInStoredFeed.mockResolvedValue(parsedItem);
    emitAddByRSSFeedChanged(FEED_URL);

    await waitFor(() => {
      expect(hoisted.updateMPAddByRSSMetadata).toHaveBeenCalledTimes(1);
    });
    expect(hoisted.updateMPAddByRSSMetadata).toHaveBeenCalledWith({
      idText: 'web-item-1',
      resourceData: expect.objectContaining({ title: 'Parsed Title', id_text: 'web-item-1' }),
    });
  });

  it('does nothing on a feed change after a different item loads', async () => {
    const { result, rerender } = renderHook(() => useAddByRSSMetadataUpgrade());

    result.current(upgradeTarget(phoneRow));
    await waitFor(() => {
      expect(hoisted.enqueueAddByRSSFirstParses).toHaveBeenCalled();
    });

    hoisted.player.mpAddByRSS = loadedFromRow({ ...phoneRow, guid: 'ep-2', title: 'Other' });
    rerender();
    const lookupsBeforeChange = hoisted.findAddByRSSItemInStoredFeed.mock.calls.length;

    hoisted.findAddByRSSItemInStoredFeed.mockResolvedValue(parsedItem);
    emitAddByRSSFeedChanged(FEED_URL);
    await Promise.resolve();

    expect(hoisted.findAddByRSSItemInStoredFeed).toHaveBeenCalledTimes(lookupsBeforeChange);
    expect(hoisted.updateMPAddByRSSMetadata).not.toHaveBeenCalled();
  });

  it('keeps the row metadata and starts no parse when the account does not follow the feed', async () => {
    hoisted.hasStoredAddByRSSFeed.mockResolvedValue(false);
    const { result } = renderHook(() => useAddByRSSMetadataUpgrade());

    result.current(upgradeTarget(phoneRow));
    await waitFor(() => {
      expect(hoisted.syncAddByRSSFollowStubs).toHaveBeenCalledWith('acct-1');
    });
    await waitFor(() => {
      expect(hoisted.hasStoredAddByRSSFeed).toHaveBeenCalledTimes(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    hoisted.findAddByRSSItemInStoredFeed.mockResolvedValue(parsedItem);
    emitAddByRSSFeedChanged(FEED_URL);
    await Promise.resolve();

    expect(hoisted.enqueueAddByRSSFirstParses).not.toHaveBeenCalled();
    expect(hoisted.updateMPAddByRSSMetadata).not.toHaveBeenCalled();
  });
});
