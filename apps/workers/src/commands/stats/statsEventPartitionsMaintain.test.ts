import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureMock, dropMock, loggerInfoMock } = vi.hoisted(() => ({
  ensureMock: vi.fn(),
  dropMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@workers/factories/logger.js', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
  }),
}));

vi.mock('@podverse/orm', () => ({
  STATS_EVENT_PARENT_TABLES: ['stats_listen_event', 'stats_open_event'],
  ensureStatsEventMonthPartition: ensureMock,
  dropStatsEventMonthPartitionsBefore: dropMock,
}));

import { statsEventPartitionsMaintain } from './statsEventPartitionsMaintain.js';

const NOW = new Date('2026-10-21T03:30:00.000Z');

describe('statsEventPartitionsMaintain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    ensureMock.mockReset();
    dropMock.mockReset();
    loggerInfoMock.mockReset();
    ensureMock.mockResolvedValue(true);
    dropMock.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.STATS_TRACK_EVENT_RETENTION_DAYS;
  });

  it('ensures three months for both event tables, then drops months before the default cutoff', async () => {
    await statsEventPartitionsMaintain({ _: [] });

    expect(ensureMock.mock.calls).toEqual([
      ['stats_listen_event', '2026-10-01'],
      ['stats_listen_event', '2026-11-01'],
      ['stats_listen_event', '2026-12-01'],
      ['stats_open_event', '2026-10-01'],
      ['stats_open_event', '2026-11-01'],
      ['stats_open_event', '2026-12-01'],
    ]);
    expect(dropMock.mock.calls).toEqual([
      ['stats_listen_event', '2026-07-01'],
      ['stats_open_event', '2026-07-01'],
    ]);
  });

  it('ensures every partition before it drops any', async () => {
    await statsEventPartitionsMaintain({ _: [] });

    const lastEnsureOrder = Math.max(...ensureMock.mock.invocationCallOrder);
    const firstDropOrder = Math.min(...dropMock.mock.invocationCallOrder);
    expect(lastEnsureOrder).toBeLessThan(firstDropOrder);
  });

  it('uses an explicit retention window for the cutoff', async () => {
    process.env.STATS_TRACK_EVENT_RETENTION_DAYS = '30';

    await statsEventPartitionsMaintain({ _: [] });

    expect(dropMock.mock.calls).toEqual([
      ['stats_listen_event', '2026-09-01'],
      ['stats_open_event', '2026-09-01'],
    ]);
  });

  it('rejects without dropping anything when an ensure call fails', async () => {
    ensureMock.mockRejectedValueOnce(new Error('ensure failed'));

    await expect(statsEventPartitionsMaintain({ _: [] })).rejects.toThrow('ensure failed');
    expect(dropMock).not.toHaveBeenCalled();
  });
});
