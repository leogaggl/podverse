import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import {
  PODCAST_INDEX_DEAD_FEED_SYNC_ID,
  PodcastIndexDeadFeedSync,
} from '@orm/entities/channel/podcastIndexDeadFeedSync.js';
import type { Repository } from 'typeorm';

export class PodcastIndexDeadFeedSyncService {
  protected repositoryRead: Repository<PodcastIndexDeadFeedSync>;
  protected repositoryReadWrite: Repository<PodcastIndexDeadFeedSync>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(PodcastIndexDeadFeedSync);
    this.repositoryReadWrite = AppDataSourceReadWrite.getRepository(PodcastIndexDeadFeedSync);
  }

  async get(): Promise<PodcastIndexDeadFeedSync | null> {
    return this.repositoryRead.findOne({ where: { id: PODCAST_INDEX_DEAD_FEED_SYNC_ID } });
  }

  async save(row: PodcastIndexDeadFeedSync): Promise<PodcastIndexDeadFeedSync> {
    return this.repositoryReadWrite.save(row);
  }
}
