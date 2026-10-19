import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

/** The single row that stores Podcast Index dead-feed CSV validators. `id` is always 1. */
export const PODCAST_INDEX_DEAD_FEED_SYNC_ID = 1;

@Entity('podcast_index_dead_feed_sync')
@Check('podcast_index_dead_feed_sync_singleton', `"id" = 1`)
export class PodcastIndexDeadFeedSync {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ type: 'text', nullable: true })
  last_modified!: string | null;

  @Column({ type: 'text', nullable: true })
  etag!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  synced_at!: Date | null;

  /** Eligible retire count from the last accepted run. Null until a dry run stores one. */
  @Column({ type: 'integer', nullable: true })
  last_retire_eligible_count!: number | null;
}
