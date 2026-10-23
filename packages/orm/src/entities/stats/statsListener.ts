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

  /** UTC day (`YYYY-MM-DD`) of the listener's last opt-out that deleted stored listens. */
  @Column({ type: 'date', nullable: true })
  opt_out_day!: string | null;

  /** Listens stored on `opt_out_day` that the opt-out deleted; the stored daily cap adds them. */
  @Column({ type: 'integer', default: 0 })
  opt_out_day_stored_count!: number;

  /** When the first of those deleted listens was stored. */
  @Column({ type: 'timestamptz', nullable: true })
  opt_out_day_first_stored_at!: Date | null;

  @OneToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;
}
