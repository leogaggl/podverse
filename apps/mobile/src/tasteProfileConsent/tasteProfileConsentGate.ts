import { isTasteProfileTrackingAllowed } from '@podverse/helpers';
import type { DTOAccount } from '@podverse/helpers/dto';

let currentAgreementVersion = '';

export function setTasteProfileAgreementCurrentVersion(version: string): void {
  currentAgreementVersion = version;
}

export function getTasteProfileAgreementCurrentVersion(): string {
  return currentAgreementVersion;
}

export function shouldSkipListenStatsForAccount(account: DTOAccount | null): boolean {
  if (account === null) {
    return false;
  }
  return !isTasteProfileTrackingAllowed(account.account_settings, currentAgreementVersion);
}
