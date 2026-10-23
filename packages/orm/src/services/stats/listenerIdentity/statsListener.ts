import { AppDataSourceReadWrite } from '@orm/db/index.js';
import { StatsListener } from '@orm/entities/stats/statsListener.js';
import type { EntityManager } from 'typeorm';

/**
 * Services in this directory are the only code that reads `stats_listener`. This class is not
 * exported from `@podverse/orm`. Services here that the index exports take an `account_id` and
 * never return a listener id. See docs/features/POPULARITY-TRACKING.md.
 */
export class StatsListenerService {
  async getOrCreateListenerId(account_id: number, manager?: EntityManager): Promise<string> {
    const result = await this.entityManager(manager)
      .createQueryBuilder()
      .insert()
      .into(StatsListener)
      .values({ account_id })
      .orUpdate(['account_id'], ['account_id'])
      .returning(['listener_id'])
      .execute();

    return listenerIdFromInsertRaw(result.raw);
  }

  async findListenerId(account_id: number, manager?: EntityManager): Promise<string | null> {
    const row = await this.entityManager(manager).findOne(StatsListener, {
      where: { account_id },
      select: { listener_id: true },
    });
    return row === null ? null : row.listener_id;
  }

  /**
   * Deletes the account's listener row. The cascade removes that listener's listen events, open
   * events, taste rows, and hidden rows. Daily and range totals stay.
   */
  async deleteForAccount(account_id: number, manager?: EntityManager): Promise<boolean> {
    const result = await this.entityManager(manager).delete(StatsListener, { account_id });
    return (result.affected ?? 0) > 0;
  }

  private entityManager(manager?: EntityManager): EntityManager {
    return manager ?? AppDataSourceReadWrite.manager;
  }
}

function listenerIdFromInsertRaw(raw: unknown): string {
  if (!Array.isArray(raw)) {
    throw new Error('stats listener: insert returned no listener id');
  }

  const row: unknown = raw[0];
  if (!isListenerIdRow(row)) {
    throw new Error('stats listener: insert returned no listener id');
  }
  return row.listener_id;
}

function isListenerIdRow(value: unknown): value is { listener_id: string } {
  if (typeof value !== 'object' || value === null || !('listener_id' in value)) {
    return false;
  }
  return typeof value.listener_id === 'string';
}
