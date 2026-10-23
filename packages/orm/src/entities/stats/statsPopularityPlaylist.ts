import type { Playlist } from '@orm/entities/playlist/playlist.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Range totals for one playlist, derived from the daily table by the popularity refresh job. The
 * range lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.
 */
@Entity('stats_popularity_playlist')
export class StatsPopularityPlaylist {
  @PrimaryColumn({ type: 'integer' })
  playlist_id!: number;

  @Column({ type: 'integer', default: 0 })
  day_count!: number;

  @Column({ type: 'integer', default: 0 })
  week_count!: number;

  @Column({ type: 'integer', default: 0 })
  month_count!: number;

  @Column({ type: 'integer', default: 0 })
  all_time_count!: number;

  @ManyToOne('Playlist', (playlist: Playlist) => playlist.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist!: Relation<Playlist>;
}
