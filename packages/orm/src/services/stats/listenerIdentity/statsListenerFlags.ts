import { queryRows, utcDayBounds } from '@orm/services/stats/listenerIdentity/statsWriteGuard.js';
import type { EntityManager } from 'typeorm';

import type { PopularityFlagReason } from '@podverse/helpers';
import {
  isStoredCapReachedFast,
  POPULARITY_FLAG_TOO_SOON_RUN_GAP_MINUTES,
} from '@podverse/helpers';

/*
 * The flag and signal steps the listen and open write paths share. Flags and the too-soon run are
 * kept by listener id until the account is deleted. This module is not exported from
 * `@podverse/orm`; every function runs under the caller's `lockListener` and returns no listener
 * id. Contracts: docs/features/POPULARITY-AND-TASTE-PROFILE.md.
 */

const ONE_MINUTE_MS = 60_000;

const FLAGGED_SQL = `SELECT 1 AS flagged
  FROM stats_flagged_listener
  WHERE listener_id = $1 AND cleared_at IS NULL`;

const FLAG_LISTENER_SQL = `INSERT INTO stats_flagged_listener AS f (listener_id, reason, flagged_at)
  VALUES ($1, $2, $3)
  ON CONFLICT (listener_id) DO UPDATE SET
    reason = EXCLUDED.reason,
    flagged_at = EXCLUDED.flagged_at,
    times_flagged = f.times_flagged + 1,
    cleared_at = NULL,
    cleared_by_admin_id = NULL
  WHERE f.cleared_at IS NOT NULL AND f.cleared_at < $4`;

const TOO_SOON_MINUTE_SQL = `INSERT INTO stats_flag_signal AS s (listener_id, too_soon_minutes, last_too_soon_minute)
  VALUES ($1, 1, $2)
  ON CONFLICT (listener_id) DO UPDATE SET
    too_soon_minutes = CASE
      WHEN EXCLUDED.last_too_soon_minute > s.last_too_soon_minute + make_interval(mins => $3::int)
        THEN 1
      WHEN EXCLUDED.last_too_soon_minute > s.last_too_soon_minute
        THEN s.too_soon_minutes + 1
      ELSE s.too_soon_minutes
    END,
    last_too_soon_minute = GREATEST(s.last_too_soon_minute, EXCLUDED.last_too_soon_minute)
  RETURNING too_soon_minutes`;

/** Whether the listener has an uncleared flag. */
export async function isListenerFlagged(
  manager: EntityManager,
  listenerId: string
): Promise<boolean> {
  const rows = await queryRows(manager, FLAGGED_SQL, [listenerId]);
  return rows.length > 0;
}

/**
 * Flags the listener. An uncleared flag stays as it is. A cleared flag comes back only when it was
 * cleared before the UTC day of `now`, so an admin's clear holds for the rest of that day.
 */
export async function flagListener(
  manager: EntityManager,
  listenerId: string,
  reason: PopularityFlagReason,
  now: Date
): Promise<void> {
  await manager.query(FLAG_LISTENER_SQL, [listenerId, reason, now, utcDayBounds(now).start]);
}

/**
 * Adds the minute of `now` to the listener's run of too-soon minutes and flags the listener when
 * the run reaches `threshold`. A threshold of 0 writes nothing.
 *
 * A report in the run's last minute keeps the run as it is, and so does a transaction whose
 * `now()` is a moment earlier than the one that wrote the row (it waited on the listener lock).
 */
export async function recordTooSoonMinute(
  manager: EntityManager,
  listenerId: string,
  now: Date,
  threshold: number
): Promise<void> {
  if (threshold <= 0) {
    return;
  }
  const minute = new Date(Math.floor(now.getTime() / ONE_MINUTE_MS) * ONE_MINUTE_MS);
  const [row] = await queryRows(manager, TOO_SOON_MINUTE_SQL, [
    listenerId,
    minute,
    POPULARITY_FLAG_TOO_SOON_RUN_GAP_MINUTES,
  ]);
  const runMinutes = row?.too_soon_minutes;
  if (typeof runMinutes === 'number' && runMinutes >= threshold) {
    await flagListener(manager, listenerId, 'too_soon_minutes', now);
  }
}

/**
 * Flags the listener when the listen that just reached the stored daily cap was stored within
 * `withinHours` of the day's first stored listen. A window of 0 writes nothing.
 */
export async function recordStoredCapReached(
  manager: EntityManager,
  listenerId: string,
  firstStoredAt: Date,
  now: Date,
  withinHours: number
): Promise<void> {
  if (isStoredCapReachedFast({ firstStoredAt, reachedAt: now, withinHours })) {
    await flagListener(manager, listenerId, 'stored_cap_reached', now);
  }
}
