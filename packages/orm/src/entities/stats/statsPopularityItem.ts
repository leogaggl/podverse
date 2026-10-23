import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Range totals for one item, rebuilt from counted events and daily totals by the popularity
 * refresh job. The range lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.
 */
@Entity('stats_popularity_item')
export class StatsPopularityItem {
  @PrimaryColumn({ type: 'integer' })
  item_id!: number;

  @Column({ type: 'integer', default: 0 })
  day_count!: number;

  @Column({ type: 'integer', default: 0 })
  week_count!: number;

  @Column({ type: 'integer', default: 0 })
  month_count!: number;

  @Column({ type: 'integer', default: 0 })
  all_time_count!: number;

  @ManyToOne('Item', (item: Item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item>;
}
