import type { Account } from '@orm/entities/account/account.js';
import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type {
  AccountContentLogFollowOutcome,
  AccountContentLogReason,
  AccountContentLogType,
} from '@podverse/helpers';
import { DATABASE_CONSTANTS } from '@podverse/helpers';

/**
 * One row per account, log type, and show. Writers upsert on the unique key so a later event for
 * the same show updates the row instead of adding another.
 */
@Entity('account_content_log')
@Unique('account_content_log_account_type_channel_key', [
  'account_id',
  'log_type',
  'channel_id_text',
])
@Index('account_content_log_account_updated_idx', ['account_id', 'updated_at'])
@Index('account_content_log_updated_at_idx', ['updated_at'])
@Check('account_content_log_type_check', `"log_type" IN ('removed_content')`)
@Check('account_content_log_reason_check', `"reason" IN ('left_directory', 'taken_down')`)
@Check(
  'account_content_log_follow_outcome_check',
  `"follow_outcome" IS NULL OR "follow_outcome" IN ('ended', 'moved_to_add_by_rss')`
)
@Check('account_content_log_counts_check', `"clip_count" >= 0 AND "playlist_entry_count" >= 0`)
export class AccountContentLog {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'integer' })
  account_id!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @Column({ type: 'varchar', length: 32 })
  log_type!: AccountContentLogType;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.nano_id_v2 })
  channel_id_text!: string;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_normal, nullable: true })
  channel_title!: string | null;

  @Column({ type: 'varchar', length: 32 })
  reason!: AccountContentLogReason;

  @Column({ type: 'varchar', length: 32, nullable: true })
  follow_outcome!: AccountContentLogFollowOutcome | null;

  @Column({ type: 'integer', default: 0 })
  clip_count!: number;

  @Column({ type: 'integer', default: 0 })
  playlist_entry_count!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
