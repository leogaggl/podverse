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

import type { ApiKeyPermissions } from '@podverse/helpers';
import { DATABASE_CONSTANTS } from '@podverse/helpers';

/**
 * One row per user-issued API key. The token is shown once at creation; the row keeps only its
 * SHA-256 hash and its last four characters. Revoking a key deletes its row. Deleting the account
 * deletes its keys.
 */
@Entity('account_api_key')
@Unique('account_api_key_id_text_key', ['id_text'])
@Unique('account_api_key_token_hash_key', ['token_hash'])
@Index('account_api_key_account_created_idx', ['account_id', 'created_at'])
@Check('account_api_key_name_check', `btrim(name) <> ''`)
@Check('account_api_key_permissions_check', `jsonb_typeof(permissions) = 'object'`)
export class AccountApiKey {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.nano_id_v2 })
  id_text!: string;

  @Column({ type: 'integer' })
  account_id!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_short })
  name!: string;

  @Column({ type: 'varchar', length: DATABASE_CONSTANTS.varchar_sha256_hex })
  token_hash!: string;

  @Column({ type: 'varchar', length: 4 })
  token_hint!: string;

  @Column({ type: 'jsonb' })
  permissions!: ApiKeyPermissions;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
