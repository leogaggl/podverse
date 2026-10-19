import type { ChannelMerge } from '@orm/entities/channel/channelMerge.js';
import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum ItemMergeMatchTier {
  Guid = 'guid',
  Enclosure = 'enclosure',
  Fuzzy = 'fuzzy',
}

@Entity('item_merge_map')
@Unique('item_merge_map_channel_merge_from_item_key', ['channel_merge_id', 'from_item_id'])
@Check(
  'item_merge_map_match_tier_check',
  `"match_tier" IS NULL OR "match_tier" IN ('guid', 'enclosure', 'fuzzy')`
)
export class ItemMergeMap {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ type: 'int' })
  channel_merge_id!: number;

  @ManyToOne('ChannelMerge', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_merge_id' })
  channel_merge!: Relation<ChannelMerge>;

  @Column({ type: 'int' })
  from_item_id!: number;

  @ManyToOne('Item')
  @JoinColumn({ name: 'from_item_id' })
  from_item!: Relation<Item>;

  @Column({ type: 'int', nullable: true })
  to_item_id!: number | null;

  @ManyToOne('Item', { nullable: true })
  @JoinColumn({ name: 'to_item_id' })
  to_item!: Relation<Item> | null;

  @Column({ type: 'text', nullable: true })
  match_tier!: ItemMergeMatchTier | null;
}
