import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { AccountSettings } from '@orm/entities/account/accountSettings/accountSettings.js';
import { ListeningDataDeletionService } from '@orm/services/stats/listenerIdentity/listeningDataDeletion.js';
import type { Repository } from 'typeorm';

import type { PopularityTrackingDecision } from '@podverse/helpers';
import { isPopularityTrackingAllowed } from '@podverse/helpers';

type UpdateDto = {
  account_id: number;
  accepted: boolean;
  agreement_version: string;
};

export class AccountSettingsListenStatsService {
  protected repositoryRead: Repository<AccountSettings>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(AccountSettings);
  }

  async getDecision(accountId: number): Promise<PopularityTrackingDecision | null> {
    const accountSettings = await this.repositoryRead.findOne({
      where: { account_id: accountId },
    });

    if (accountSettings === null) {
      return null;
    }

    return {
      listen_stats_accepted: accountSettings.listen_stats_accepted,
      listen_stats_agreement_version: accountSettings.listen_stats_agreement_version,
    };
  }

  async isListenStatsAllowed(accountId: number, currentVersion: string): Promise<boolean> {
    const decision = await this.getDecision(accountId);
    return isPopularityTrackingAllowed(decision, currentVersion);
  }

  /**
   * Records the decision and, for a No, deletes the account's listening data in the same
   * transaction. The settings row stays write-locked until commit, so a listen or open write that
   * re-reads consent `FOR SHARE` waits and then sees the No. A Yes never deletes.
   */
  async update(dto: UpdateDto): Promise<AccountSettings> {
    return AppDataSourceReadWrite.transaction(async (manager) => {
      const repository = manager.getRepository(AccountSettings);
      const accountSettings = await repository.findOne({
        where: { account_id: dto.account_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (accountSettings === null) {
        throw new Error('AccountSettings not found for account');
      }

      accountSettings.listen_stats_accepted = dto.accepted;
      accountSettings.listen_stats_agreement_version = dto.agreement_version;
      accountSettings.listen_stats_decided_at = new Date();
      accountSettings.allow_listen_stats = dto.accepted;
      const saved = await repository.save(accountSettings);

      if (dto.accepted === false) {
        await new ListeningDataDeletionService().deleteForAccount(dto.account_id, manager);
      }

      return saved;
    });
  }
}
