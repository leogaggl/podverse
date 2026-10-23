import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS, ONE_DAY_MS } from '@podverse/helpers';

const { deleteIdleExpiredBeforeMock, loggerInfoMock } = vi.hoisted(() => ({
  deleteIdleExpiredBeforeMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@workers/factories/logger.js', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
  }),
}));

vi.mock('@podverse/orm', () => ({
  deleteAccountSessionsIdleExpiredBefore: deleteIdleExpiredBeforeMock,
}));

import { accountSessionPurge } from './purge.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('accountSessionPurge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    deleteIdleExpiredBeforeMock.mockReset();
    loggerInfoMock.mockReset();
    deleteIdleExpiredBeforeMock.mockResolvedValue(4);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ACCOUNT_SESSION_RETENTION_DAYS;
  });

  it('deletes rows whose idle expiry is before the default retention window', async () => {
    await accountSessionPurge({ _: [] });

    expect(deleteIdleExpiredBeforeMock).toHaveBeenCalledTimes(1);
    expect(deleteIdleExpiredBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS * ONE_DAY_MS)
    );
  });

  it('uses an explicit retention window', async () => {
    process.env.ACCOUNT_SESSION_RETENTION_DAYS = '10';

    await accountSessionPurge({ _: [] });

    expect(deleteIdleExpiredBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - 10 * ONE_DAY_MS)
    );
  });
});
