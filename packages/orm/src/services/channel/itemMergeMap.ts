import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { ItemMergeMap } from '@orm/entities/channel/itemMergeMap.js';
import type { Repository } from 'typeorm';

export class ItemMergeMapService {
  protected repositoryRead: Repository<ItemMergeMap>;
  protected repositoryReadWrite: Repository<ItemMergeMap>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(ItemMergeMap);
    this.repositoryReadWrite = AppDataSourceReadWrite.getRepository(ItemMergeMap);
  }

  async listByChannelMergeId(channelMergeId: number): Promise<ItemMergeMap[]> {
    return this.repositoryRead.find({
      where: { channel_merge_id: channelMergeId },
      order: { id: 'ASC' },
    });
  }

  async save(row: ItemMergeMap): Promise<ItemMergeMap> {
    return this.repositoryReadWrite.save(row);
  }
}
