import type { ChannelPublisher } from '@orm/entities/channel/channelPublisher.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { DATABASE_CONSTANTS } from '@podverse/helpers';

@Entity({ name: 'channel_publisher_remote_item' })
export class ChannelPublisherRemoteItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne('ChannelPublisher', (channelPublisher: ChannelPublisher) => channelPublisher.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channel_publisher_id' })
  channel_publisher!: Relation<ChannelPublisher>;

  @Column({ type: 'uuid', name: 'feed_guid' })
  feed_guid!: string;

  @Column({
    type: 'varchar',
    name: 'feed_url',
    nullable: true,
    length: DATABASE_CONSTANTS.varchar_url,
  })
  feed_url!: string | null;

  @Column({
    type: 'varchar',
    name: 'item_guid',
    nullable: true,
    length: DATABASE_CONSTANTS.varchar_uri,
  })
  item_guid!: string | null;

  @Column({
    type: 'varchar',
    name: 'title',
    nullable: true,
    length: DATABASE_CONSTANTS.varchar_normal,
  })
  title!: string | null;

  @Column({ type: 'int', name: 'medium_id', nullable: true })
  medium_id!: number | null;

  /** The item whose own podcast:publisher made this claim. Null for a channel-level claim. */
  @Column({ type: 'int', name: 'item_id', nullable: true })
  item_id!: number | null;

  @ManyToOne('Item', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item> | null;
}
