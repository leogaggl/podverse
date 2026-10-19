import type { Channel } from '@orm/entities/channel/channel.js';
import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum ChannelMergeMode {
  Repoint = 'repoint',
  Absorb = 'absorb',
}

export enum ChannelMergeStatus {
  Detected = 'detected',
  Verified = 'verified',
  NeedsReview = 'needs_review',
  Applied = 'applied',
  Rejected = 'rejected',
  Reverted = 'reverted',
}

export type ChannelMergeMatchStats = Record<string, unknown>;

@Entity('channel_merge')
@Unique('channel_merge_from_podcast_index_id_key', ['from_podcast_index_id'])
@Index('idx_channel_merge_status', ['status'])
@Index('idx_channel_merge_to_podcast_index_id', ['to_podcast_index_id'])
@Check('channel_merge_mode_check', `"mode" IS NULL OR "mode" IN ('repoint', 'absorb')`)
@Check(
  'channel_merge_status_check',
  `"status" IN ('detected', 'verified', 'needs_review', 'applied', 'rejected', 'reverted')`
)
@Check(
  'channel_merge_confidence_check',
  `"confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)`
)
export class ChannelMerge {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ type: 'int' })
  from_podcast_index_id!: number;

  @Column({ type: 'int' })
  to_podcast_index_id!: number;

  @Column({ type: 'int', nullable: true })
  from_channel_id!: number | null;

  @ManyToOne('Channel', { nullable: true })
  @JoinColumn({ name: 'from_channel_id' })
  from_channel!: Relation<Channel> | null;

  @Column({ type: 'int', nullable: true })
  to_channel_id!: number | null;

  @ManyToOne('Channel', { nullable: true })
  @JoinColumn({ name: 'to_channel_id' })
  to_channel!: Relation<Channel> | null;

  @Column({ type: 'text', nullable: true })
  mode!: ChannelMergeMode | null;

  @Column({ type: 'text' })
  status!: ChannelMergeStatus;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence!: string | null;

  @Column({ type: 'jsonb', default: {} })
  match_stats!: ChannelMergeMatchStats;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  applied_at!: Date | null;
}
