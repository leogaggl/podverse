import type { Channel } from '@orm/entities/channel/channel.js';
import type { Clip } from '@orm/entities/clip.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One row per counted listen. `created_at` is the server receive time and the only clock (daily
 * totals and taste decay); monthly partitions use it, the app addresses only this parent table,
 * and the longer rules are in docs/features/POPULARITY-TRACKING.md.
 */
@Entity('stats_listen_event')
export class StatsListenEvent {
  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @PrimaryColumn({
    type: 'bigint',
    default: () => "nextval('public.stats_listen_event_id_seq')",
  })
  id!: string;

  @Column({ type: 'uuid' })
  listener_id!: string;

  @Column({ type: 'integer' })
  channel_id!: number;

  @Column({ type: 'integer' })
  item_id!: number;

  @Column({ type: 'integer', nullable: true })
  clip_id!: number | null;

  @Column({ type: 'uuid', nullable: true })
  client_listen_id!: string | null;

  @Column({ type: 'integer', default: 0 })
  seconds_heard!: number;

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @ManyToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @ManyToOne('Item', (item: Item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item>;

  @ManyToOne('Clip', (clip: Clip) => clip.id, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'clip_id' })
  clip!: Relation<Clip> | null;
}
