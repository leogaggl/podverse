import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { safeJsonParse } from '../../data/db/serialization';

/** `kv_meta` key set after stored Add by RSS feeds take their guid columns from the saved bundle. */
export const ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY = 'add_by_rss_publisher_refs_v1';

export type AddByRssPublisherPointer = { feedGuid: string; feedUrl: string | null };

export type AddByRssPublisherRefs = {
  podcastGuid: string | null;
  /** The feed's `podcast:publisher` pointers, guid lowercased, in feed order, each guid once. */
  publisherPointers: AddByRssPublisherPointer[];
};

/** A directory channel one of this feed's publisher pointers resolved to. A guid match only. */
export type AddByRssDirectoryPublisherMatch = {
  feedGuid: string;
  channelIdText: string;
  channelTitle: string | null;
  mediumId: number | null;
};

const normalizeGuid = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * The feed's own `podcast:guid` and its publisher pointers. Reads stored bundles defensively: a
 * bundle written before publisher pointers were mapped has no list and yields none.
 */
export const addByRssPublisherRefsFromMappedFeed = (
  mappedFeed: AddByRSSMappedFeed
): AddByRssPublisherRefs => {
  const podcastGuid = normalizeGuid(mappedFeed.channel?.channel?.podcast_guid);
  const remoteItems = mappedFeed.channel?.publisherRemoteItems;
  const publisherPointers: AddByRssPublisherPointer[] = [];
  const seen = new Set<string>();
  if (Array.isArray(remoteItems)) {
    for (const remoteItem of remoteItems) {
      const feedGuid = normalizeGuid(remoteItem.feed_guid);
      if (feedGuid === null || seen.has(feedGuid)) {
        continue;
      }
      seen.add(feedGuid);
      publisherPointers.push({ feedGuid, feedUrl: normalizeUrl(remoteItem.feed_url) });
    }
  }
  return { podcastGuid, publisherPointers };
};

const parseStoredArray = (json: string | null): unknown[] => {
  if (json === null) {
    return [];
  }
  const parsed = safeJsonParse<unknown>(json);
  return Array.isArray(parsed) ? parsed : [];
};

/** Guids stored in `publisher_guids_json`; `[]` for null, unreadable, or non-array JSON. */
export const parseStoredPublisherGuids = (json: string | null): string[] =>
  parseStoredArray(json).filter((value): value is string => typeof value === 'string');

const isDirectoryPublisherMatch = (value: unknown): value is AddByRssDirectoryPublisherMatch =>
  typeof value === 'object' &&
  value !== null &&
  'feedGuid' in value &&
  typeof value.feedGuid === 'string' &&
  'channelIdText' in value &&
  typeof value.channelIdText === 'string' &&
  'channelTitle' in value &&
  (typeof value.channelTitle === 'string' || value.channelTitle === null) &&
  'mediumId' in value &&
  (typeof value.mediumId === 'number' || value.mediumId === null);

/** Matches stored in `publisher_directory_json`; malformed entries are dropped. */
export const parseStoredPublisherDirectoryMatches = (
  json: string | null
): AddByRssDirectoryPublisherMatch[] =>
  parseStoredArray(json)
    .filter(isDirectoryPublisherMatch)
    .map((match) => ({
      feedGuid: match.feedGuid,
      channelIdText: match.channelIdText,
      channelTitle: match.channelTitle,
      mediumId: match.mediumId,
    }));

/** The guid column values a parsed bundle sets on its `add_by_rss_feed` row. */
export const publisherRefColumnsFromMappedFeed = (
  mappedFeed: AddByRSSMappedFeed
): { podcastGuid: string | null; publisherGuidsJson: string } => {
  const refs = addByRssPublisherRefsFromMappedFeed(mappedFeed);
  return {
    podcastGuid: refs.podcastGuid,
    publisherGuidsJson: JSON.stringify(refs.publisherPointers.map((pointer) => pointer.feedGuid)),
  };
};

export type StoredAddByRssPublisherRefsRow = {
  feedUrl: string;
  mappedFeedJson: string | null;
};

export type AddByRssPublisherRefsUpdate = {
  feedUrl: string;
  podcastGuid: string | null;
  publisherGuidsJson: string;
};

/** Guid columns for every stored bundle that parses. A missing or unreadable bundle is skipped. */
export const publisherRefUpdatesFromStoredRows = (
  rows: readonly StoredAddByRssPublisherRefsRow[]
): AddByRssPublisherRefsUpdate[] => {
  const updates: AddByRssPublisherRefsUpdate[] = [];
  for (const row of rows) {
    if (row.mappedFeedJson === null) {
      continue;
    }
    const mappedFeed = safeJsonParse<AddByRSSMappedFeed>(row.mappedFeedJson);
    if (mappedFeed === null || typeof mappedFeed !== 'object') {
      continue;
    }
    updates.push({ feedUrl: row.feedUrl, ...publisherRefColumnsFromMappedFeed(mappedFeed) });
  }
  return updates;
};
