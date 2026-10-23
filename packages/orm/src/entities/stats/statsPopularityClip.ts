import type { Clip } from '@orm/entities/clip.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Range totals for one clip, derived from the daily table by the popularity refresh job. The range
 * lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.
 */
@Entity('stats_popularity_clip')
export class StatsPopularityClip {
  @PrimaryColumn({ type: 'integer' })
  clip_id!: number;

  @Column({ type: 'integer', default: 0 })
  day_count!: number;

  @Column({ type: 'integer', default: 0 })
  week_count!: number;

  @Column({ type: 'integer', default: 0 })
  month_count!: number;

  @Column({ type: 'integer', default: 0 })
  all_time_count!: number;

  @ManyToOne('Clip', (clip: Clip) => clip.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clip_id' })
  clip!: Relation<Clip>;
}
