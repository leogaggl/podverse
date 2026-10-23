import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionEndReason } from './forcedLogoutNotice';
import {
  clearForcedLogoutNotice,
  markForcedLogout,
  readPendingForcedLogoutNotice,
  shouldNotifyForcedLogout,
} from './forcedLogoutNotice';

const inMemoryStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => {
        return inMemoryStore.has(key) ? (inMemoryStore.get(key) ?? null) : null;
      }),
      removeItem: vi.fn(async (key: string) => {
        inMemoryStore.delete(key);
      }),
      setItem: vi.fn(async (key: string, value: string) => {
        inMemoryStore.set(key, value);
      }),
    },
  };
});

describe('forcedLogoutNotice', () => {
  beforeEach(() => {
    inMemoryStore.clear();
    vi.mocked(AsyncStorage.getItem).mockClear();
    vi.mocked(AsyncStorage.removeItem).mockClear();
    vi.mocked(AsyncStorage.setItem).mockClear();
  });

  it('notifies only when the server ended the session', () => {
    // The whole point of the reason: signing yourself out must stay silent, and a fixture reset
    // must not look like a real sign-out.
    const allReasons: SessionEndReason[] = ['user_logout', 'session_expired', 'reset'];

    expect(allReasons.filter(shouldNotifyForcedLogout)).toEqual(['session_expired']);
  });

  it('has nothing pending until a forced logout is recorded', async () => {
    await expect(readPendingForcedLogoutNotice()).resolves.toBeNull();
  });

  it('stores the server notice beside the marker', async () => {
    await markForcedLogout({
      notice: 'security',
      occurredAt: new Date('2026-08-28T12:00:00.000Z'),
    });

    expect(vi.mocked(AsyncStorage.setItem).mock.calls.map((call) => call[0])).toEqual([
      'auth.forced_logout_notice',
      'auth.forced_logout_at',
    ]);
    expect(inMemoryStore.get('auth.forced_logout_notice')).toBe('security');
    expect(inMemoryStore.get('auth.forced_logout_at')).toBe('2026-08-28T12:00:00.000Z');
    await expect(readPendingForcedLogoutNotice()).resolves.toEqual({ notice: 'security' });
  });

  it('records no notice key when the 401 named none', async () => {
    await markForcedLogout({ notice: null });

    expect(inMemoryStore.has('auth.forced_logout_notice')).toBe(false);
    await expect(readPendingForcedLogoutNotice()).resolves.toEqual({ notice: null });
  });

  it('survives being read repeatedly, so a relaunch still shows it', async () => {
    await markForcedLogout({ notice: 'password_changed' });

    await expect(readPendingForcedLogoutNotice()).resolves.toEqual({ notice: 'password_changed' });
    await expect(readPendingForcedLogoutNotice()).resolves.toEqual({ notice: 'password_changed' });
  });

  it('stops reporting once the notice is consumed', async () => {
    await markForcedLogout({ notice: 'admin_force_logout' });
    vi.mocked(AsyncStorage.removeItem).mockClear();
    await clearForcedLogoutNotice();

    expect(vi.mocked(AsyncStorage.removeItem).mock.calls.map((call) => call[0])).toEqual([
      'auth.forced_logout_at',
      'auth.forced_logout_notice',
    ]);
    await expect(readPendingForcedLogoutNotice()).resolves.toBeNull();
  });

  it('reads a stored notice outside the known set as none', async () => {
    inMemoryStore.set('auth.forced_logout_at', '2026-08-28T12:00:00.000Z');
    inMemoryStore.set('auth.forced_logout_notice', 'refresh_reuse');

    await expect(readPendingForcedLogoutNotice()).resolves.toEqual({ notice: null });
  });

  it('treats an empty marker as nothing pending', async () => {
    inMemoryStore.set('auth.forced_logout_at', '');
    inMemoryStore.set('auth.forced_logout_notice', 'security');

    await expect(readPendingForcedLogoutNotice()).resolves.toBeNull();
  });
});
