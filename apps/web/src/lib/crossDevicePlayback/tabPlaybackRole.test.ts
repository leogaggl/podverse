import { describe, expect, it } from 'vitest';

import { resolveTabPlaybackRole } from './tabPlaybackRole';

const READY_THIS_SESSION = {
  availability: 'ready' as const,
  thisSessionIdText: 'session-this',
  thisTabHoldsAudio: false,
  claimPending: false,
};

describe('resolveTabPlaybackRole', () => {
  it('is idle until availability is ready, even when this tab holds audio', () => {
    for (const availability of ['off', 'pending', 'unavailable'] as const) {
      expect(
        resolveTabPlaybackRole({
          ...READY_THIS_SESSION,
          availability,
          activeSessionIdText: 'session-this',
          thisTabHoldsAudio: true,
        })
      ).toBe('idle');
    }
  });

  it('is active while a claim is in flight, even when another session is active', () => {
    expect(
      resolveTabPlaybackRole({
        ...READY_THIS_SESSION,
        activeSessionIdText: 'session-other',
        claimPending: true,
      })
    ).toBe('active');
  });

  it('is active when this session is active and this tab holds audio', () => {
    expect(
      resolveTabPlaybackRole({
        ...READY_THIS_SESSION,
        activeSessionIdText: 'session-this',
        thisTabHoldsAudio: true,
      })
    ).toBe('active');
  });

  it('is remote when this session is active but another tab holds audio', () => {
    expect(
      resolveTabPlaybackRole({ ...READY_THIS_SESSION, activeSessionIdText: 'session-this' })
    ).toBe('remote');
  });

  it('is remote when another session is active', () => {
    expect(
      resolveTabPlaybackRole({ ...READY_THIS_SESSION, activeSessionIdText: 'session-other' })
    ).toBe('remote');
  });

  it('is idle when no session is active', () => {
    expect(resolveTabPlaybackRole({ ...READY_THIS_SESSION, activeSessionIdText: null })).toBe(
      'idle'
    );
  });
});
