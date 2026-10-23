import { StatsListenerService } from '@orm/services/stats/listenerIdentity/statsListener.js';
import { isListenerFlagged } from '@orm/services/stats/listenerIdentity/statsListenerFlags.js';
import {
  isInOptOutCooldown,
  lockListener,
  queryRows,
  readTrackingConsentForUpdate,
  readTransactionNow,
  runListenerWrite,
  utcDayBounds,
} from '@orm/services/stats/listenerIdentity/statsWriteGuard.js';
import type { EntityManager } from 'typeorm';

import type { PopularityOpenResult } from '@podverse/helpers';
import { subtractDays } from '@podverse/helpers';

export type StatsOpenTarget =
  { kind: 'account'; id_text: string } | { kind: 'playlist'; id_text: string };

export type StatsOpenReport = {
  account_id: number;
  /** The agreement version the account must have accepted for this open to count. */
  agreement_version: string;
  /** Counted opens allowed per listener per UTC day, profiles and playlists together. */
  daily_cap: number;
  /**
   * Days after an opt-out during which the opener's opens are not recorded. Also the number of
   * days in which one opener adds to a profile's or playlist's all-time total at most once.
   */
  all_time_recount_days: number;
  target: StatsOpenTarget;
};

type OpenedEntity = {
  kind: StatsOpenTarget['kind'];
  id: number;
  /** The profile itself, or the account that owns the playlist. */
  ownerAccountId: number;
};

const OPEN_TABLES: Record<StatsOpenTarget['kind'], { column: string; dailyTable: string }> = {
  account: { column: 'account_id', dailyTable: 'stats_daily_account' },
  playlist: { column: 'playlist_id', dailyTable: 'stats_daily_playlist' },
};

async function resolveOpenTarget(
  manager: EntityManager,
  target: StatsOpenTarget
): Promise<OpenedEntity | null> {
  if (target.kind === 'account') {
    const [row] = await queryRows(manager, 'SELECT id FROM account WHERE id_text = $1', [
      target.id_text,
    ]);
    const id = row?.id;
    return typeof id === 'number' ? { kind: 'account', id, ownerAccountId: id } : null;
  }

  const [row] = await queryRows(manager, 'SELECT id, account_id FROM playlist WHERE id_text = $1', [
    target.id_text,
  ]);
  const id = row?.id;
  const ownerAccountId = row?.account_id;
  return typeof id === 'number' && typeof ownerAccountId === 'number'
    ? { kind: 'playlist', id, ownerAccountId }
    : null;
}

/**
 * Records profile and playlist opens in the listener identity zone: once per opener, entity, and
 * UTC day, and at most `daily_cap` counted opens per listener and UTC day, counted in the
 * anonymous daily totals and never in taste rows. Opening your own profile or playlist counts
 * nothing. For `all_time_recount_days` after an opt-out, opens store nothing and still answer
 * `counted`. A flagged opener's opens are stored, use up the same daily cap, and count toward no
 * daily total; the answers do not change. A counted open adds to the profile's or playlist's
 * all-time total when it starts a new `all_time_recount_days` period for the opener. Callers pass
 * an `account_id` and get back a `PopularityOpenResult`; the listener id never leaves this module.
 * Contracts: docs/features/POPULARITY-AND-TASTE-PROFILE.md.
 */
export class StatsOpenWriteService {
  private readonly listenerService = new StatsListenerService();

  async recordOpen(report: StatsOpenReport): Promise<PopularityOpenResult> {
    return runListenerWrite(async (manager) => {
      const consent = await readTrackingConsentForUpdate(
        manager,
        report.account_id,
        report.agreement_version
      );
      if (!consent.allowed) {
        return 'not_allowed';
      }
      const now = await readTransactionNow(manager);

      const opened = await resolveOpenTarget(manager, report.target);
      if (opened === null) {
        return 'not_found';
      }
      if (opened.ownerAccountId === report.account_id) {
        return 'own_content';
      }
      // Opens never feed taste, so a cooldown open has nothing to keep.
      if (isInOptOutCooldown(consent.optedOutAt, now, report.all_time_recount_days)) {
        return 'counted';
      }

      const listenerId =
        (await this.listenerService.findListenerId(report.account_id, manager)) ??
        (await this.listenerService.getOrCreateListenerId(report.account_id, manager));
      await lockListener(manager, listenerId);
      const flagged = await isListenerFlagged(manager, listenerId);
      const today = utcDayBounds(now);
      const { column, dailyTable } = OPEN_TABLES[opened.kind];

      const [openDay] = await queryRows(
        manager,
        `SELECT count(*)::int AS open_count,
                COALESCE(bool_or(${column} = $4), false) AS opened
           FROM stats_open_event
          WHERE listener_id = $1 AND created_at >= $2 AND created_at < $3`,
        [listenerId, today.start, today.end, opened.id]
      );
      if (openDay?.opened === true) {
        return 'unchanged';
      }
      const openCount = typeof openDay?.open_count === 'number' ? openDay.open_count : 0;
      if (openCount >= report.daily_cap) {
        return 'daily_cap_reached';
      }

      let allTimeCounted = false;
      if (!flagged) {
        const [period] = await queryRows(
          manager,
          `SELECT 1 AS counted
             FROM stats_open_event
            WHERE listener_id = $1 AND ${column} = $2 AND all_time_counted AND created_at >= $3
            LIMIT 1`,
          [listenerId, opened.id, subtractDays(now, report.all_time_recount_days)]
        );
        allTimeCounted = period === undefined;
      }

      await manager.query(
        `INSERT INTO stats_open_event
           (created_at, listener_id, ${column}, popularity_counted, all_time_counted)
         VALUES ($1, $2, $3, $4, $5)`,
        [now, listenerId, opened.id, !flagged, allTimeCounted]
      );
      if (!flagged) {
        await manager.query(
          `INSERT INTO ${dailyTable} (${column}, day, listener_count, all_time_listener_count)
           VALUES ($1, $2::date, 1, $3)
           ON CONFLICT (${column}, day) DO UPDATE SET
             listener_count = ${dailyTable}.listener_count + EXCLUDED.listener_count,
             all_time_listener_count =
               ${dailyTable}.all_time_listener_count + EXCLUDED.all_time_listener_count`,
          [opened.id, today.day, allTimeCounted ? 1 : 0]
        );
      }
      return 'counted';
    });
  }
}
