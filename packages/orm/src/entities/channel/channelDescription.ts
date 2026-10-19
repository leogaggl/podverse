import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { DESCRIPTION_PREVIEW_MAX_LENGTH } from '@podverse/helpers';

@Entity()
@Unique(['channel'])
export class ChannelDescription {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne('Channel', (channel: Channel) => channel.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @Column({ type: 'text', select: false })
  value!: string;

  @Column({ type: 'varchar', length: DESCRIPTION_PREVIEW_MAX_LENGTH, nullable: true })
  preview!: string | null;

  @Column({ type: 'boolean', default: false })
  is_truncated!: boolean;

  @Column({ type: 'int', nullable: true })
  source_length!: number | null;
}
