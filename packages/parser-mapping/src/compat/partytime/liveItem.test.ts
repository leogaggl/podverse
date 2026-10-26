import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '@podverse/helpers';

import type { Phase4PodcastLiveItem } from '../../types/partytime.js';
import { Phase4LiveStatus } from '../../types/partytime.js';
import { compatLiveItemsDtos } from './liveItem.js';

const liveItem = (
  status: Phase4LiveStatus | string | undefined,
  guid: string
): Omit<Phase4PodcastLiveItem, 'status'> & { status?: string } => ({
  guid,
  enclosure: { url: 'https://example.com/live.mp3', type: 'audio/mpeg', length: 1 },
  status,
  start: new Date('2026-01-01T00:00:00.000Z'),
  contentLinks: [],
});

/**
 * The parsed live-item type only lists pending, live, and ended. A feed can still omit status
 * or send another value, and that fixture has to enter through the public parameter.
 */
const parsedLiveItems = (
  items: ReadonlyArray<Omit<Phase4PodcastLiveItem, 'status'> & { status?: string }>
): Phase4PodcastLiveItem[] => {
  return items as Phase4PodcastLiveItem[];
};

describe('compatLiveItemsDtos', () => {
  it('keeps a live item whose status is live, pending, or ended', () => {
    const dtos = compatLiveItemsDtos(
      parsedLiveItems([
        liveItem(Phase4LiveStatus.Live, 'live'),
        liveItem(Phase4LiveStatus.Pending, 'pending'),
        liveItem(Phase4LiveStatus.Ended, 'ended'),
      ])
    );

    expect(dtos.map((dto) => dto.liveItem.live_item_status)).toEqual([
      LiveItemStatusEnum.Live,
      LiveItemStatusEnum.Pending,
      LiveItemStatusEnum.Ended,
    ]);
  });

  it('omits a live item with no status', () => {
    const dtos = compatLiveItemsDtos(parsedLiveItems([liveItem(undefined, 'missing-status')]));

    expect(dtos).toEqual([]);
  });

  it('omits a live item whose status is not pending, live, or ended', () => {
    const dtos = compatLiveItemsDtos(parsedLiveItems([liveItem('replay', 'unrecognized')]));

    expect(dtos).toEqual([]);
  });
});
