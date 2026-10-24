import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import type { PopularityFlagReason } from '@podverse/helpers';

/**
 * One row per flagged listener. While `cleared_at` is null, the listener's new listens and opens
 * count toward no popularity total.
 */
@Entity('stats_flagged_listener')
export class StatsFlaggedListener {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'uuid', unique: true })
  listener_id!: string;

  @Column({ type: 'text' })
  reason!: PopularityFlagReason;

  @Column({ type: 'timestamptz' })
  flagged_at!: Date;

  @Column({ type: 'integer', default: 1 })
  times_flagged!: number;

  @Column({ type: 'timestamptz', nullable: true })
  cleared_at!: Date | null;

  /** A management-database admin id; the app database has no admin table to reference. */
  @Column({ type: 'integer', nullable: true })
  cleared_by_admin_id!: number | null;
}
