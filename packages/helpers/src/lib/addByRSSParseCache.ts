export type AddByRSSParseStatus = 'queued' | 'processing' | 'parsed' | 'not_modified' | 'failed';

export type AddByRSSParseFailureReason =
  | 'credentials_required'
  | 'credentials_rejected'
  | 'credentials_withheld_other_domain'
  | 'credentials_withheld_insecure'
  | 'credentials_envelope_invalid'
  | 'http_error'
  | 'network'
  | 'parse';

export type AddByRSSParseAuthChallenge = 'basic' | 'other' | 'none';

export type AddByRSSParseCredentialsState =
  'sent' | 'not_provided' | 'withheld_other_domain' | 'withheld_insecure' | 'decrypt_failed';

/** Why a feed a publisher feed lists was neither linked nor parsed. */
export type AddByRSSPublisherListedFeedUnresolvedReason =
  /** Listed at channel level, not in the directory, and no feed URL was known or found. */
  | 'no_feed_url'
  /** Named only by item-level references (track credits), and not in the directory. */
  | 'item_references_only';

type AddByRSSPublisherListedFeedBase = {
  /** The listed feed's guid as the publisher feed wrote it, trimmed. Compare case-insensitively. */
  feedGuid: string;
  /** Canonical feed URL: the reference's own, or one Podcast Index returned. Null when unknown. */
  feedUrl: string | null;
  /** The reference's `title` attribute, when it has one. */
  title: string | null;
  /** True when the publisher feed lists this feed itself, not only items in it. */
  listedAtChannelLevel: boolean;
  /** Item guids of item-level references into this feed, in feed order, without duplicates. */
  itemGuids: string[];
};

/**
 * A feed a publisher (artist) feed lists, as the server resolved it for one member's parse.
 * `directory`: already in the Podverse directory; link to that channel, nothing was fetched.
 * `add_by_rss`: parsed for this member; poll `requestId` like any Add by RSS parse.
 * `unresolved`: neither; see `reason`.
 */
export type AddByRSSPublisherListedFeed =
  | (AddByRSSPublisherListedFeedBase & {
      kind: 'directory';
      channelIdText: string;
      channelTitle: string | null;
      mediumId: number | null;
    })
  | (AddByRSSPublisherListedFeedBase & { kind: 'add_by_rss'; requestId: string })
  | (AddByRSSPublisherListedFeedBase & {
      kind: 'unresolved';
      reason: AddByRSSPublisherListedFeedUnresolvedReason;
    });

/**
 * Parse status stored in Valkey and returned to clients. Never carries username or password —
 * only machine-readable metadata about whether credentials were sent and how the origin answered.
 * Metadata fields are optional; an entry that omits them is valid.
 */
export type AddByRSSParseCacheEntry<TParsedFeed> = {
  requestId: string;
  accountId: number;
  feedUrl: string;
  status: AddByRSSParseStatus;
  cache?: {
    feedHash?: string;
    etag?: string;
    lastModified?: string;
  };
  payload?: TParsedFeed;
  error?: string;
  failureReason?: AddByRSSParseFailureReason;
  httpStatus?: number;
  authChallenge?: AddByRSSParseAuthChallenge;
  credentialsState?: AddByRSSParseCredentialsState;
  /**
   * On a `parsed` entry for a feed whose resource type lists other feeds (artists): the feeds it
   * lists, in feed order. Absent when the feed lists nothing by type, or when the server could
   * not resolve the list; an empty array means it lists no eligible feed.
   */
  publisherListedFeeds?: AddByRSSPublisherListedFeed[];
  /** Set on the entry of a feed parsed because a publisher feed listed it: that parse's id. */
  publisherRequestId?: string;
  updatedAt: string;
};

export type CacheGetJson = <T>(key: string) => Promise<T | null>;
export type CacheSetJson = <T>(key: string, value: T, ttlSeconds?: number | null) => Promise<void>;

/** Keep in sync with `@podverse/helpers-backend` `buildAddByRSSParseCacheKey` (avoid helpers → helpers-backend cycle). */
const addByRSSParseCacheKey = (requestId: string): string => `addByRSS:parse:${requestId}`;

export const getAddByRSSParseCacheEntry = async <TParsedFeed>(
  cacheGetJson: CacheGetJson,
  requestId: string
): Promise<AddByRSSParseCacheEntry<TParsedFeed> | null> =>
  cacheGetJson<AddByRSSParseCacheEntry<TParsedFeed>>(addByRSSParseCacheKey(requestId));

export const setAddByRSSParseCacheEntry = async <TParsedFeed>(
  cacheSetJson: CacheSetJson,
  entry: AddByRSSParseCacheEntry<TParsedFeed>
): Promise<void> => cacheSetJson(addByRSSParseCacheKey(entry.requestId), entry);
