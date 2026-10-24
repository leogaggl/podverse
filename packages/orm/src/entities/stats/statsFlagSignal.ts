import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The listener's latest run of too-soon minutes. A too-soon minute more than two minutes after
 * `last_too_soon_minute` starts a new run.
 */
@Entity('stats_flag_signal')
export class StatsFlagSignal {
  @PrimaryColumn({ type: 'uuid' })
  listener_id!: string;

  @Column({ type: 'integer' })
  too_soon_minutes!: number;

  @Column({ type: 'timestamptz' })
  last_too_soon_minute!: Date;
}
