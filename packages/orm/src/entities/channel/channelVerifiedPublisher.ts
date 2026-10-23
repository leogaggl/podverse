import type { Channel } from '@orm/entities/channel/channel.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A publisher feed and a content feed that reference each other. Rows are derived: the parser
 * recomputes a content channel's rows from both feeds' references, so never edit them by hand.
 * Whether a publisher reads as an artist is decided by the publisher channel's medium, not here.
 */
@Entity({ name: 'channel_verified_publisher' })
export class ChannelVerifiedPublisher {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  /** The content channel the publisher is credited on (an album today). */
  @Column({ type: 'int', name: 'channel_id' })
  channel_id!: number;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @Column({ type: 'int', name: 'publisher_channel_id' })
  publisher_channel_id!: number;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publisher_channel_id' })
  publisher_channel!: Relation<Channel>;

  /** Set when the credit is for one item of the content channel; null for the whole channel. */
  @Column({ type: 'int', name: 'item_id', nullable: true })
  item_id!: number | null;

  @ManyToOne('Item', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item> | null;

  /** The claim's order in the content feed within its scope; 0 is the primary publisher. */
  @Column({ type: 'smallint', name: 'claim_position' })
  claim_position!: number;
}
