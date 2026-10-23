import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Range totals for one channel, derived from the daily table by the popularity refresh job. The
 * range lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.
 */
@Entity('stats_popularity_channel')
export class StatsPopularityChannel {
  @PrimaryColumn({ type: 'integer' })
  channel_id!: number;

  @Column({ type: 'integer', default: 0 })
  day_count!: number;

  @Column({ type: 'integer', default: 0 })
  week_count!: number;

  @Column({ type: 'integer', default: 0 })
  month_count!: number;

  @Column({ type: 'integer', default: 0 })
  all_time_count!: number;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;
}
