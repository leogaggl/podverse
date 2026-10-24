import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One recommended show for a listener. `strength` is the 1–5 mark for that chip.
 * Subscriptions are filtered when the account reads the list, not here.
 */
@Entity('stats_recommendation')
export class StatsRecommendation {
  @PrimaryColumn({ type: 'uuid' })
  listener_id!: string;

  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @Column({ type: 'double precision' })
  score!: number;

  @Column({ type: 'smallint' })
  strength!: number;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;
}
