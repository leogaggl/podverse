import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ONE_DAY_MS } from '@podverse/helpers';

const { deleteIdleExpiredBeforeMock, loggerInfoMock } = vi.hoisted(() => ({
  deleteIdleExpiredBeforeMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@management-api/factories/loggerService.js', () => ({
  loggerService: {
    info: loggerInfoMock,
  },
}));

vi.mock('@management-api/orm/services/adminSession.js', () => ({
  deleteAdminSessionsIdleExpiredBefore: deleteIdleExpiredBeforeMock,
}));

import { adminSessionPurge, DEFAULT_ADMIN_SESSION_RETENTION_DAYS } from './adminSessionPurge.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('adminSessionPurge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    deleteIdleExpiredBeforeMock.mockReset();
    loggerInfoMock.mockReset();
    deleteIdleExpiredBeforeMock.mockResolvedValue(4);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ADMIN_SESSION_RETENTION_DAYS;
  });

  it('deletes rows whose idle expiry is before the default retention window', async () => {
    delete process.env.ADMIN_SESSION_RETENTION_DAYS;

    await adminSessionPurge();

    expect(deleteIdleExpiredBeforeMock).toHaveBeenCalledTimes(1);
    expect(deleteIdleExpiredBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - DEFAULT_ADMIN_SESSION_RETENTION_DAYS * ONE_DAY_MS)
    );
  });

  it('uses an explicit retention window', async () => {
    process.env.ADMIN_SESSION_RETENTION_DAYS = '10';

    await adminSessionPurge();

    expect(deleteIdleExpiredBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - 10 * ONE_DAY_MS)
    );
  });
});
