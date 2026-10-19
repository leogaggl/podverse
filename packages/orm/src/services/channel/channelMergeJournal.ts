import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import type {
  ChannelMergeJournalAction,
  ChannelMergeJournalRow,
} from '@orm/entities/channel/channelMergeJournal.js';
import { ChannelMergeJournal } from '@orm/entities/channel/channelMergeJournal.js';
import type { Repository } from 'typeorm';

export type AppendChannelMergeJournalInput = {
  channelMergeId: number;
  tableName: string;
  rowPk: string;
  action: ChannelMergeJournalAction;
  beforeJson: ChannelMergeJournalRow | null;
  afterJson: ChannelMergeJournalRow | null;
};

export class ChannelMergeJournalService {
  protected repositoryRead: Repository<ChannelMergeJournal>;
  protected repositoryReadWrite: Repository<ChannelMergeJournal>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(ChannelMergeJournal);
    this.repositoryReadWrite = AppDataSourceReadWrite.getRepository(ChannelMergeJournal);
  }

  async listByChannelMergeId(channelMergeId: number): Promise<ChannelMergeJournal[]> {
    return this.repositoryRead.find({
      where: { channel_merge_id: channelMergeId },
      order: { id: 'ASC' },
    });
  }

  async append(input: AppendChannelMergeJournalInput): Promise<ChannelMergeJournal> {
    const created = this.repositoryReadWrite.create({
      channel_merge_id: input.channelMergeId,
      table_name: input.tableName,
      row_pk: input.rowPk,
      action: input.action,
      before_json: input.beforeJson,
      after_json: input.afterJson,
    });
    return this.repositoryReadWrite.save(created);
  }
}
