import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { AccountSettings } from '@orm/entities/account/accountSettings/accountSettings.js';
import { ListeningDataDeletionService } from '@orm/services/stats/listenerIdentity/listeningDataDeletion.js';
import type { Repository } from 'typeorm';

import type { TasteProfileConsentDecision } from '@podverse/helpers';
import { isTasteProfileTrackingAllowed } from '@podverse/helpers';

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

  async getDecision(accountId: number): Promise<TasteProfileConsentDecision | null> {
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
    return isTasteProfileTrackingAllowed(decision, currentVersion);
  }

  /**
   * Records the decision and, for a No, deletes the account's listening data in the same
   * transaction. A No that follows a Yes is an opt-out: it also records
   * `listen_stats_opted_out_at`, which starts the popularity cooldown, and a later opt-out
   * replaces it. A Yes never deletes and never changes that time. The settings row stays
   * write-locked until commit, so a listen or open write that re-reads consent `FOR SHARE` waits
   * and then sees the No.
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

      const optingOut = dto.accepted === false && accountSettings.listen_stats_accepted === true;
      const decidedAt = new Date();

      accountSettings.listen_stats_accepted = dto.accepted;
      accountSettings.listen_stats_agreement_version = dto.agreement_version;
      accountSettings.listen_stats_decided_at = decidedAt;
      if (optingOut) {
        accountSettings.listen_stats_opted_out_at = decidedAt;
      }
      accountSettings.allow_listen_stats = dto.accepted;
      const saved = await repository.save(accountSettings);

      if (dto.accepted === false) {
        await new ListeningDataDeletionService().deleteForAccount(dto.account_id, manager);
      }

      return saved;
    });
  }
}
