import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * When a listener's recommendations were last rebuilt. A listener with no
 * discoveries still has a stamp, so the next incremental run skips them
 * until their Taste Profile changes.
 */
@Entity('stats_recommendation_state')
export class StatsRecommendationState {
  @PrimaryColumn({ type: 'uuid' })
  listener_id!: string;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;
}
