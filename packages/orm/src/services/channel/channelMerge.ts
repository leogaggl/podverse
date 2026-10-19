import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { ChannelMerge, ChannelMergeStatus } from '@orm/entities/channel/channelMerge.js';
import type { Repository } from 'typeorm';
import { In } from 'typeorm';

export type UpsertDetectedChannelMergeInput = {
  fromPodcastIndexId: number;
  toPodcastIndexId: number;
};

function statusStaysPut(status: ChannelMergeStatus): boolean {
  return (
    status === ChannelMergeStatus.Applied ||
    status === ChannelMergeStatus.Rejected ||
    status === ChannelMergeStatus.Reverted
  );
}

export class ChannelMergeService {
  protected repositoryRead: Repository<ChannelMerge>;
  protected repositoryReadWrite: Repository<ChannelMerge>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(ChannelMerge);
    this.repositoryReadWrite = AppDataSourceReadWrite.getRepository(ChannelMerge);
  }

  async getById(id: number): Promise<ChannelMerge | null> {
    return this.repositoryRead.findOne({ where: { id } });
  }

  async getByFromPodcastIndexId(fromPodcastIndexId: number): Promise<ChannelMerge | null> {
    return this.repositoryRead.findOne({
      where: { from_podcast_index_id: fromPodcastIndexId },
    });
  }

  /** Rows whose `from_podcast_index_id` is in `podcastIndexIds`. Empty input reads nothing. */
  async listByFromPodcastIndexIds(podcastIndexIds: readonly number[]): Promise<ChannelMerge[]> {
    const rows: ChannelMerge[] = [];
    const chunkSize = 2000;
    for (let index = 0; index < podcastIndexIds.length; index += chunkSize) {
      const chunk = podcastIndexIds.slice(index, index + chunkSize);
      if (chunk.length === 0) {
        continue;
      }
      const found = await this.repositoryRead.find({
        where: { from_podcast_index_id: In(chunk) },
      });
      rows.push(...found);
    }
    return rows;
  }

  async listByStatus(status: ChannelMergeStatus): Promise<ChannelMerge[]> {
    return this.repositoryRead.find({
      where: { status },
      order: { id: 'ASC' },
    });
  }

  async save(row: ChannelMerge): Promise<ChannelMerge> {
    return this.repositoryReadWrite.save(row);
  }

  /**
   * Set `match_stats.guidCollision` on rows that already name either Podcast Index id.
   * Does not insert a row.
   */
  async markGuidCollision(podcastIndexIds: readonly number[]): Promise<void> {
    const seen = new Set<number>();
    for (const podcastIndexId of podcastIndexIds) {
      if (!Number.isFinite(podcastIndexId)) {
        continue;
      }
      const rows = await this.repositoryReadWrite.find({
        where: [{ from_podcast_index_id: podcastIndexId }, { to_podcast_index_id: podcastIndexId }],
      });
      for (const row of rows) {
        if (seen.has(row.id)) {
          continue;
        }
        seen.add(row.id);
        if (row.match_stats.guidCollision === true) {
          continue;
        }
        row.match_stats = { ...row.match_stats, guidCollision: true };
        await this.repositoryReadWrite.save(row);
      }
    }
  }

  /**
   * Insert a detected pair, or point an open row at a new survivor.
   * Applied, rejected, and reverted rows are left unchanged.
   */
  async upsertDetected(input: UpsertDetectedChannelMergeInput): Promise<ChannelMerge> {
    const existing = await this.repositoryReadWrite.findOne({
      where: { from_podcast_index_id: input.fromPodcastIndexId },
    });

    if (existing === null) {
      const created = this.repositoryReadWrite.create({
        from_podcast_index_id: input.fromPodcastIndexId,
        to_podcast_index_id: input.toPodcastIndexId,
        status: ChannelMergeStatus.Detected,
        match_stats: {},
      });
      return this.repositoryReadWrite.save(created);
    }

    if (statusStaysPut(existing.status)) {
      return existing;
    }

    if (existing.to_podcast_index_id !== input.toPodcastIndexId) {
      existing.to_podcast_index_id = input.toPodcastIndexId;
      existing.status = ChannelMergeStatus.Detected;
      return this.repositoryReadWrite.save(existing);
    }

    return existing;
  }
}
