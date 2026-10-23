import type { Clip } from '@orm/entities/clip.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Anonymous count of distinct listeners and finishers for one clip per UTC day. Filled at write
 * time and never decremented.
 */
@Entity('stats_daily_clip')
export class StatsDailyClip {
  @PrimaryColumn({ type: 'integer' })
  clip_id!: number;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'integer', default: 0 })
  listener_count!: number;

  @Column({ type: 'integer', default: 0 })
  completion_count!: number;

  @ManyToOne('Clip', (clip: Clip) => clip.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clip_id' })
  clip!: Relation<Clip>;
}
