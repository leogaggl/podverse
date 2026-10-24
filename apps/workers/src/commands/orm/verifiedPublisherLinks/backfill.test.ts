import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  computeForContentChannelMock,
  loggerErrorMock,
  loggerInfoMock,
  queryMock,
  recomputeForContentChannelMock,
} = vi.hoisted(() => ({
  computeForContentChannelMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  queryMock: vi.fn(),
  recomputeForContentChannelMock: vi.fn(),
}));

vi.mock('@workers/factories/logger.js', () => ({
  getLogger: () => ({
    error: loggerErrorMock,
    info: loggerInfoMock,
  }),
}));

vi.mock('@podverse/orm', () => {
  class ChannelVerifiedPublisherService {
    computeForContentChannel = computeForContentChannelMock;
    recomputeForContentChannel = recomputeForContentChannelMock;
  }

  return {
    AppDataSourceReadWrite: {
      manager: {
        query: queryMock,
      },
    },
    ChannelVerifiedPublisherService,
  };
});

import { ormVerifiedPublisherLinksBackfill } from './backfill.js';

const batchOne = [{ channel_id: 11 }, { channel_id: 22 }];
const batchTwo = [{ channel_id: 33 }];

const mockTwoBatchesThenEmpty = () => {
  queryMock
    .mockResolvedValueOnce(batchOne)
    .mockResolvedValueOnce(batchTwo)
    .mockResolvedValueOnce([]);
};

const infoLines = (): string[] =>
  loggerInfoMock.mock.calls.map((call) => (typeof call[0] === 'string' ? call[0] : ''));

describe('ormVerifiedPublisherLinksBackfill', () => {
  beforeEach(() => {
    computeForContentChannelMock.mockReset();
    loggerErrorMock.mockReset();
    loggerInfoMock.mockReset();
    queryMock.mockReset();
    recomputeForContentChannelMock.mockReset();
  });

  it('recomputes every id in order and resumes each batch after its last id', async () => {
    mockTwoBatchesThenEmpty();
    recomputeForContentChannelMock.mockResolvedValue(1);

    await ormVerifiedPublisherLinksBackfill({ _: [] });

    expect(queryMock).toHaveBeenNthCalledWith(1, expect.any(String), [0, 500]);
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.any(String), [22, 500]);
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.any(String), [33, 500]);
    expect(recomputeForContentChannelMock.mock.calls.map((call) => call[0])).toEqual([11, 22, 33]);
    expect(computeForContentChannelMock).not.toHaveBeenCalled();
    expect(infoLines().at(-1)).toContain('channels_scanned=3 links_stored=3 channels_failed=0');
  });

  it('counts links on a dry run and does not recompute', async () => {
    mockTwoBatchesThenEmpty();
    computeForContentChannelMock
      .mockResolvedValueOnce([{ publisherChannelId: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ publisherChannelId: 2 }, { publisherChannelId: 3 }]);

    await ormVerifiedPublisherLinksBackfill({ _: [], 'dry-run': '' });

    expect(computeForContentChannelMock.mock.calls.map((call) => call[0])).toEqual([11, 22, 33]);
    expect(recomputeForContentChannelMock).not.toHaveBeenCalled();
    const finalLine = infoLines().at(-1) ?? '';
    expect(finalLine).toContain('links_found=3');
    expect(finalLine).not.toContain('links_stored');
  });

  it('continues after a channel fails and reports channels_failed=1', async () => {
    mockTwoBatchesThenEmpty();
    recomputeForContentChannelMock
      .mockResolvedValueOnce(4)
      .mockRejectedValueOnce(new Error('lock timeout'))
      .mockResolvedValueOnce(1);

    await ormVerifiedPublisherLinksBackfill({ _: [] });

    expect(recomputeForContentChannelMock.mock.calls.map((call) => call[0])).toEqual([11, 22, 33]);
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('channel_id=22'));
    expect(infoLines().at(-1)).toContain('channels_failed=1');
  });
});
