import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One row per listener and show (podcast, album, or artist channel). Scores decay and are faded
 * to the current time before comparison; see docs/features/POPULARITY-AND-TASTE-PROFILE.md.
 */
@Entity('stats_taste_profile')
export class StatsTasteProfile {
  @PrimaryColumn({ type: 'uuid' })
  listener_id!: string;

  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @Column({ type: 'integer', default: 0 })
  listen_count!: number;

  @Column({ type: 'integer', default: 0 })
  completion_count!: number;

  @Column({ type: 'timestamptz' })
  first_listened_at!: Date;

  @Column({ type: 'timestamptz' })
  last_listened_at!: Date;

  @Column({ type: 'timestamptz' })
  scores_updated_at!: Date;

  @Column({ type: 'double precision', default: 0 })
  recent_score!: number;

  @Column({ type: 'double precision', default: 0 })
  long_term_score!: number;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;
}
