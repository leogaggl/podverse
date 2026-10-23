import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { AccountNotification } from '@orm/entities/account/accountNotification.js';
import { readQueryResultRows } from '@orm/lib/queryResultRows.js';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { In, IsNull, LessThan, MoreThan } from 'typeorm';

import {
  publishAccountNotificationCreated,
  publishAccountNotificationSignals,
} from './accountNotificationSignal.js';

type CreateAccountNotificationDto = {
  account_id: number;
  category: AccountNotification['category'];
  title: string;
  body?: string | null;
  link_path?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: Date;
  expires_at?: Date;
};

type ListPaginatedForAccountParams = {
  before_created_at?: Date;
  offset?: number;
  limit?: number;
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** Ids from an `UPDATE … RETURNING id`, ascending. Accepts integer ids or digit strings. */
function readReturnedIds(value: unknown): number[] {
  const rows = readQueryResultRows(value) ?? [];
  const ids: number[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }

    const id: unknown = Reflect.get(row, 'id');
    if (typeof id === 'number' && Number.isInteger(id)) {
      ids.push(id);
    } else if (typeof id === 'string' && /^\d+$/.test(id)) {
      ids.push(Number(id));
    }
  }

  return ids.sort((a, b) => a - b);
}

export class AccountNotificationService {
  protected repositoryRead: Repository<AccountNotification>;
  protected repositoryReadWrite: Repository<AccountNotification>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(AccountNotification);
    this.repositoryReadWrite = AppDataSourceReadWrite.getRepository(AccountNotification);
  }

  /**
   * Sets read_at on the account's rows that match `matchSql` and are still unread: no read_at, and
   * created after the account's cutoff. The cutoff is read inside the same statement, so a Mark All
   * as Read that commits first leaves nothing for this to mark. Publishes one read_one signal per
   * marked row.
   */
  private async markUnreadRowsRead(
    account_id: number,
    matchSql: string,
    matchParams: unknown[]
  ): Promise<number[]> {
    const result: unknown = await this.repositoryReadWrite.query(
      `
      UPDATE account_notification AS n
      SET read_at = NOW()
      WHERE n.account_id = $1
        AND ${matchSql}
        AND n.read_at IS NULL
        AND n.created_at > COALESCE(
          (SELECT a.notifications_last_read_at FROM account AS a WHERE a.id = $1),
          '-infinity'::timestamptz
        )
      RETURNING n.id
      `,
      [account_id, ...matchParams]
    );

    const markedIds = readReturnedIds(result);
    await publishAccountNotificationSignals(
      markedIds.map((notification_id) => ({ kind: 'read_one', account_id, notification_id }))
    );
    return markedIds;
  }

  /**
   * Saves the rows, then tells every API pod about them. `save` runs outside any caller
   * transaction, so the rows are committed before the event goes out.
   */
  async createMany(dtoList: CreateAccountNotificationDto[]): Promise<AccountNotification[]> {
    if (dtoList.length === 0) {
      return [];
    }

    const rows = dtoList.map((dto) =>
      this.repositoryReadWrite.create({
        account_id: dto.account_id,
        body: dto.body ?? null,
        category: dto.category,
        created_at: dto.created_at,
        expires_at: dto.expires_at,
        link_path: dto.link_path ?? null,
        payload: dto.payload ?? null,
        title: dto.title,
      })
    );

    const saved = await this.repositoryReadWrite.save(rows);
    await publishAccountNotificationCreated(saved);
    return saved;
  }

  async listForAccountAfterId(
    account_id: number,
    after_id: number,
    limit: number
  ): Promise<AccountNotification[]> {
    return this.repositoryRead.find({
      order: { id: 'ASC' },
      take: limit,
      where: { account_id, id: MoreThan(after_id) },
    });
  }

  /** Scoped by account, so an id from another account's event never returns that account's row. */
  async getManyByIdsForAccount(account_id: number, ids: number[]): Promise<AccountNotification[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repositoryRead.find({
      order: { id: 'ASC' },
      where: { account_id, id: In(ids) },
    });
  }

  async getMaxIdForAccount(account_id: number): Promise<number | null> {
    const rows = await this.repositoryRead.find({
      order: { id: 'DESC' },
      select: { id: true },
      take: 1,
      where: { account_id },
    });

    return rows[0]?.id ?? null;
  }

  async listPaginatedForAccount(
    account_id: number,
    params?: ListPaginatedForAccountParams
  ): Promise<AccountNotification[]> {
    const limit = Math.max(1, Math.min(params?.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    const offset = Math.max(0, params?.offset ?? 0);
    const where: FindOptionsWhere<AccountNotification> = { account_id };

    if (params?.before_created_at !== undefined) {
      where.created_at = LessThan(params.before_created_at);
    }

    return this.repositoryRead.find({
      order: {
        created_at: 'DESC',
        id: 'DESC',
      },
      skip: offset,
      take: limit,
      where,
    });
  }

  /** Every row the account has, read or not. Pagination counts pages from this. */
  async countForAccount(account_id: number): Promise<number> {
    return this.repositoryRead.count({ where: { account_id } });
  }

  /**
   * Rows the account has not read: created after its Mark All as Read cutoff and not read one at a
   * time. A null cutoff means the inbox has never been marked read, so only `read_at` decides.
   */
  async countUnread(account_id: number, last_read_at: Date | null): Promise<number> {
    const where: FindOptionsWhere<AccountNotification> = {
      account_id,
      read_at: IsNull(),
    };
    if (last_read_at !== null) {
      where.created_at = MoreThan(last_read_at);
    }

    return this.repositoryRead.count({ where });
  }

  /** `found` is false when no row with this id belongs to the account. */
  async markReadById(
    account_id: number,
    notification_id: number
  ): Promise<{ found: boolean; marked_ids: number[] }> {
    const marked_ids = await this.markUnreadRowsRead(account_id, 'n.id = $2', [notification_id]);
    if (marked_ids.length > 0) {
      return { found: true, marked_ids };
    }

    const found = await this.repositoryReadWrite.existsBy({ id: notification_id, account_id });
    return { found, marked_ids };
  }

  /**
   * Marks the account's rows for one push: the parser writes `payload.itemIdText` and
   * `payload.type` from the same values it sends as push data.
   */
  async markReadByItem(account_id: number, item_id_text: string, type: string): Promise<number[]> {
    return this.markUnreadRowsRead(
      account_id,
      "n.payload->>'itemIdText' = $2 AND n.payload->>'type' = $3",
      [item_id_text, type]
    );
  }

  /**
   * Honours a row's own `expires_at`, which lets a notification declare a life shorter than the
   * retention window — a maintenance notice for a window that has closed, say.
   */
  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.repositoryReadWrite.delete({
      expires_at: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }

  /**
   * The retention ceiling, applied to rows already in the table rather than only to ones inserted
   * after the operator changed it. Shortening the window therefore takes effect on the next purge.
   */
  async deleteCreatedBefore(cutoff: Date): Promise<number> {
    const result = await this.repositoryReadWrite.delete({
      created_at: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }
}
