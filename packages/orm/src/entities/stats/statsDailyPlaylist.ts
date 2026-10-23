import type { Playlist } from '@orm/entities/playlist/playlist.js';
import type { Relation } from 'typeorm';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Anonymous count of distinct listeners for one playlist per UTC day. Filled at write time and
 * never decremented.
 */
@Entity('stats_daily_playlist')
export class StatsDailyPlaylist {
  @PrimaryColumn({ type: 'integer' })
  playlist_id!: number;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'integer', default: 0 })
  listener_count!: number;

  @ManyToOne('Playlist', (playlist: Playlist) => playlist.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist!: Relation<Playlist>;
}
