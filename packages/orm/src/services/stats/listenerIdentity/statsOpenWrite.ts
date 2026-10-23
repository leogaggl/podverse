import { StatsListenerService } from '@orm/services/stats/listenerIdentity/statsListener.js';
import {
  isTrackingAllowedForUpdate,
  lockListener,
  queryRows,
  readTransactionNow,
  runListenerWrite,
  utcDayBounds,
} from '@orm/services/stats/listenerIdentity/statsWriteGuard.js';
import type { EntityManager } from 'typeorm';

import type { PopularityOpenResult } from '@podverse/helpers';

export type StatsOpenTarget =
  { kind: 'account'; id_text: string } | { kind: 'playlist'; id_text: string };

export type StatsOpenReport = {
  account_id: number;
  /** The agreement version the account must have accepted for this open to count. */
  agreement_version: string;
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
 * UTC day, counted in the anonymous daily totals and never in taste rows. Opening your own profile
 * or playlist counts nothing. Callers pass an `account_id` and get back a `PopularityOpenResult`;
 * the listener id never leaves this module. Contracts: docs/features/POPULARITY-TRACKING.md.
 */
export class StatsOpenWriteService {
  private readonly listenerService = new StatsListenerService();

  async recordOpen(report: StatsOpenReport): Promise<PopularityOpenResult> {
    return runListenerWrite(async (manager) => {
      const allowed = await isTrackingAllowedForUpdate(
        manager,
        report.account_id,
        report.agreement_version
      );
      if (!allowed) {
        return 'not_allowed';
      }

      const opened = await resolveOpenTarget(manager, report.target);
      if (opened === null) {
        return 'not_found';
      }
      if (opened.ownerAccountId === report.account_id) {
        return 'own_content';
      }

      const listenerId =
        (await this.listenerService.findListenerId(report.account_id, manager)) ??
        (await this.listenerService.getOrCreateListenerId(report.account_id, manager));
      await lockListener(manager, listenerId);
      const now = await readTransactionNow(manager);
      const today = utcDayBounds(now);
      const { column, dailyTable } = OPEN_TABLES[opened.kind];

      const [openedToday] = await queryRows(
        manager,
        `SELECT 1 AS opened
           FROM stats_open_event
          WHERE listener_id = $1 AND created_at >= $2 AND created_at < $3 AND ${column} = $4
          LIMIT 1`,
        [listenerId, today.start, today.end, opened.id]
      );
      if (openedToday !== undefined) {
        return 'unchanged';
      }

      await manager.query(
        `INSERT INTO stats_open_event (created_at, listener_id, ${column}) VALUES ($1, $2, $3)`,
        [now, listenerId, opened.id]
      );
      await manager.query(
        `INSERT INTO ${dailyTable} (${column}, day, listener_count)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (${column}, day) DO UPDATE SET
           listener_count = ${dailyTable}.listener_count + EXCLUDED.listener_count`,
        [opened.id, today.day]
      );
      return 'counted';
    });
  }
}
