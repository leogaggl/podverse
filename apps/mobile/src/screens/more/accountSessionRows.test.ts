import { describe, expect, it } from 'vitest';

import type { DTOAccountSession } from '@podverse/helpers';

import type { AccountSessionRow } from './accountSessionRows';
import {
  onlyCurrentAccountSession,
  toAccountSessionRows,
  withoutAccountSession,
} from './accountSessionRows';

const session = (overrides: Partial<DTOAccountSession> = {}): DTOAccountSession => ({
  client_type: 'mobile',
  created_at: '2026-01-01T00:00:00.000Z',
  device_label: 'iPhone · iOS',
  id_text: 'session-a',
  is_current: false,
  last_seen_at: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

describe('toAccountSessionRows', () => {
  it('puts the current session first and keeps the others in server order', () => {
    const rows = toAccountSessionRows([
      session({ device_label: 'Firefox · macOS', id_text: 'web-older', client_type: 'web' }),
      session({ device_label: 'iPhone · iOS', id_text: 'this-phone', is_current: true }),
      session({ device_label: null, id_text: 'web-newer', client_type: 'web' }),
    ]);

    expect(rows.map((row) => row.idText)).toEqual(['this-phone', 'web-older', 'web-newer']);
    expect(rows[0]?.isCurrent).toBe(true);
    expect(rows[2]?.deviceLabel).toBeNull();
    expect(rows[2]?.clientType).toBe('web');
  });

  it('leaves server order alone when the current session is already first or missing', () => {
    const alreadyFirst = toAccountSessionRows([
      session({ id_text: 'current', is_current: true }),
      session({ id_text: 'other' }),
    ]);
    const noneCurrent = toAccountSessionRows([
      session({ id_text: 'first' }),
      session({ id_text: 'second' }),
    ]);

    expect(alreadyFirst.map((row) => row.idText)).toEqual(['current', 'other']);
    expect(noneCurrent.map((row) => row.idText)).toEqual(['first', 'second']);
  });

  it('treats a blank device label as missing', () => {
    const [row] = toAccountSessionRows([session({ device_label: '' })]);
    expect(row?.deviceLabel).toBeNull();
  });
});

describe('local session-list updates', () => {
  const rows: AccountSessionRow[] = [
    {
      clientType: 'mobile',
      deviceLabel: 'iPhone · iOS',
      idText: 'current',
      isCurrent: true,
      lastSeenAt: '2026-01-02T00:00:00.000Z',
    },
    {
      clientType: 'web',
      deviceLabel: 'Firefox · macOS',
      idText: 'other',
      isCurrent: false,
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('removes one session and can keep only the current session', () => {
    expect(withoutAccountSession(rows, 'other').map((row) => row.idText)).toEqual(['current']);
    expect(onlyCurrentAccountSession(rows).map((row) => row.idText)).toEqual(['current']);
  });
});
