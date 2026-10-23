import { randomUUID } from 'node:crypto';

import type { AddByRSSParseCacheEntry } from '@api/lib/addByRSSParseCache.js';
import { setAddByRSSParseCacheEntry } from '@api/lib/addByRSSParseCache.js';

import type { AddByRSSPublisherListedFeed } from '@podverse/helpers';
import { ChannelAddByRSSDirectoryMatchService } from '@podverse/orm';
import {
  addByRSSResourceTypeListsFeeds,
  collectAddByRSSPublisherListedFeedRefs,
  getAddByRSSResourceTypeFromParsedFeed,
  planAddByRSSPublisherListedFeeds,
} from '@podverse/parser-mapping';

type E2eParsedFeedPayload = NonNullable<AddByRSSParseCacheEntry['payload']>;

/**
 * E2E fixtures only. Resolves a fixture publisher feed's listed feeds the way the Add by RSS
 * worker does, without a broker: directory albums are linked, and every other listed album gets
 * its own `parsed` entry written now from the fixture payload for its URL.
 */
export const writeE2eAddByRSSPublisherListedFeeds = async (input: {
  accountId: number;
  requestId: string;
  feedUrl: string;
  payload: E2eParsedFeedPayload;
  payloadForFeedUrl: (feedUrl: string) => E2eParsedFeedPayload;
}): Promise<AddByRSSPublisherListedFeed[] | undefined> => {
  if (!addByRSSResourceTypeListsFeeds(getAddByRSSResourceTypeFromParsedFeed(input.payload))) {
    return undefined;
  }

  const { refs } = collectAddByRSSPublisherListedFeedRefs(input.payload, input.feedUrl);
  const directoryByFeedGuid = await new ChannelAddByRSSDirectoryMatchService().getForListedFeeds(
    refs
  );
  const { listedFeeds, feedsToParse } = planAddByRSSPublisherListedFeeds({
    refs,
    directoryByFeedGuid,
    lookedUpFeedUrlByFeedGuid: new Map(),
    newRequestId: randomUUID,
  });

  for (const { requestId, feedUrl } of feedsToParse) {
    await setAddByRSSParseCacheEntry({
      requestId,
      accountId: input.accountId,
      feedUrl,
      status: 'parsed',
      cache: {},
      payload: input.payloadForFeedUrl(feedUrl),
      publisherRequestId: input.requestId,
      updatedAt: new Date().toISOString(),
    });
  }

  return listedFeeds;
};
