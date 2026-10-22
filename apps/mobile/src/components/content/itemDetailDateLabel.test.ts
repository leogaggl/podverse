import { describe, expect, it } from 'vitest';

import { formatDateAbbrev } from '@podverse/helpers';

import { itemDetailDateLabel } from './itemDetailDateLabel';

describe('itemDetailDateLabel', () => {
  it('formats an ISO string and the same instant as a Date the same way', () => {
    const iso = '2024-03-15T18:30:00.000Z';
    const asDate = new Date(iso);
    const fromString = itemDetailDateLabel(iso, 'en-US');
    const fromDate = itemDetailDateLabel(asDate, 'en-US');

    expect(fromString).toBe(fromDate);
    expect(fromString).toBe(formatDateAbbrev(asDate, 'en-US'));
  });

  it('returns null when the date is absent or unparseable', () => {
    expect(itemDetailDateLabel(null, 'en-US')).toBeNull();
    expect(itemDetailDateLabel(undefined, 'en-US')).toBeNull();
    expect(itemDetailDateLabel('', 'en-US')).toBeNull();
    expect(itemDetailDateLabel('not a date', 'en-US')).toBeNull();
  });
});
