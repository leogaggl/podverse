import { describe, expect, it, vi } from 'vitest';

import type { ParseRSSFeedForAddByRSSResult } from '@podverse/parser';

import { applyAddByRSSFollowMetadata } from './applyAddByRSSFollowMetadata.js';

type ParsedFeed = Extract<ParseRSSFeedForAddByRSSResult, { status: 'parsed' }>['parsedFeed'];

const ACCOUNT_ID = 7;
const FEED_URL = 'https://example.com/feed.xml';

/** Only the channel fields the selection reads; the rest of a parse does not matter here. */
const parsed = (feed: { title: string; itunesImage?: string }): ParseRSSFeedForAddByRSSResult => ({
  status: 'parsed',
  parsedFeed: {
    explicit: false,
    link: 'https://example.com',
    items: [],
    ...feed,
  } as unknown as ParsedFeed,
  cache: { feedHash: 'hash' },
});

const run = async (result: ParseRSSFeedForAddByRSSResult | undefined) => {
  const setFeedMetadata = vi.fn<
    (accountId: number, feedUrl: string, metadata: object) => Promise<void>
  >(async () => undefined);
  const onError = vi.fn();
  await applyAddByRSSFollowMetadata({
    accountId: ACCOUNT_ID,
    feedUrl: FEED_URL,
    result,
    setFeedMetadata,
    onError,
  });
  return { setFeedMetadata, onError };
};

describe('applyAddByRSSFollowMetadata', () => {
  it('writes the channel title and image after a parse', async () => {
    const { setFeedMetadata } = await run(
      parsed({ title: 'Real Show Name', itunesImage: 'https://cdn.example.com/cover.png' })
    );

    expect(setFeedMetadata).toHaveBeenCalledWith(ACCOUNT_ID, FEED_URL, {
      title: 'Real Show Name',
      image_url: 'https://cdn.example.com/cover.png',
    });
  });

  it('sends no title when the feed has none, so the stored title stays', async () => {
    const { setFeedMetadata } = await run(
      parsed({ title: '  ', itunesImage: 'https://cdn.example.com/cover.png' })
    );

    expect(setFeedMetadata).toHaveBeenCalledWith(ACCOUNT_ID, FEED_URL, {
      image_url: 'https://cdn.example.com/cover.png',
    });
  });

  it('does nothing for an unchanged feed, a failed parse, or a fetch error', async () => {
    const notModified = await run({ status: 'not_modified', cache: {} });
    const failed = await run({ status: 'failed', error: 'HTTP 500' });
    const fetchError = await run(undefined);

    expect(notModified.setFeedMetadata).not.toHaveBeenCalled();
    expect(failed.setFeedMetadata).not.toHaveBeenCalled();
    expect(fetchError.setFeedMetadata).not.toHaveBeenCalled();
  });

  it('reports a write failure instead of failing the parse', async () => {
    const error = new Error('db down');
    const setFeedMetadata = vi.fn(async () => {
      throw error;
    });
    const onError = vi.fn();

    await expect(
      applyAddByRSSFollowMetadata({
        accountId: ACCOUNT_ID,
        feedUrl: FEED_URL,
        result: parsed({ title: 'Show' }),
        setFeedMetadata,
        onError,
      })
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
