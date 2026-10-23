import type {
  AddByRSSFeedRecord as AddByRSSFeedRecordBase,
  AddByRSSParseFailureReason,
  AddByRSSPublisherListedFeed,
} from '@podverse/helpers';
import type { ParseRSSFeedForAddByRSSResult } from '@podverse/parser';

// Re-export from parser-mapping
export type {
  AddByRSSItemIndexItem,
  AddByRSSLivestreamIndexItem,
  AddByRSSMappedFeed,
} from '@podverse/parser-mapping';

// Re-export from helpers
export type {
  AddByRSSResourceType,
  AddByRSSCache,
  AddByRSSParseAllParams,
} from '@podverse/helpers';

import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

type ParsedFeedResult = Extract<ParseRSSFeedForAddByRSSResult, { status: 'parsed' }>;

export type AddByRSSParsedFeed = ParsedFeedResult['parsedFeed'];

/** Web feed record: helpers shape + mappedFeed from parser-mapping for type safety. */
export type AddByRSSFeedRecord = AddByRSSFeedRecordBase & {
  mappedFeed?: AddByRSSMappedFeed;
  /** Mirrors the follow row's `requires_credentials`, refined by this device's parse results. */
  requiresCredentials?: boolean;
  /** Why the most recent parse failed; cleared by the next successful parse. */
  lastFailureReason?: AddByRSSParseFailureReason | null;
  /** Set once a stored parse has carried a live item; never cleared. Absent on older records. */
  mayHaveLivestreams?: boolean;
};

/**
 * An album an Add by RSS artist on this browser lists, parsed for the member but not followed.
 * Kept apart from followed feeds so the follow sync never removes it; it leaves when no stored
 * artist lists it.
 */
export type AddByRSSListedFeedRecord = AddByRSSFeedRecord & {
  /** The album parse the artist's parse started; polled until it settles. */
  publisherParseRequestId: string | null;
  /** Track idTexts by item guid. Listed tracks never enter the items index. */
  itemIdTextsByGuid: Record<string, string>;
  /** Livestream idTexts by item guid. Listed livestreams never enter the liveItems store. */
  liveItemIdTextsByGuid: Record<string, string>;
};

/** What one parsed Add by RSS artist on this browser lists. */
export type AddByRSSPublisherLinkRecord = {
  /** Canonical feed URL of the artist feed; the store key. */
  publisherFeedUrl: string;
  /** The artist's `idText` in the feeds store. */
  publisherIdText: string;
  publisherTitle: string;
  /** The artist feed's `podcast:guid`, trimmed and lowercased; null when it has none. */
  publisherGuid: string | null;
  listedFeeds: AddByRSSPublisherListedFeed[];
  updatedAt: string;
};

/** An album record and which store it came from. */
export type AddByRSSAlbumSource =
  | { followed: true; feed: AddByRSSFeedRecord }
  | { followed: false; feed: AddByRSSListedFeedRecord };
