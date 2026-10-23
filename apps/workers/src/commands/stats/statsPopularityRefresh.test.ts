import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshMock, loggerInfoMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@workers/factories/logger.js', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
  }),
}));

vi.mock('@workers/factories/timerManager.js', () => ({
  getTimerManager: () => ({
    start: vi.fn(),
    end: vi.fn(),
  }),
}));

vi.mock('@podverse/orm', () => ({
  refreshStatsPopularity: refreshMock,
}));

import { statsPopularityRefresh } from './statsPopularityRefresh.js';

const NOW = new Date('2026-10-21T00:30:00.000Z');

describe('statsPopularityRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    refreshMock.mockReset();
    loggerInfoMock.mockReset();
    refreshMock.mockResolvedValue([
      { entityType: 'channel', rowsWritten: 3, rowsZeroed: 1 },
      { entityType: 'item', rowsWritten: 0, rowsZeroed: 0 },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes recent range totals ending on the current UTC date by default', async () => {
    await statsPopularityRefresh({ _: [] });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledWith({ today: '2026-10-21', mode: 'recent' });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'statsPopularityRefresh channel rows_written=3 rows_zeroed=1'
    );
  });

  it('runs a full refresh when -full is passed', async () => {
    await statsPopularityRefresh({ _: [], full: '' });

    expect(refreshMock).toHaveBeenCalledWith({ today: '2026-10-21', mode: 'full' });
  });

  it('rejects when the refresh fails', async () => {
    refreshMock.mockRejectedValueOnce(new Error('refresh failed'));

    await expect(statsPopularityRefresh({ _: [] })).rejects.toThrow('refresh failed');
  });
});
