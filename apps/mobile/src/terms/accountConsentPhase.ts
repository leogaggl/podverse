import type { PopularityTrackingDecision } from '@podverse/helpers';
import { isPopularityTrackingPromptRequired } from '@podverse/helpers';

export type AccountConsentPhase = 'account-access' | 'none' | 'popularity' | 'resolving' | 'terms';

export type AccountConsentPhaseInput = {
  accountPresent: boolean;
  authenticated: boolean;
  decision: PopularityTrackingDecision | null;
  /** Agreement fetch failed while a prior Yes might be stale. */
  popularityLoadFailed: boolean;
  popularityVersion: string;
  /**
   * Terms or account access was already on screen this session. A cold start must not
   * hold a spinner while the popularity agreement loads.
   */
  presentedConsent: boolean;
  showAccountAccess: boolean;
  termsOutstanding: boolean;
  /** Terms document loaded, or the load failed. Unknown status must not show popularity. */
  termsStatusKnown: boolean;
};

/**
 * One full-screen consent surface. After terms, a still-required popularity choice stays
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
  if (input.popularityVersion === '') {
    if (accepted === false) {
      return 'none';
    }
    if (accepted === true) {
      if (!input.presentedConsent) {
        return 'none';
      }
      if (input.popularityLoadFailed) {
        return 'popularity';
      }
      return 'resolving';
    }
    return 'popularity';
  }

  if (isPopularityTrackingPromptRequired(input.decision, input.popularityVersion)) {
    return 'popularity';
  }
  return 'none';
}
