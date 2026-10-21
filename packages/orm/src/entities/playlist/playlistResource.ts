import type { Playlist } from '@orm/entities/playlist/playlist.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import type { DTORemovedSource } from '@podverse/helpers';

import type { Clip } from '../clip.js';
import type { Item } from '../item/item.js';
import type { ItemSoundbite } from '../item/itemSoundbite.js';

@Entity()
@Unique(['playlist', 'list_position'])
export class PlaylistResource {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne('Playlist', (playlist: Playlist) => playlist.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist!: Relation<Playlist>;

  @Column()
  playlist_id!: number;

  @Column({ type: 'numeric' })
  list_position!: string;

  @Column()
  clip_id!: string;

  @ManyToOne('Clip', (clip: Clip) => clip.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clip_id' })
  clip!: Relation<Clip>;

  @Column({ nullable: true })
  item_id!: string | null;

  @ManyToOne('Item', (item: Item) => item.id, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'item_id' })
  item!: Relation<Item> | null;

  @Column({ nullable: true })
  item_soundbite_id!: number | null;

  @ManyToOne('ItemSoundbite', (itemSoundbite: ItemSoundbite) => itemSoundbite.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'item_soundbite_id' })
  item_soundbite!: Relation<ItemSoundbite> | null;

  @Column()
  add_by_rss_hash_id!: string;

  @Column({ type: 'jsonb' })
  add_by_rss_resource_data!: object;

  @Column({ type: 'jsonb', nullable: true })
  removed_source!: DTORemovedSource | null;

  @Column({ type: 'timestamp', nullable: true })
  source_removed_at!: Date | null;
}
