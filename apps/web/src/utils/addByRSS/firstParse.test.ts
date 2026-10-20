import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  applyAddByRSSParseStatusMock,
  enqueueAddByRSSParseWithStoredCredentialsMock,
  getAllAddByRSSFeedsMock,
  listFeedsWithCredentialsMock,
  pollAddByRSSParseStatusMock,
} = vi.hoisted(() => ({
  applyAddByRSSParseStatusMock: vi.fn(),
  enqueueAddByRSSParseWithStoredCredentialsMock: vi.fn(),
  getAllAddByRSSFeedsMock: vi.fn(),
  listFeedsWithCredentialsMock: vi.fn(),
  pollAddByRSSParseStatusMock: vi.fn(),
}));

vi.mock('./actions', () => ({
  applyAddByRSSParseStatus: applyAddByRSSParseStatusMock,
  enqueueAddByRSSParseWithStoredCredentials: enqueueAddByRSSParseWithStoredCredentialsMock,
  pollAddByRSSParseStatus: pollAddByRSSParseStatusMock,
}));
vi.mock('./credentialStore', () => ({ listFeedsWithCredentials: listFeedsWithCredentialsMock }));
vi.mock('./storage', () => ({ getAllAddByRSSFeeds: getAllAddByRSSFeedsMock }));

import type { AddByRSSFeedRecord } from './types';

const ACCOUNT_ID = 'account-1';

const stub = (
  feedUrl: string,
  overrides: Partial<AddByRSSFeedRecord> = {}
): AddByRSSFeedRecord => ({
  id: 1,
  idText: `id-${feedUrl}`,
  resourceType: 'podcasts',
  feedUrl,
  title: feedUrl,
  imageUrl: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** A fresh module per test: the started set is module scope by design. */
const loadFirstParse = async () => import('./firstParse');

const enqueuedFeedUrls = (): unknown[] =>
  enqueueAddByRSSParseWithStoredCredentialsMock.mock.calls.map(([params]) => params.feedUrl);

describe('enqueueAddByRSSFirstParses', () => {
  beforeEach(() => {
    vi.resetModules();
    listFeedsWithCredentialsMock.mockResolvedValue([]);
    enqueueAddByRSSParseWithStoredCredentialsMock.mockResolvedValue({ request_id: 'request-1' });
    pollAddByRSSParseStatusMock.mockReturnValue(new Promise(() => undefined));
    applyAddByRSSParseStatusMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts one parse per feed however many callers ask', async () => {
    const { enqueueAddByRSSFirstParses } = await loadFirstParse();
    getAllAddByRSSFeedsMock.mockResolvedValue([stub('https://example.com/a.xml')]);

    await Promise.all([
      enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID }),
      enqueueAddByRSSFirstParses({
        accountId: ACCOUNT_ID,
        feedUrls: ['https://example.com/a.xml'],
      }),
    ]);
    await enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID });

    expect(enqueuedFeedUrls()).toEqual(['https://example.com/a.xml']);
    expect(applyAddByRSSParseStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ feedUrl: 'https://example.com/a.xml', status: 'queued' })
    );
  });

  it('parses only the feeds asked for, and only feeds never parsed here', async () => {
    const { enqueueAddByRSSFirstParses } = await loadFirstParse();
    getAllAddByRSSFeedsMock.mockResolvedValue([
      stub('https://example.com/wanted.xml'),
      stub('https://example.com/other.xml'),
      stub('https://example.com/stale-queued.xml', { status: 'queued' }),
      stub('https://example.com/parsed.xml', { lastParsedAt: '2026-01-01T00:00:00.000Z' }),
      stub('https://example.com/failed.xml', { status: 'failed' }),
    ]);

    await enqueueAddByRSSFirstParses({
      accountId: ACCOUNT_ID,
      feedUrls: ['https://example.com/wanted.xml'],
    });
    expect(enqueuedFeedUrls()).toEqual(['https://example.com/wanted.xml']);

    await enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID });
    expect(enqueuedFeedUrls()).toEqual([
      'https://example.com/wanted.xml',
      'https://example.com/other.xml',
      'https://example.com/stale-queued.xml',
    ]);
  });

  it('does not start a second parse for a feed the add flow already queued', async () => {
    const { markAddByRSSParseInFlight } = await import('./parseInFlight');
    markAddByRSSParseInFlight('https://example.com/a.xml');
    const { enqueueAddByRSSFirstParses } = await loadFirstParse();
    getAllAddByRSSFeedsMock.mockResolvedValue([
      stub('https://example.com/a.xml', { status: 'queued' }),
    ]);

    await expect(enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID })).resolves.toEqual([]);
    expect(enqueueAddByRSSParseWithStoredCredentialsMock).not.toHaveBeenCalled();
  });

  it('leaves a protected feed alone until this browser has its credentials', async () => {
    const { enqueueAddByRSSFirstParses } = await loadFirstParse();
    getAllAddByRSSFeedsMock.mockResolvedValue([
      stub('https://example.com/protected.xml', { requiresCredentials: true }),
    ]);

    await enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID });
    expect(enqueueAddByRSSParseWithStoredCredentialsMock).not.toHaveBeenCalled();

    listFeedsWithCredentialsMock.mockResolvedValue(['https://example.com/protected.xml']);
    await enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID });
    expect(enqueuedFeedUrls()).toEqual(['https://example.com/protected.xml']);
  });

  it('does not mark a feed queued when the enqueue fails, and lets a later call retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { enqueueAddByRSSFirstParses } = await loadFirstParse();
    getAllAddByRSSFeedsMock.mockResolvedValue([stub('https://example.com/a.xml')]);
    enqueueAddByRSSParseWithStoredCredentialsMock.mockRejectedValueOnce(new Error('429'));

    await expect(enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID })).resolves.toEqual([]);
    expect(applyAddByRSSParseStatusMock).not.toHaveBeenCalled();

    await expect(enqueueAddByRSSFirstParses({ accountId: ACCOUNT_ID })).resolves.toEqual([
      'https://example.com/a.xml',
    ]);
    consoleError.mockRestore();
  });
});
