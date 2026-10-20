import type { AddByRSSParseStatus } from '@podverse/helpers';

import type { AddByRSSParseOutcome } from './actions';
import {
  applyAddByRSSParseStatus,
  enqueueAddByRSSParseWithStoredCredentials,
  pollAddByRSSParseStatus,
} from './actions';
import { listFeedsWithCredentials } from './credentialStore';
import { toAddByRSSFeedChangedUrl } from './feedChangedEvent';
import { claimAddByRSSParseInFlight, releaseAddByRSSParseInFlight } from './parseInFlight';
import { getAllAddByRSSFeeds } from './storage';
import type { AddByRSSFeedRecord, AddByRSSParsedFeed } from './types';

export type AddByRSSFirstParseStatusHandler = (
  feedUrl: string,
  parsedFeed: AddByRSSParsedFeed | undefined,
  status: AddByRSSParseStatus,
  cache?: AddByRSSFeedRecord['cache'],
  outcome?: AddByRSSParseOutcome
) => Promise<void>;

const loggedFirstParseErrors = new Set<string>();

const logFirstParseErrorOnce = (feedKey: string, error: unknown): void => {
  if (loggedFirstParseErrors.has(feedKey)) {
    return;
  }
  loggedFirstParseErrors.add(feedKey);
  console.error('Add by RSS first parse failed', error);
};

const applyStatus: AddByRSSFirstParseStatusHandler = async (
  feedUrl,
  parsedFeed,
  status,
  cache,
  outcome
) => {
  await applyAddByRSSParseStatus({ feedUrl, parsedFeed, status, cache, outcome });
};

/**
 * Never parsed on this browser: no cache, no successful parse, and no failure. A queued or
 * processing status left by an earlier page load counts, since that page's poll is gone.
 */
export function addByRSSFeedNeedsFirstParse(feed: AddByRSSFeedRecord): boolean {
  return (
    feed.cache === undefined &&
    (feed.lastParsedAt === undefined || feed.lastParsedAt === null) &&
    (feed.status === undefined || feed.status === 'queued' || feed.status === 'processing')
  );
}

const readFeedUrlsWithCredentials = async (accountId: string): Promise<ReadonlySet<string>> => {
  try {
    const feedUrls = await listFeedsWithCredentials(accountId);
    return new Set(feedUrls.map(toAddByRSSFeedChangedUrl));
  } catch (error) {
    console.error('Could not read add-by-RSS credentials on this browser', error);
    return new Set();
  }
};

/**
 * Starts one parse for each stored feed that needs a first parse, limited to `feedUrls` when
 * given. A feed that needs credentials this browser does not have is left alone: the parse would
 * only fail, and the list already asks for them. Returns the feed URLs it started.
 */
export async function enqueueAddByRSSFirstParses(params: {
  accountId: string;
  feedUrls?: readonly string[];
  onStatus?: AddByRSSFirstParseStatusHandler;
}): Promise<string[]> {
  const { accountId, onStatus = applyStatus } = params;
  const wanted = params.feedUrls ? new Set(params.feedUrls.map(toAddByRSSFeedChangedUrl)) : null;
  const feeds = await getAllAddByRSSFeeds();
  const feedUrlsWithCredentials = await readFeedUrlsWithCredentials(accountId);

  const pending: { feed: AddByRSSFeedRecord; feedKey: string }[] = [];
  for (const feed of feeds) {
    const feedKey = toAddByRSSFeedChangedUrl(feed.feedUrl);
    if (wanted !== null && !wanted.has(feedKey)) {
      continue;
    }
    if (!addByRSSFeedNeedsFirstParse(feed) || !claimAddByRSSParseInFlight(feed.feedUrl)) {
      continue;
    }
    if (feed.requiresCredentials === true && !feedUrlsWithCredentials.has(feedKey)) {
      releaseAddByRSSParseInFlight(feed.feedUrl);
      continue;
    }
    pending.push({ feed, feedKey });
  }

  const started: string[] = [];
  for (const { feed, feedKey } of pending) {
    try {
      const { request_id } = await enqueueAddByRSSParseWithStoredCredentials({
        accountId,
        feedUrl: feed.feedUrl,
      });
      await onStatus(feed.feedUrl, undefined, 'queued');
      started.push(feed.feedUrl);
      void pollAddByRSSParseStatus({
        requestId: request_id,
        onStatusUpdate: async (statusResponse) => {
          await onStatus(
            feed.feedUrl,
            statusResponse.payload,
            statusResponse.status,
            statusResponse.cache,
            statusResponse
          );
        },
      }).catch((error: unknown) => {
        logFirstParseErrorOnce(feedKey, error);
        releaseAddByRSSParseInFlight(feed.feedUrl);
      });
    } catch (error: unknown) {
      logFirstParseErrorOnce(feedKey, error);
      releaseAddByRSSParseInFlight(feed.feedUrl);
    }
  }
  return started;
}
