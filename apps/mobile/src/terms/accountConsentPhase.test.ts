import { describe, expect, it } from 'vitest';

import type { AccountConsentPhaseInput } from './accountConsentPhase';
import { resolveAccountConsentPhase } from './accountConsentPhase';

const ready: AccountConsentPhaseInput = {
  accountPresent: true,
  authenticated: true,
  decision: {
    listen_stats_accepted: null,
    listen_stats_agreement_version: null,
  },
  popularityLoadFailed: false,
  popularityVersion: '',
  presentedConsent: false,
  showAccountAccess: false,
  termsOutstanding: false,
  termsStatusKnown: true,
};

describe('resolveAccountConsentPhase', () => {
  it('stays hidden until the account and terms status are known', () => {
    expect(resolveAccountConsentPhase({ ...ready, authenticated: false })).toBe('none');
    expect(resolveAccountConsentPhase({ ...ready, accountPresent: false })).toBe('none');
    expect(resolveAccountConsentPhase({ ...ready, termsStatusKnown: false })).toBe('none');
  });

  it('shows terms before popularity, and account access only from that gate', () => {
    expect(resolveAccountConsentPhase({ ...ready, termsOutstanding: true })).toBe('terms');
    expect(
      resolveAccountConsentPhase({
        ...ready,
        showAccountAccess: true,
        termsOutstanding: true,
      })
    ).toBe('account-access');
    expect(resolveAccountConsentPhase({ ...ready, showAccountAccess: true })).toBe('popularity');
  });

  it('asks popularity as soon as terms are clear and the listener has not decided', () => {
    expect(resolveAccountConsentPhase(ready)).toBe('popularity');
    expect(resolveAccountConsentPhase({ ...ready, decision: null })).toBe('popularity');
    expect(
      resolveAccountConsentPhase({
        ...ready,
        decision: {
          listen_stats_accepted: null,
          listen_stats_agreement_version: null,
        },
        popularityVersion: '2026-10-15',
      })
    ).toBe('popularity');
  });

  it('does not ask again after a No, even before the agreement version loads', () => {
    expect(
      resolveAccountConsentPhase({
        ...ready,
        decision: {
          listen_stats_accepted: false,
          listen_stats_agreement_version: null,
        },
      })
    ).toBe('none');
    expect(
      resolveAccountConsentPhase({
        ...ready,
        decision: {
          listen_stats_accepted: false,
          listen_stats_agreement_version: '2025-01-01',
        },
        popularityVersion: '2026-10-15',
      })
    ).toBe('none');
  });

  it('holds the modal after terms when a prior Yes might be stale', () => {
    const priorYes: AccountConsentPhaseInput = {
      ...ready,
      decision: {
        listen_stats_accepted: true,
        listen_stats_agreement_version: '2025-01-01',
      },
      presentedConsent: true,
    };
    expect(resolveAccountConsentPhase(priorYes)).toBe('resolving');
    expect(resolveAccountConsentPhase({ ...priorYes, popularityLoadFailed: true })).toBe(
      'popularity'
    );
    expect(
      resolveAccountConsentPhase({
        ...priorYes,
        popularityVersion: '2026-10-15',
      })
    ).toBe('popularity');
    expect(
      resolveAccountConsentPhase({
        ...priorYes,
        decision: {
          listen_stats_accepted: true,
          listen_stats_agreement_version: '2026-10-15',
        },
        popularityVersion: '2026-10-15',
      })
    ).toBe('none');
  });

  it('does not flash a spinner on a cold start that already accepted the current version', () => {
    expect(
      resolveAccountConsentPhase({
        ...ready,
        decision: {
          listen_stats_accepted: true,
          listen_stats_agreement_version: '2026-10-15',
        },
        presentedConsent: false,
      })
    ).toBe('none');
    expect(
      resolveAccountConsentPhase({
        ...ready,
        decision: {
          listen_stats_accepted: true,
          listen_stats_agreement_version: '2025-01-01',
        },
        popularityVersion: '2026-10-15',
        presentedConsent: false,
      })
    ).toBe('popularity');
  });
});
