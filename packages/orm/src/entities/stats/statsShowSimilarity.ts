import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Cosine similarity from one show to another, shared by every listener.
 * One row is one directed neighbor. The weekly refresh replaces the set.
 */
@Entity('stats_show_similarity')
export class StatsShowSimilarity {
  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @PrimaryColumn({ type: 'integer' })
  other_channel_id!: number;

  @Column({ type: 'double precision' })
  score!: number;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'other_channel_id' })
  other_channel!: Relation<Channel>;
}
