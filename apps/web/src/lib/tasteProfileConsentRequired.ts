import type { DTOAccount } from '@podverse/helpers';
import { isTasteProfileConsentPromptRequired } from '@podverse/helpers';

export function isTasteProfileConsentPromptRequiredForAccount(
  account: DTOAccount | null | undefined,
  currentVersion: string
): boolean {
  if (account === null || account === undefined) {
    return false;
  }
  return isTasteProfileConsentPromptRequired(account.account_settings, currentVersion);
}
