import type { Account } from '@orm/entities/account/account.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Anonymous count of distinct listeners per UTC day for the account profile that was opened.
 * Filled at write time and never decremented.
 */
@Entity('stats_daily_account')
export class StatsDailyAccount {
  @PrimaryColumn({ type: 'integer' })
  account_id!: number;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'integer', default: 0 })
  listener_count!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;
}
