import { describe, expect, it } from 'vitest';

import {
  getTasteProfileConsentChoice,
  isTasteProfileConsentOptOutDestructive,
  isTasteProfileConsentPromptRequired,
  isTasteProfileTrackingAllowed,
} from './tasteProfileConsent.js';

const current = '2026-10-15';

describe('isTasteProfileTrackingAllowed', () => {
  it('is false when there is no decision', () => {
    expect(isTasteProfileTrackingAllowed(null, current)).toBe(false);
    expect(isTasteProfileTrackingAllowed(undefined, current)).toBe(false);
    expect(
      isTasteProfileTrackingAllowed(
        { listen_stats_accepted: null, listen_stats_agreement_version: null },
        current
      )
    ).toBe(false);
  });

  it('is false when the user declined', () => {
    expect(
      isTasteProfileTrackingAllowed(
        { listen_stats_accepted: false, listen_stats_agreement_version: current },
        current
      )
    ).toBe(false);
  });

  it('is false when the accepted version is stale', () => {
    expect(
      isTasteProfileTrackingAllowed(
        { listen_stats_accepted: true, listen_stats_agreement_version: '2026-01-01' },
        current
      )
    ).toBe(false);
  });

  it('is true only for accept of the current version', () => {
    expect(
      isTasteProfileTrackingAllowed(
        { listen_stats_accepted: true, listen_stats_agreement_version: current },
        current
      )
    ).toBe(true);
  });
});

describe('isTasteProfileConsentPromptRequired', () => {
  it('is required when never decided', () => {
    expect(isTasteProfileConsentPromptRequired(null, current)).toBe(true);
    expect(
      isTasteProfileConsentPromptRequired(
        { listen_stats_accepted: null, listen_stats_agreement_version: null },
        current
      )
    ).toBe(true);
  });

  it('is required when an accepted user is on a stale version', () => {
    expect(
      isTasteProfileConsentPromptRequired(
        { listen_stats_accepted: true, listen_stats_agreement_version: '2026-01-01' },
        current
      )
    ).toBe(true);
  });

  it('is not required after a decline, even if the version changed', () => {
    expect(
      isTasteProfileConsentPromptRequired(
        { listen_stats_accepted: false, listen_stats_agreement_version: '2026-01-01' },
        current
      )
    ).toBe(false);
  });

  it('is not required after accept of the current version', () => {
    expect(
      isTasteProfileConsentPromptRequired(
        { listen_stats_accepted: true, listen_stats_agreement_version: current },
        current
      )
    ).toBe(false);
  });
});

describe('getTasteProfileConsentChoice', () => {
  it('is undecided until the account records yes or no', () => {
    expect(getTasteProfileConsentChoice(null, current)).toBe('undecided');
    expect(
      getTasteProfileConsentChoice(
        { listen_stats_accepted: null, listen_stats_agreement_version: null },
        current
      )
    ).toBe('undecided');
  });

  it('is opted out after a decline', () => {
    expect(
      getTasteProfileConsentChoice(
        { listen_stats_accepted: false, listen_stats_agreement_version: '2026-01-01' },
        current
      )
    ).toBe('opted_out');
  });

  it('is a stale acceptance when yes refers to an older version', () => {
    expect(
      getTasteProfileConsentChoice(
        { listen_stats_accepted: true, listen_stats_agreement_version: '2026-01-01' },
        current
      )
    ).toBe('stale_acceptance');
  });

  it('is allowed only for yes on the current version', () => {
    expect(
      getTasteProfileConsentChoice(
        { listen_stats_accepted: true, listen_stats_agreement_version: current },
        current
      )
    ).toBe('allowed');
  });
});

describe('isTasteProfileConsentOptOutDestructive', () => {
  it('is true for a yes on the current version and on an older version', () => {
    expect(
      isTasteProfileConsentOptOutDestructive({
        listen_stats_accepted: true,
        listen_stats_agreement_version: current,
      })
    ).toBe(true);
    expect(
      isTasteProfileConsentOptOutDestructive({
        listen_stats_accepted: true,
        listen_stats_agreement_version: '2026-01-01',
      })
    ).toBe(true);
  });

  it('is false when there is no decision, nothing was decided, or the account opted out', () => {
    expect(isTasteProfileConsentOptOutDestructive(null)).toBe(false);
    expect(isTasteProfileConsentOptOutDestructive(undefined)).toBe(false);
    expect(
      isTasteProfileConsentOptOutDestructive({
        listen_stats_accepted: null,
        listen_stats_agreement_version: null,
      })
    ).toBe(false);
    expect(
      isTasteProfileConsentOptOutDestructive({
        listen_stats_accepted: false,
        listen_stats_agreement_version: current,
      })
    ).toBe(false);
  });
});
