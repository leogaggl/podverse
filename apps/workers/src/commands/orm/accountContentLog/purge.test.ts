import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_ACCOUNT_CONTENT_LOG_RETENTION_DAYS, ONE_DAY_MS } from '@podverse/helpers';

const { deleteUpdatedBeforeMock, loggerInfoMock } = vi.hoisted(() => ({
  deleteUpdatedBeforeMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@workers/factories/logger.js', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
  }),
}));

vi.mock('@podverse/orm', () => ({
  deleteAccountContentLogsUpdatedBefore: deleteUpdatedBeforeMock,
}));

import { accountContentLogPurge } from './purge.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('accountContentLogPurge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    deleteUpdatedBeforeMock.mockReset();
    loggerInfoMock.mockReset();
    deleteUpdatedBeforeMock.mockResolvedValue(4);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ACCOUNT_CONTENT_LOG_RETENTION_DAYS;
  });

  it('deletes rows whose updated_at is before the default retention window', async () => {
    await accountContentLogPurge({ _: [] });

    expect(deleteUpdatedBeforeMock).toHaveBeenCalledTimes(1);
    expect(deleteUpdatedBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - DEFAULT_ACCOUNT_CONTENT_LOG_RETENTION_DAYS * ONE_DAY_MS)
    );
  });

  it('uses an explicit retention window', async () => {
    process.env.ACCOUNT_CONTENT_LOG_RETENTION_DAYS = '10';

    await accountContentLogPurge({ _: [] });

    expect(deleteUpdatedBeforeMock.mock.calls[0]?.[0]).toEqual(
      new Date(NOW.getTime() - 10 * ONE_DAY_MS)
    );
  });
});
