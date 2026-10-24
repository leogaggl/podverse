import type { Channel } from '@orm/entities/channel/channel.js';
import type { Clip } from '@orm/entities/clip.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One row per stored listen. `created_at` is the server receive time and the only clock (daily
 * totals and taste decay); monthly partitions use it, the app addresses only this parent table,
 * and the longer rules are in docs/features/POPULARITY-AND-TASTE-PROFILE.md.
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

  /** False past the listener's daily popularity cap: the listen feeds taste rows only. */
  @Column({ type: 'boolean', default: true })
  popularity_counted!: boolean;

  /** Started this listener's all-time period for the item. */
  @Column({ type: 'boolean', default: false })
  item_all_time_counted!: boolean;

  /** Started this listener's all-time period for the channel. */
  @Column({ type: 'boolean', default: false })
  channel_all_time_counted!: boolean;

  /** Started this listener's all-time period for the clip. */
  @Column({ type: 'boolean', default: false })
  clip_all_time_counted!: boolean;

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
