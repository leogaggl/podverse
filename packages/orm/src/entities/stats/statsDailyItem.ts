import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Anonymous count of distinct listeners and finishers for one item per UTC day. Filled at write
 * time and never decremented.
 */
@Entity('stats_daily_item')
export class StatsDailyItem {
  @PrimaryColumn({ type: 'integer' })
  item_id!: number;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'integer', default: 0 })
  listener_count!: number;

  @Column({ type: 'integer', default: 0 })
  completion_count!: number;

  @ManyToOne('Item', (item: Item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item>;
}
