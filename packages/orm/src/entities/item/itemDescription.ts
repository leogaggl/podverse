import type { Item } from '@orm/entities/item/item.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { DESCRIPTION_PREVIEW_MAX_LENGTH } from '@podverse/helpers';

@Entity()
@Unique(['item'])
export class ItemDescription {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne('Item', (item: Item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item>;

  @Column({ type: 'text', select: false })
  value!: string;

  @Column({ type: 'varchar', length: DESCRIPTION_PREVIEW_MAX_LENGTH, nullable: true })
  preview!: string | null;

  @Column({ type: 'boolean', default: false })
  is_truncated!: boolean;

  @Column({ type: 'int', nullable: true })
  source_length!: number | null;
}
