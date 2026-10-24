import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * When a show's outgoing neighbors were last rebuilt. A show with no neighbors
 * still has a stamp, so the next incremental run does not rebuild it again.
 */
@Entity('stats_show_similarity_state')
export class StatsShowSimilarityState {
  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;
}
