import type { AddByRSSParseCacheEntry } from '@workers/lib/addByRSSParseCache.js';

import type {
  AddByRSSParseCredentialsState,
  AddByRSSPublisherListedFeed,
  CredentialScopeDecision,
} from '@podverse/helpers';
import { isValidReliableUUID, resolveCredentialScope } from '@podverse/helpers';
import type { AddByRSSDirectoryChannelMatch, FeedObject } from '@podverse/parser-mapping';
import {
  addByRSSResourceTypeListsFeeds,
  collectAddByRSSPublisherListedFeedRefs,
  getAddByRSSResourceTypeFromParsedFeed,
  planAddByRSSPublisherListedFeeds,
} from '@podverse/parser-mapping';

/** Host only: log lines never carry the path, query, or userinfo of a private feed URL. */
export const feedHostForLog = (feedUrl: string): string => {
  try {
    return new URL(feedUrl).host;
  } catch {
    return 'invalid-url';
  }
};

export type FanOutAddByRSSPublisherListedFeedsDeps = {
  findDirectoryChannels: (
    refs: readonly { feedGuid: string; feedUrl: string | null }[]
  ) => Promise<ReadonlyMap<string, AddByRSSDirectoryChannelMatch>>;
  /** Feed URLs by lowercased feed guid. */
  lookUpFeedUrlsByGuid: (guids: string[]) => Promise<ReadonlyMap<string, string>>;
  setCacheEntry: (entry: AddByRSSParseCacheEntry) => Promise<void>;
  enqueue: (options: {
    accountId: number;
    feedUrl: string;
    requestId: string;
    publisherRequestId: string;
    credentialsEnvelope?: string;
    credentialsWithheld?: Exclude<CredentialScopeDecision, 'send'>;
  }) => Promise<void>;
  /** Seals the publisher parse's opened credentials for one listed feed's own message. */
  sealCredentials: (input: { accountId: number; requestId: string; feedUrl: string }) => string;
  newRequestId: () => string;
  now: () => Date;
  logWarn: (message: string, context: Record<string, unknown>) => void;
  logError: (message: string, error: unknown) => void;
};

const QUEUE_FAILED_ERROR = 'Could not queue this feed for parsing.';

/**
 * Resolves the feeds a publisher (artist) feed lists for one member's Add by RSS parse. Feeds in
 * the directory are linked, not fetched. Every other listed feed with a URL gets a `queued` cache
 * entry and its own parse message before this returns, so each `add_by_rss` request id the
 * client reads already has an entry.
 *
 * Credentials reach a listed feed only when `resolveCredentialScope` allows the publisher feed's
 * credentials at that URL; the envelope is sealed for that feed's own request. A listed feed out
 * of scope carries the withheld decision instead. Podcast Index is asked for missing feed URLs
 * only when the publisher feed was fetched without credentials, so a private feed's references
 * never leave Podverse.
 *
 * Returns `undefined` when the feed's resource type does not list feeds. A failed lookup or a
 * failed enqueue is logged and reported per feed; other errors propagate.
 */
export const fanOutAddByRSSPublisherListedFeeds = async (
  input: {
    accountId: number;
    requestId: string;
    feedUrl: string;
    parsedFeed: FeedObject;
    /** The publisher parse's credentials state (sent, not_provided, withheld_*). */
    credentialsState: AddByRSSParseCredentialsState;
    /** True when the publisher message's envelope opened (basicAuth was available). */
    hasCredentials: boolean;
    allowInsecure: boolean;
  },
  deps: FanOutAddByRSSPublisherListedFeedsDeps
): Promise<AddByRSSPublisherListedFeed[] | undefined> => {
  const { accountId, requestId: publisherRequestId, feedUrl: publisherFeedUrl } = input;

  if (!addByRSSResourceTypeListsFeeds(getAddByRSSResourceTypeFromParsedFeed(input.parsedFeed))) {
    return undefined;
  }

  const { refs, droppedCount } = collectAddByRSSPublisherListedFeedRefs(
    input.parsedFeed,
    publisherFeedUrl
  );
  if (droppedCount > 0) {
    deps.logWarn('fanOutAddByRSSPublisherListedFeeds: listed feeds past the cap were dropped', {
      requestId: publisherRequestId,
      feedHost: feedHostForLog(publisherFeedUrl),
      droppedCount,
    });
  }

  const directoryByFeedGuid = await deps.findDirectoryChannels(refs);

  const guidsToLookUp = refs
    .filter(
      (ref) =>
        ref.listedAtChannelLevel &&
        ref.feedUrl === null &&
        !directoryByFeedGuid.has(ref.feedGuid.toLowerCase()) &&
        isValidReliableUUID(ref.feedGuid)
    )
    .map((ref) => ref.feedGuid);

  let lookedUpFeedUrlByFeedGuid: ReadonlyMap<string, string> = new Map();
  if (guidsToLookUp.length > 0 && input.credentialsState !== 'sent') {
    try {
      lookedUpFeedUrlByFeedGuid = await deps.lookUpFeedUrlsByGuid(guidsToLookUp);
    } catch (error) {
      deps.logError(
        `fanOutAddByRSSPublisherListedFeeds: feed URL lookup failed (${feedHostForLog(publisherFeedUrl)})`,
        error
      );
    }
  }

  const { listedFeeds, feedsToParse } = planAddByRSSPublisherListedFeeds({
    refs,
    directoryByFeedGuid,
    lookedUpFeedUrlByFeedGuid,
    newRequestId: deps.newRequestId,
  });

  for (const feed of feedsToParse) {
    await deps.setCacheEntry({
      requestId: feed.requestId,
      accountId,
      feedUrl: feed.feedUrl,
      status: 'queued',
      publisherRequestId,
      updatedAt: deps.now().toISOString(),
    });

    let credentialsEnvelope: string | undefined;
    let credentialsWithheld: Exclude<CredentialScopeDecision, 'send'> | undefined;
    if (input.hasCredentials) {
      const decision = resolveCredentialScope(publisherFeedUrl, feed.feedUrl, {
        allowInsecure: input.allowInsecure,
      });
      if (decision === 'send') {
        credentialsEnvelope = deps.sealCredentials({
          accountId,
          requestId: feed.requestId,
          feedUrl: feed.feedUrl,
        });
      } else {
        credentialsWithheld = decision;
      }
    }

    try {
      await deps.enqueue({
        accountId,
        feedUrl: feed.feedUrl,
        requestId: feed.requestId,
        publisherRequestId,
        ...(credentialsEnvelope !== undefined ? { credentialsEnvelope } : {}),
        ...(credentialsWithheld !== undefined ? { credentialsWithheld } : {}),
      });
    } catch (error) {
      deps.logError(
        `fanOutAddByRSSPublisherListedFeeds: could not queue a listed feed (${feedHostForLog(feed.feedUrl)})`,
        error
      );
      await deps.setCacheEntry({
        requestId: feed.requestId,
        accountId,
        feedUrl: feed.feedUrl,
        status: 'failed',
        error: QUEUE_FAILED_ERROR,
        publisherRequestId,
        updatedAt: deps.now().toISOString(),
      });
    }
  }

  return listedFeeds;
};
