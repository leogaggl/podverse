import { subtractDays } from '@podverse/helpers';

/** Months past the current UTC month that always have an event partition. */
export const STATS_EVENT_PARTITION_MONTHS_AHEAD = 2;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const formatUtcDate = (year: number, monthIndex: number, day: number): string => {
  const normalized = new Date(Date.UTC(year, monthIndex, day));
  return (
    `${normalized.getUTCFullYear()}-${pad2(normalized.getUTCMonth() + 1)}-` +
    pad2(normalized.getUTCDate())
  );
};

/** `YYYY-MM-DD` for the UTC calendar day containing `instant`. */
export function getUtcDateString(instant: Date): string {
  return formatUtcDate(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
}

/** `YYYY-MM-01` for the UTC month containing `instant`. */
export function getUtcMonthStart(instant: Date): string {
  return formatUtcDate(instant.getUTCFullYear(), instant.getUTCMonth(), 1);
}

/** The UTC month containing `now` and the `monthsAhead` months after it, as `YYYY-MM-01`. */
export function getStatsEventPartitionMonthStarts(now: Date, monthsAhead: number): string[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStarts: string[] = [];
  for (let offset = 0; offset <= monthsAhead; offset += 1) {
    monthStarts.push(formatUtcDate(year, month + offset, 1));
  }
  return monthStarts;
}

/**
 * First day of the UTC month containing `now − retentionDays`; partitions ending on or before it
 * hold only expired rows.
 */
export function getStatsEventRetentionCutoff(now: Date, retentionDays: number): string {
  return getUtcMonthStart(subtractDays(now, retentionDays));
}
