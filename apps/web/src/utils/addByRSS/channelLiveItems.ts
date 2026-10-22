import type { ChannelLiveItemSortKey } from '@podverse/helpers';
import {
  compareChannelLiveItems,
  isLiveItemEndedAndStale,
  LiveItemStatusEnum,
} from '@podverse/helpers';

export type ChannelLiveItemTimes = {
  live_item_status?: LiveItemStatusEnum | null;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
};

export type ChannelOrderedLiveItem = {
  liveItem?: ChannelLiveItemTimes | null;
};

const hasTime = (value: string | Date | null | undefined): value is string | Date =>
  value instanceof Date || (typeof value === 'string' && value.trim() !== '');

const toFiniteTimeMs = (value: string | Date | null | undefined): number | null => {
  if (!hasTime(value)) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Livestreams on a channel page: live, then scheduled, then ended within a day.
 * An ended item whose end (or start, when it has no end) is before the one-day
 * cutoff is omitted. The instant of the cutoff is kept.
 */
export const selectChannelOrderedLiveItems = <T extends ChannelOrderedLiveItem>(
  items: readonly T[],
  now: Date = new Date()
): T[] => {
  const kept: { item: T; key: ChannelLiveItemSortKey }[] = [];
  for (const item of items) {
    const liveItem = item.liveItem;
    const statusId = liveItem?.live_item_status;
    if (
      statusId !== LiveItemStatusEnum.Live &&
      statusId !== LiveItemStatusEnum.Pending &&
      statusId !== LiveItemStatusEnum.Ended
    ) {
      continue;
    }
    const rawStart = liveItem?.start_time;
    const rawEnd = liveItem?.end_time ?? null;
    let startForStale: string | Date | null = null;
    if (hasTime(rawStart)) {
      startForStale = rawStart;
    } else if (hasTime(rawEnd)) {
      startForStale = rawEnd;
    }
    if (startForStale !== null) {
      const endForStale = hasTime(rawEnd) ? rawEnd : null;
      if (
        isLiveItemEndedAndStale(
          {
            live_item_status_id: statusId,
            start_time: startForStale,
            end_time: endForStale,
          },
          now
        )
      ) {
        continue;
      }
    }
    kept.push({
      item,
      key: {
        statusId,
        startTimeMs: toFiniteTimeMs(rawStart),
        endTimeMs: toFiniteTimeMs(rawEnd),
      },
    });
  }
  kept.sort((a, b) => compareChannelLiveItems(a.key, b.key));
  return kept.map((entry) => entry.item);
};
