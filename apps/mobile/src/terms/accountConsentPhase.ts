import type { TasteProfileConsentDecision } from '@podverse/helpers';
import { isTasteProfileConsentPromptRequired } from '@podverse/helpers';

export type AccountConsentPhase =
  'account-access' | 'none' | 'resolving' | 'taste-profile-consent' | 'terms';

export type AccountConsentPhaseInput = {
  accountPresent: boolean;
  authenticated: boolean;
  decision: TasteProfileConsentDecision | null;
  /**
   * Terms or account access was already on screen this session. A cold start must not
   * hold a spinner while the Taste Profile agreement loads.
   */
  presentedConsent: boolean;
  showAccountAccess: boolean;
  /** Agreement fetch failed while a prior Yes might be stale. */
  tasteProfileAgreementLoadFailed: boolean;
  tasteProfileAgreementVersion: string;
  termsOutstanding: boolean;
  /** Terms document loaded, or the load failed. Unknown status must not ask for consent. */
  termsStatusKnown: boolean;
};

/**
 * One full-screen consent surface. After terms, a still-required Taste Profile choice stays
 * on that surface so the modal does not dismiss and present again in the same turn.
 */
export function resolveAccountConsentPhase(input: AccountConsentPhaseInput): AccountConsentPhase {
  if (!input.authenticated || !input.accountPresent || !input.termsStatusKnown) {
    return 'none';
  }
  if (input.termsOutstanding && input.showAccountAccess) {
    return 'account-access';
  }
  if (input.termsOutstanding) {
    return 'terms';
  }

  const accepted = input.decision?.listen_stats_accepted;
  // An empty version must not be treated as "already current": any stored version
  // differs from '', which would look like a fresh acceptance.
  if (input.tasteProfileAgreementVersion === '') {
    if (accepted === false) {
      return 'none';
    }
    if (accepted === true) {
      if (!input.presentedConsent) {
        return 'none';
      }
      if (input.tasteProfileAgreementLoadFailed) {
        return 'taste-profile-consent';
      }
      return 'resolving';
    }
    return 'taste-profile-consent';
  }

  if (isTasteProfileConsentPromptRequired(input.decision, input.tasteProfileAgreementVersion)) {
    return 'taste-profile-consent';
  }
  return 'none';
}
