import type { Account } from '@orm/entities/account/account.js';
import type { Playlist } from '@orm/entities/playlist/playlist.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One row per profile or playlist open. Exactly one of `account_id` and `playlist_id` is set, and
 * opens never feed taste profiles.
 */
@Entity('stats_open_event')
export class StatsOpenEvent {
  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @PrimaryColumn({
    type: 'bigint',
    default: () => "nextval('public.stats_open_event_id_seq')",
  })
  id!: string;

  @Column({ type: 'uuid' })
  listener_id!: string;

  @Column({ type: 'integer', nullable: true })
  account_id!: number | null;

  @Column({ type: 'integer', nullable: true })
  playlist_id!: number | null;

  /** False for an open stored while its opener was flagged: it counts toward no total. */
  @Column({ type: 'boolean', default: true })
  popularity_counted!: boolean;

  /** Started this opener's all-time period for the profile or playlist. */
  @Column({ type: 'boolean', default: false })
  all_time_counted!: boolean;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account> | null;

  @ManyToOne('Playlist', (playlist: Playlist) => playlist.id, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'playlist_id' })
  playlist!: Relation<Playlist> | null;
}
