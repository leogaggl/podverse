import { AppDataSourceReadWrite } from '@orm/db/index.js';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';

import { isPopularityTrackingAllowed, ONE_DAY_MS } from '@podverse/helpers';

/*
 * Steps the listen and open write paths share inside the listener identity zone. This module is
 * not exported from `@podverse/orm`. Contracts: docs/features/POPULARITY-TRACKING.md.
 */

export type UtcDayBounds = {
  /** `YYYY-MM-DD` */
  day: string;
  /** UTC midnight that starts `day`. */
  start: Date;
  /** UTC midnight that starts the next day. */
  end: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runs a statement whose result is a row list (SELECT or INSERT) and keeps the object rows.
 * TypeORM answers UPDATE and DELETE with `[rows, rowCount]`, so those do not go through here.
 */
export async function queryRows(
  manager: EntityManager,
  sql: string,
  params: readonly unknown[]
): Promise<Record<string, unknown>[]> {
  const result: unknown = await manager.query(sql, [...params]);
  return Array.isArray(result) ? result.filter(isRecord) : [];
}

/**
 * Runs one report in a single read-write transaction; the read role cannot see the listener
 * mapping. TypeORM query errors carry the statement's parameters, listener ids among them, so a
 * failed statement is rethrown with the database message only.
 */
export async function runListenerWrite<T>(
  work: (manager: EntityManager) => Promise<T>
): Promise<T> {
  try {
    return await AppDataSourceReadWrite.transaction(work);
  } catch (error) {
    if (error instanceof QueryFailedError) {
      // eslint-disable-next-line preserve-caught-error -- the cause carries listener ids in its parameters
      throw new Error(`popularity write failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Reads the account's Popularity Tracking decision `FOR SHARE` and checks it against
 * `agreementVersion`. Opting out updates this row and deletes the listener row in one transaction,
 * so a report holding the share lock cannot recreate a listener id that an opt-out removed. A
 * missing settings row does not allow tracking.
 */
export async function isTrackingAllowedForUpdate(
  manager: EntityManager,
  accountId: number,
  agreementVersion: string
): Promise<boolean> {
  const [row] = await queryRows(
    manager,
    `SELECT listen_stats_accepted, listen_stats_agreement_version
       FROM account_settings
      WHERE account_id = $1
        FOR SHARE`,
    [accountId]
  );
  if (row === undefined) {
    return false;
  }
  const accepted = row.listen_stats_accepted;
  const version = row.listen_stats_agreement_version;
  return isPopularityTrackingAllowed(
    {
      listen_stats_accepted: typeof accepted === 'boolean' ? accepted : null,
      listen_stats_agreement_version: typeof version === 'string' ? version : null,
    },
    agreementVersion
  );
}

/**
 * Serializes one listener's writes until the transaction ends. Every writer of a listener's
 * events, daily totals, taste rows, or hidden rows takes this lock, with this exact key, before
 * reading or writing them.
 */
export async function lockListener(manager: EntityManager, listenerId: string): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtextextended('popularity_listen:' || $1::text, 0))`,
    [listenerId]
  );
}

/** The transaction's `now()`: the server receive time every stored time in a report uses. */
export async function readTransactionNow(manager: EntityManager): Promise<Date> {
  const [row] = await queryRows(manager, 'SELECT now() AS now', []);
  const now = row?.now;
  if (!(now instanceof Date)) {
    throw new Error('popularity write: transaction time unavailable');
  }
  return now;
}

export function utcDayBounds(now: Date): UtcDayBounds {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    day: start.toISOString().slice(0, 10),
    start,
    end: new Date(start.getTime() + ONE_DAY_MS),
  };
}
