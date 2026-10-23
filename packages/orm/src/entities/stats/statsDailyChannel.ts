import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Anonymous count of distinct listeners and finishers for one channel per UTC day. Filled at write
 * time and never decremented.
 */
@Entity('stats_daily_channel')
export class StatsDailyChannel {
  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'integer', default: 0 })
  listener_count!: number;

  @Column({ type: 'integer', default: 0 })
  completion_count!: number;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;
}
