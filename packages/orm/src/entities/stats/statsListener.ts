import type { Account } from '@orm/entities/account/account.js';
import type { Relation } from 'typeorm';
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

/**
 * The only link between an account and its pseudonymous listener id. Read only inside the listener
 * identity zone.
 */
@Entity({ name: 'stats_listener', schema: 'listener_identity' })
export class StatsListener {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  listener_id!: string;

  @Column({ type: 'integer', unique: true })
  account_id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @OneToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;
}
