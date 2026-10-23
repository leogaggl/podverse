import type { Account } from '@orm/entities/account/account.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Range totals for one account, rebuilt from counted events and daily totals by the popularity
 * refresh job. The range lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.
 */
@Entity('stats_popularity_account')
export class StatsPopularityAccount {
  @PrimaryColumn({ type: 'integer' })
  account_id!: number;

  @Column({ type: 'integer', default: 0 })
  day_count!: number;

  @Column({ type: 'integer', default: 0 })
  week_count!: number;

  @Column({ type: 'integer', default: 0 })
  month_count!: number;

  @Column({ type: 'integer', default: 0 })
  all_time_count!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;
}
