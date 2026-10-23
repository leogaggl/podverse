const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

export type DailyListenerPoint = { day: string; listener_count: number };

export type PopularityCountRow = {
  id: number;
  title: string | null;
  day_count: number;
  week_count: number;
  month_count: number;
  all_time_count: number;
};

export function utcTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * UTC calendar date `days` before `todayUtc`. The daily series and the detail query share
 * this so the chart window and the `day >=` bound are the same date.
 */
export function utcDateDaysBefore(todayUtc: string, days: number): string {
  return shiftUtcCalendarDay(todayUtc, -days);
}

export function buildDailyListenerSeries(
  rows: readonly { day: string; listener_count: number }[],
  todayUtc: string,
  lookbackDays: number
): DailyListenerPoint[] {
  const listenerCountByDay = new Map<string, number>();
  for (const row of rows) {
    listenerCountByDay.set(row.day, row.listener_count);
  }

  const points: DailyListenerPoint[] = [];
  for (let daysBeforeToday = lookbackDays; daysBeforeToday >= 0; daysBeforeToday -= 1) {
    const day = shiftUtcCalendarDay(todayUtc, -daysBeforeToday);
    const listenerCount = listenerCountByDay.get(day);
    points.push({
      day,
      listener_count: listenerCount === undefined ? 0 : listenerCount,
    });
  }
  return points;
}

export function readPopularityCountRow(value: unknown): PopularityCountRow {
  if (!isRecord(value)) {
    throw new Error('Expected a popularity row');
  }
  return {
    id: readFiniteCount(value.id),
    title: readNullableTitle(value.title),
    day_count: readFiniteCount(value.day_count),
    week_count: readFiniteCount(value.week_count),
    month_count: readFiniteCount(value.month_count),
    all_time_count: readFiniteCount(value.all_time_count),
  };
}

export function readPopularityListRow(
  value: unknown
): PopularityCountRow & { range_count: number } {
  const counts = readPopularityCountRow(value);
  if (!isRecord(value)) {
    throw new Error('Expected a popularity row');
  }
  return {
    ...counts,
    range_count: readFiniteCount(value.range_count),
  };
}

export function readDailyListenerQueryRow(value: unknown): {
  day: string;
  listener_count: number;
} {
  if (!isRecord(value)) {
    throw new Error('Expected a daily listener row');
  }
  return {
    day: readCalendarDay(value.day),
    listener_count: readFiniteCount(value.listener_count),
  };
}

export function readQueryTotal(value: unknown): number {
  if (!isRecord(value)) {
    throw new Error('Expected a count row');
  }
  return readFiniteCount(value.total);
}

function shiftUtcCalendarDay(day: string, deltaDays: number): string {
  const match = CALENDAR_DAY.exec(day);
  if (match === null) {
    throw new Error('Expected a calendar day');
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, monthIndex, date));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

function readFiniteCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expected a finite number');
  }
  return value;
}

function readNullableTitle(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new Error('Expected title to be a string or null');
}

function readCalendarDay(value: unknown): string {
  if (typeof value === 'string' && CALENDAR_DAY.test(value)) {
    return value.slice(0, 10);
  }
  throw new Error('Expected a calendar day');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
