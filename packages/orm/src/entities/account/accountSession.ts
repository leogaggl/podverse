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

import type { AccountSessionClientType, AccountSessionRevokeReason } from '@podverse/helpers';
import { DATABASE_CONSTANTS } from '@podverse/helpers';

/**
 * One row per login on one client. Tokens name the row by `id_text`. Refresh token columns hold
 * hex SHA-256 hashes of the ids, never the ids, and stay null on web rows.
 */
@Entity('account_session')
@Unique('account_session_id_text_key', ['id_text'])
@Index('account_session_account_active_idx', ['account_id', 'last_seen_at'], {
  where: '"revoked_at" IS NULL',
})
@Index('account_session_idle_expires_at_idx', ['idle_expires_at'])
@Check('account_session_client_type_check', `"client_type" IN ('web', 'mobile')`)
@Check(
  'account_session_revoked_reason_check',
  `"revoked_reason" IS NULL OR "revoked_reason" IN ('signed_out', 'signed_out_elsewhere', 'password_changed', 'admin_password_set', 'admin_force_logout', 'refresh_reuse')`
)
@Check('account_session_revoked_pair_check', `("revoked_at" IS NULL) = ("revoked_reason" IS NULL)`)
export class AccountSession {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.nano_id_v2 })
  id_text!: string;

  @Column({ type: 'integer' })
  account_id!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @Column({ type: 'varchar', length: 16 })
  client_type!: AccountSessionClientType;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_normal, nullable: true })
  device_label!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  last_seen_at!: Date;

  @Column({ type: 'timestamptz' })
  idle_expires_at!: Date;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_sha256_hex, nullable: true })
  refresh_token_hash!: string | null;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_sha256_hex, nullable: true })
  previous_refresh_token_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at!: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  revoked_reason!: AccountSessionRevokeReason | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
