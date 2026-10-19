import type { ChannelMerge } from '@orm/entities/channel/channelMerge.js';
import type { Relation } from 'typeorm';
import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum ChannelMergeJournalAction {
  Insert = 'insert',
  Update = 'update',
  Delete = 'delete',
}

export type ChannelMergeJournalRow = Record<string, unknown>;

@Entity('channel_merge_journal')
@Check('channel_merge_journal_action_check', `"action" IN ('insert', 'update', 'delete')`)
export class ChannelMergeJournal {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ type: 'int' })
  channel_merge_id!: number;

  @ManyToOne('ChannelMerge', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_merge_id' })
  channel_merge!: Relation<ChannelMerge>;

  @Column({ type: 'text' })
  table_name!: string;

  @Column({ type: 'text' })
  row_pk!: string;

  @Column({ type: 'text' })
  action!: ChannelMergeJournalAction;

  @Column({ type: 'jsonb', nullable: true })
  before_json!: ChannelMergeJournalRow | null;

  @Column({ type: 'jsonb', nullable: true })
  after_json!: ChannelMergeJournalRow | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;
}
