import { readFlaggedListenerRow } from '@management-api/lib/stats/flaggedListeners.js';
import { describe, expect, it } from 'vitest';

const flaggedAt = new Date('2026-10-20T08:00:00.000Z');
const clearedAt = new Date('2026-10-21T09:30:00.000Z');
const listenerId = '11111111-1111-4111-8111-111111111111';

function validRow(): Record<string, unknown> {
  return {
    id: 4,
    listener_id: listenerId,
    reason: 'too_soon_minutes',
    flagged_at: flaggedAt,
    times_flagged: 1,
    cleared_at: null,
    cleared_by_admin_id: null,
    listens_last_7_days: 0,
    opens_last_7_days: 0,
  };
}

describe('readFlaggedListenerRow', () => {
  it('turns Date values into ISO strings and keeps null clear fields', () => {
    expect(readFlaggedListenerRow(validRow())).toEqual({
      id: 4,
      listener_id: listenerId,
      reason: 'too_soon_minutes',
      flagged_at: flaggedAt.toISOString(),
      times_flagged: 1,
      cleared_at: null,
      cleared_by_admin_id: null,
      listens_last_7_days: 0,
      opens_last_7_days: 0,
    });

    const cleared = readFlaggedListenerRow({
      ...validRow(),
      cleared_at: clearedAt,
      cleared_by_admin_id: 7,
    });
    expect(cleared.cleared_at).toBe(clearedAt.toISOString());
    expect(cleared.cleared_by_admin_id).toBe(7);
    expect(cleared.flagged_at).toBe(flaggedAt.toISOString());
  });

  it('throws for an unknown reason, a missing id, or a non-number count', () => {
    expect(() => readFlaggedListenerRow({ ...validRow(), reason: 'daily_cap_reached' })).toThrow(
      'Expected a flagged listener row'
    );

    const withoutId = validRow();
    delete withoutId.id;
    expect(() => readFlaggedListenerRow(withoutId)).toThrow('Expected a flagged listener row');

    expect(() => readFlaggedListenerRow({ ...validRow(), listens_last_7_days: '4' })).toThrow(
      'Expected a flagged listener row'
    );
  });
});
