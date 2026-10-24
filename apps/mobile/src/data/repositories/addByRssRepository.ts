import { and, asc, desc, eq, isNotNull, ne } from 'drizzle-orm';

import type {
  AddByRSSParseCacheEntry,
  AddByRSSPublisherListedFeed,
  DTOAccountFollowingAddByRSSChannel,
} from '@podverse/helpers';
import { primaryChannelListArtworkUrl } from '@podverse/helpers';
import { getErrorMessage } from '@podverse/helpers/error';
import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import {
  addByRSSFeedMayHaveLivestreams,
  getAddByRSSResourceTypeFromMappedFeed,
  toAddByRSSResourceType,
} from '@podverse/parser-mapping';

// Import directly from the request module (not the auth barrel) to avoid a cycle, mirroring
// accountRepository (AuthProvider → accountRepository → auth barrel → AuthProvider).
import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import { buildAddByRssParseFailureLog } from '../../lib/addByRss/addByRssErrorLog';
import type {
  AddByRssCredentials,
  AddByRssCredentialStatus,
  AddByRssNeedsCredentialsFeed,
} from '../../lib/addByRss/credentials';
import {
  isAddByRssAuthFailure,
  partitionAddByRssFeedsByCredentials,
  resolveAddByRssCredentialStatus,
  splitAddByRssPastedUrl,
  toAddByRssCredentialFeedUrl,
} from '../../lib/addByRss/credentials';
import type { AddByRssPollResult } from '../../lib/addByRss/domain';
import {
  buildAddByRssFeedRecord,
  localFeedForServerFollow,
  pollAddByRssParseStatus,
} from '../../lib/addByRss/domain';
import type { AddByRssDirectoryPublisherMatch } from '../../lib/addByRss/publisherRefs';
import {
  addByRssPublisherRefsFromMappedFeed,
  parseStoredPublisherDirectoryMatches,
  parseStoredPublisherGuids,
  publisherRefColumnsFromMappedFeed,
} from '../../lib/addByRss/publisherRefs';
import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import { requestAddByRssListedFeedsSync } from '../../sync/requestAddByRssRefresh';
import { classifySyncError } from '../../sync/syncErrorClassification';
import type { SyncJobKind } from '../../sync/syncJobKinds';
import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';
import { reloadAddByRssArtistIndex } from '../db/readAddByRssArtistIndex';
import type { AddByRssFeedRow } from '../db/schema';
import { addByRssCredentialStore } from './addByRssCredentialStore';
import type {
  AddByRssListedFeedRecord,
  PendingListedAlbum,
  PendingListingRef,
} from './addByRssListedFeeds';
import {
  decideListedAlbumStore,
  directoryLookupDue,
  groupPendingListedAlbums,
  isFeedListed,
  LISTED_FEED_POLL_DELAY_MS,
  LISTED_FEED_POLL_ROUNDS,
  listedAlbumAuthFailure,
  listedFeedNeedsWork,
  listedOnlyFeedUrlsToRemove,
  rowToListedFeedRecord,
  toListedFeedInserts,
} from './addByRssListedFeeds';
import { autoDownloadRepository } from './autoDownloadRepository';
import { channelLiveStatusRepository } from './channelLiveStatusRepository';
import { channelSeenRepository } from './channelSeenRepository';
import { playbackContentRepository } from './playbackContentRepository';
import { syncEventLogRepository } from './syncEventLogRepository';
import type { MobileAuthRequestContext } from './types';

const rowToRecord = (row: Omit<AddByRssFeedRow, 'mappedFeedJson'>): MobileAddByRSSFeedRecord => {
  return {
    id: row.id,
    idText: row.idText,
    resourceType: toAddByRSSResourceType(row.resourceType),
    feedUrl: row.feedUrl,
    title: row.title,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt,
    enclosureUrl: row.enclosureUrl,
    latestItemPubDateMs: row.latestItemPubDateMs,
    playbackPosition: row.playbackPosition,
    requiresCredentials: row.requiresCredentials === 1,
    lastAuthFailure: isAddByRssAuthFailure(row.lastAuthFailure) ? row.lastAuthFailure : null,
    mayHaveLivestreams: row.mayHaveLivestreams === 1,
    followed: row.followed === 1,
  };
};

/** Every `add_by_rss_feed` column except the mapped bundle, for reads that list many feeds. */
const feedColumnsWithoutBundle = () => ({
  feedUrl: schema.addByRssFeed.feedUrl,
  id: schema.addByRssFeed.id,
  idText: schema.addByRssFeed.idText,
  resourceType: schema.addByRssFeed.resourceType,
  title: schema.addByRssFeed.title,
  imageUrl: schema.addByRssFeed.imageUrl,
  enclosureUrl: schema.addByRssFeed.enclosureUrl,
  playbackPosition: schema.addByRssFeed.playbackPosition,
  latestItemPubDateMs: schema.addByRssFeed.latestItemPubDateMs,
  updatedAt: schema.addByRssFeed.updatedAt,
  requiresCredentials: schema.addByRssFeed.requiresCredentials,
  lastAuthFailure: schema.addByRssFeed.lastAuthFailure,
  mayHaveLivestreams: schema.addByRssFeed.mayHaveLivestreams,
  followed: schema.addByRssFeed.followed,
  podcastGuid: schema.addByRssFeed.podcastGuid,
  publisherGuidsJson: schema.addByRssFeed.publisherGuidsJson,
  publisherDirectoryJson: schema.addByRssFeed.publisherDirectoryJson,
});

/** A stored feed with the guid columns that tie artists and albums together. */
export type AddByRssFeedWithRefs = {
  feed: MobileAddByRSSFeedRecord;
  podcastGuid: string | null;
  publisherGuids: string[];
};

/** SQLite binds one parameter per column, so a bulk insert has to arrive in pieces. */
const LISTED_FEED_INSERT_CHUNK_SIZE = 50;

/**
 * Runs after every write that changes `followed`, a feed's guid columns, or a listing, so the
 * in-memory artist index that player lines read synchronously never lags SQLite.
 */
const afterArtistRelationsChanged = async (): Promise<void> => {
  await reloadAddByRssArtistIndex();
};

const seedAutoDownloadRule = (feedUrl: string): void => {
  void autoDownloadRepository
    .seedFromGlobalDefaults({
      channelIdText: feedUrl,
      source: 'add_by_rss',
    })
    .catch(() => undefined);
};

/** The feed row and everything keyed by its URL: credentials, live status, seen state, rule. */
const deleteStoredFeed = async (feedUrl: string): Promise<void> => {
  await getDb().delete(schema.addByRssFeed).where(eq(schema.addByRssFeed.feedUrl, feedUrl));
  await addByRssCredentialStore.deleteForCurrentAccount(feedUrl);
  await channelLiveStatusRepository.remove(feedUrl);
  await channelSeenRepository.remove(feedUrl);
  await autoDownloadRepository.removeChannel(feedUrl);
};

const readAllListedFeeds = async (): Promise<AddByRssListedFeedRecord[]> => {
  const rows = await getDb().select().from(schema.addByRssListedFeed);
  return rows.map(rowToListedFeedRecord);
};

/**
 * Removes listed-only feeds that no listing names. Removing an artist removes the albums it
 * brought, while an album two artists list stays until neither does.
 */
const pruneListedOnlyFeeds = async (): Promise<void> => {
  const [feeds, listings] = await Promise.all([
    getDb()
      .select({
        feedUrl: schema.addByRssFeed.feedUrl,
        followed: schema.addByRssFeed.followed,
        podcastGuid: schema.addByRssFeed.podcastGuid,
      })
      .from(schema.addByRssFeed),
    readAllListedFeeds(),
  ]);
  const feedUrls = listedOnlyFeedUrlsToRemove(
    feeds.map((feed) => ({ ...feed, followed: feed.followed === 1 })),
    listings
  );
  for (const feedUrl of feedUrls) {
    await deleteStoredFeed(feedUrl);
  }
};

/** Only the credential fields a record actually sets, so an omitted one keeps its stored value. */
const credentialColumnValues = (
  record: Pick<MobileAddByRSSFeedRecord, 'lastAuthFailure' | 'requiresCredentials'>
): { lastAuthFailure?: string | null; requiresCredentials?: number } => ({
  ...(record.requiresCredentials !== undefined
    ? { requiresCredentials: record.requiresCredentials ? 1 : 0 }
    : {}),
  ...(record.lastAuthFailure !== undefined ? { lastAuthFailure: record.lastAuthFailure } : {}),
});

/**
 * A credential failure the user already sees in the needs-credentials section. The server answers
 * a flagged feed that arrived without credentials this way on every refresh, so logging it would
 * fill the error log with rows that explain nothing new.
 */
const isExpectedMissingCredentials = (result: AddByRssPollResult): boolean =>
  result.failureReason === 'credentials_required' && result.credentialsState === 'not_provided';

/**
 * Refresh failures already logged this session, keyed by feed, code, and server reason. Every
 * foreground re-parses every feed, so a feed whose host stays down would otherwise add a row per
 * foreground and push everything else out of the capped log.
 */
const loggedRefreshFailures = new Set<string>();

const recordRefreshFailure = (
  ticket: AddByRssRefreshTicket,
  result: AddByRssPollResult,
  jobKind: SyncJobKind
): void => {
  const entry = buildAddByRssParseFailureLog({
    feedUrl: ticket.feedUrl,
    jobKind,
    occurredAt: Date.now(),
    requestId: ticket.requestId,
    result,
  });
  if (entry === null) {
    return;
  }
  const key = `${ticket.feedUrl}\u0000${entry.errorCode ?? ''}\u0000${entry.message ?? ''}`;
  if (loggedRefreshFailures.has(key)) {
    return;
  }
  loggedRefreshFailures.add(key);
  void syncEventLogRepository.append(entry);
};

/** What a refresh request returns per feed: the ticket to poll for that feed's parse result. */
export type AddByRssRefreshTicket = {
  feedUrl: string;
  requestId: string;
};

type ParseAllResponse = {
  request_ids: { feed_url: string; request_id: string }[];
};

type CredentialPair = { password: string; username: string };

const toCredentialsByUrl = (
  credentials: ReadonlyMap<string, AddByRssCredentials>
): Record<string, CredentialPair> => {
  const byUrl: Record<string, CredentialPair> = {};
  for (const [feedUrl, value] of credentials) {
    byUrl[feedUrl] = { password: value.password, username: value.username };
  }
  return byUrl;
};

const LISTED_FEEDS_JOB_KIND: SyncJobKind = 'add-by-rss-listed-feeds';

/** An album's publisher pointers resolved per parse; the first ones name the artist line. */
const PUBLISHER_DIRECTORY_LOOKUP_MAX = 5;

/**
 * How long one album-sync run keeps starting directory artwork reads. Whatever is left waits for
 * the next run, so a large artist cannot hold the serial queue until the job times out.
 */
const LISTED_FEED_WORK_BUDGET_MS = 45000;

/**
 * Album parses this device asked for itself, with credentials it holds. A run that finds one still
 * pending polls it again rather than sending the credentials a second time.
 */
const ownAlbumParseRequestIds = new Set<string>();

type StoredPublisherState = {
  publisherGuids: string[];
  directoryMatches: AddByRssDirectoryPublisherMatch[] | null;
} | null;

const readParseStatus = async (
  context: MobileAuthRequestContext,
  requestId: string
): Promise<AddByRSSParseCacheEntry<unknown>> =>
  requestWithMobileAuthRefresh(context, async (apiRequestService) =>
    apiRequestService.apiRequest<AddByRSSParseCacheEntry<unknown>>({
      path: `/account/add-by-rss/parse/status/${requestId}`,
      method: 'GET',
      config: {
        withCredentials: true,
      },
    })
  );

/** Start one parse and return its request id. Credentials go only in this body. */
const enqueueParseRequest = async (
  context: MobileAuthRequestContext,
  feedUrl: string,
  credentials: AddByRssCredentials | null
): Promise<string> => {
  const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
    apiRequestService.apiRequest<{ request_id: string }>({
      path: '/account/add-by-rss/parse',
      method: 'POST',
      config: {
        withCredentials: true,
      },
      data: {
        feed_url: feedUrl,
        ...(credentials !== null
          ? {
              basic_auth_password: credentials.password,
              basic_auth_username: credentials.username,
            }
          : {}),
      },
    })
  );
  return response.request_id;
};

/** A request for a listed album that threw: once per feed and error this session. */
const recordListedAlbumRequestFailure = (album: PendingListedAlbum, error: unknown): void => {
  const { code, isOffline } = classifySyncError(error);
  const message = getErrorMessage(error, code);
  const key = `${album.feedUrl}\u0000${code}\u0000${message}`;
  if (loggedRefreshFailures.has(key)) {
    return;
  }
  loggedRefreshFailures.add(key);
  void syncEventLogRepository.append({
    details: { feed_url: album.feedUrl, request_id: album.requestId },
    errorCode: code,
    jobKind: LISTED_FEEDS_JOB_KIND,
    message: message === code ? null : message,
    occurredAt: Date.now(),
    outcome: isOffline ? 'skipped' : 'failure',
  });
};

const warnArtistRelationsFailure = (step: string, error: unknown): void => {
  if (__DEV__) {
    // The code only: a request error can carry the feed URL in its query string.
    console.warn(`[add-by-rss] ${step} failed`, classifySyncError(error).code);
  }
};

const hasFeedWithPodcastGuid = async (
  podcastGuid: string,
  exceptFeedUrl: string
): Promise<boolean> => {
  const rows = await getDb()
    .select({ feedUrl: schema.addByRssFeed.feedUrl })
    .from(schema.addByRssFeed)
    .where(
      and(
        eq(schema.addByRssFeed.podcastGuid, podcastGuid),
        ne(schema.addByRssFeed.feedUrl, exceptFeedUrl)
      )
    )
    .limit(1);
  return rows.length > 0;
};

/**
 * Point listing rows at another parse request, or clear them with null. A row changes only while
 * it still waits on the id it was read with, so a newer artist parse is never overwritten.
 */
const moveListingsPending = async (
  listings: readonly PendingListingRef[],
  requestId: string | null
): Promise<void> => {
  for (const listing of listings) {
    await getDb()
      .update(schema.addByRssListedFeed)
      .set({ pendingRequestId: requestId })
      .where(
        and(
          eq(schema.addByRssListedFeed.publisherFeedUrl, listing.publisherFeedUrl),
          eq(schema.addByRssListedFeed.feedGuid, listing.feedGuid),
          eq(schema.addByRssListedFeed.pendingRequestId, listing.pendingRequestId)
        )
      );
  }
  await afterArtistRelationsChanged();
};

const clearPublisherDirectoryMatches = async (feedUrl: string): Promise<void> => {
  await getDb()
    .update(schema.addByRssFeed)
    .set({ publisherDirectoryJson: null })
    .where(eq(schema.addByRssFeed.feedUrl, feedUrl));
  await afterArtistRelationsChanged();
};

/**
 * Store what a parsed feed says about artists and albums: an artist's listings, and an album's
 * publisher pointers resolved to directory channels. `previous` is the feed's publisher state read
 * before its bundle was stored. Nothing here may fail the add or refresh that called it.
 */
const storeArtistRelations = async (
  context: MobileAuthRequestContext,
  feedUrl: string,
  result: AddByRssPollResult,
  previous: StoredPublisherState
): Promise<void> => {
  const { mappedFeed } = result;
  if (mappedFeed === null) {
    return;
  }

  if (result.status === 'parsed' && result.publisherListedFeeds !== undefined) {
    try {
      await addByRssRepository.replaceListedFeeds(feedUrl, result.publisherListedFeeds);
      const listings = await addByRssRepository.listListedFeeds(feedUrl);
      if (listings.some(listedFeedNeedsWork)) {
        requestAddByRssListedFeedsSync();
      }
    } catch (error) {
      warnArtistRelationsFailure('storing listed feeds', error);
    }
  }

  if (getAddByRSSResourceTypeFromMappedFeed(mappedFeed) !== 'albums') {
    return;
  }
  const pointers = addByRssPublisherRefsFromMappedFeed(mappedFeed).publisherPointers;
  if (
    !directoryLookupDue(
      previous,
      pointers.map((pointer) => pointer.feedGuid)
    )
  ) {
    return;
  }
  try {
    const matches: AddByRssDirectoryPublisherMatch[] = [];
    for (const pointer of pointers.slice(0, PUBLISHER_DIRECTORY_LOOKUP_MAX)) {
      const match = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
        apiRequestService.reqChannelGetDirectoryMatch({
          feed_guid: pointer.feedGuid,
          feed_url: pointer.feedUrl,
        })
      );
      if (match !== null) {
        matches.push({
          feedGuid: pointer.feedGuid,
          channelIdText: match.id_text,
          channelTitle: match.title,
          mediumId: match.medium_id,
        });
      }
    }
    await addByRssRepository.setPublisherDirectoryMatches(feedUrl, matches);
  } catch (error) {
    warnArtistRelationsFailure('directory match lookup', error);
    // Matches for guids the feed no longer names are dropped, so the next parse looks again.
    if (previous !== null && previous.directoryMatches !== null) {
      await clearPublisherDirectoryMatches(feedUrl).catch(() => undefined);
    }
  }
};

/** Send this device's own parse request for an album it holds credentials for. */
const withOwnAlbumParseRequest = async (
  context: MobileAuthRequestContext,
  accountIdText: string,
  album: PendingListedAlbum
): Promise<PendingListedAlbum> => {
  if (ownAlbumParseRequestIds.has(album.requestId)) {
    return album;
  }
  const credentials = await addByRssCredentialStore.get(accountIdText, album.feedUrl);
  if (credentials === null) {
    return album;
  }
  let requestId: string;
  try {
    requestId = await enqueueParseRequest(context, album.feedUrl, credentials);
  } catch (error) {
    recordListedAlbumRequestFailure(album, error);
    return album;
  }
  ownAlbumParseRequestIds.add(requestId);
  await moveListingsPending(album.listings, requestId);
  return {
    ...album,
    requestId,
    listings: album.listings.map((listing) => ({ ...listing, pendingRequestId: requestId })),
  };
};

/** Store one listed album's finished parse the way `decideListedAlbumStore` says. */
const storeListedAlbumResult = async (
  context: MobileAuthRequestContext,
  album: PendingListedAlbum,
  result: AddByRssPollResult
): Promise<void> => {
  const canonicalUrl = canonicalAddByRSSFeedUrl(album.feedUrl);
  const existing =
    (await addByRssRepository.getFeedByUrl(album.feedUrl)) ??
    (canonicalUrl !== null && canonicalUrl !== album.feedUrl
      ? await addByRssRepository.getFeedByUrl(canonicalUrl)
      : null);
  const podcastGuid =
    result.mappedFeed === null
      ? null
      : addByRssPublisherRefsFromMappedFeed(result.mappedFeed).podcastGuid;
  const hasRowForGuid =
    existing === null &&
    podcastGuid !== null &&
    (await hasFeedWithPodcastGuid(podcastGuid, album.feedUrl));
  const action = decideListedAlbumStore({ result, hasRowForUrl: existing !== null, hasRowForGuid });
  const sentCredentials = ownAlbumParseRequestIds.has(album.requestId);

  switch (action.kind) {
    case 'update-existing': {
      if (existing === null) {
        return;
      }
      if (result.mappedFeed === null) {
        await addByRssRepository.setCredentialStatus(existing.feedUrl, {
          lastAuthFailure: listedAlbumAuthFailure(result),
          requiresCredentials: true,
        });
        return;
      }
      const previous = await addByRssRepository.getPublisherState(existing.feedUrl);
      const credentialStatus = resolveAddByRssCredentialStatus({
        credentialsState: result.credentialsState,
        current: sentCredentials || existing.requiresCredentials === true,
        failureReason: result.failureReason,
        status: result.status,
      });
      await addByRssRepository.upsertFeed(
        {
          ...buildAddByRssFeedRecord(existing.feedUrl, existing, result.preview),
          ...credentialStatus,
        },
        result.mappedFeed
      );
      await storeArtistRelations(context, existing.feedUrl, result, previous);
      return;
    }
    case 'insert-parsed': {
      if (result.mappedFeed === null) {
        return;
      }
      const credentialStatus = resolveAddByRssCredentialStatus({
        credentialsState: result.credentialsState,
        current: sentCredentials,
        failureReason: result.failureReason,
        status: result.status,
      });
      await addByRssRepository.upsertFeed(
        {
          ...buildAddByRssFeedRecord(album.feedUrl, undefined, result.preview),
          followed: false,
          resourceType: 'albums',
          title: result.preview.title ?? album.title ?? album.feedUrl,
          ...(sentCredentials ? { requiresCredentials: true } : {}),
          ...credentialStatus,
        },
        result.mappedFeed
      );
      await storeArtistRelations(context, album.feedUrl, result, null);
      return;
    }
    case 'insert-needs-credentials':
      await addByRssRepository.upsertFeed({
        ...buildAddByRssFeedRecord(album.feedUrl, undefined, result.preview),
        followed: false,
        lastAuthFailure: listedAlbumAuthFailure(result),
        requiresCredentials: true,
        resourceType: 'albums',
        title: album.title ?? album.feedUrl,
      });
      return;
    case 'log-failure':
      recordRefreshFailure(
        { feedUrl: album.feedUrl, requestId: album.requestId },
        result,
        LISTED_FEEDS_JOB_KIND
      );
      return;
    case 'keep-pending':
    case 'skip-duplicate':
      return;
  }
};

/**
 * Read one listed album's parse status once and store the result. `pending` keeps it for the next
 * round; `unreadable` keeps its id for the next run.
 */
const settleListedAlbum = async (
  context: MobileAuthRequestContext,
  album: PendingListedAlbum
): Promise<'pending' | 'settled' | 'unreadable'> => {
  let result: AddByRssPollResult;
  try {
    result = await pollAddByRssParseStatus(
      album.requestId,
      async (requestId) => readParseStatus(context, requestId),
      { attempts: 1, delayMs: 0 }
    );
  } catch (error) {
    recordListedAlbumRequestFailure(album, error);
    return 'unreadable';
  }
  if (result.status === 'pending') {
    return 'pending';
  }
  try {
    await storeListedAlbumResult(context, album, result);
  } catch (error) {
    warnArtistRelationsFailure('storing a listed album', error);
    return 'unreadable';
  }
  await moveListingsPending(album.listings, null);
  return 'settled';
};

/** Fill artwork for directory listings not checked yet, one read per directory channel. */
const fillDirectoryListingArtwork = async (
  context: MobileAuthRequestContext,
  listings: readonly AddByRssListedFeedRecord[],
  shouldStop: () => boolean
): Promise<void> => {
  const channelIdTexts = new Set<string>();
  for (const listing of listings) {
    if (listing.kind === 'directory' && listing.channelIdText !== null && !listing.artworkChecked) {
      channelIdTexts.add(listing.channelIdText);
    }
  }
  const readArtwork = async (channelIdText: string): Promise<string | null | undefined> => {
    try {
      const channel = await playbackContentRepository.getChannelById(context, channelIdText);
      return primaryChannelListArtworkUrl(channel.channel_images) ?? null;
    } catch {
      return undefined;
    }
  };

  let changed = false;
  for (const channelIdText of channelIdTexts) {
    if (shouldStop()) {
      break;
    }
    const imageUrl = await readArtwork(channelIdText);
    if (imageUrl === undefined) {
      continue;
    }
    await getDb()
      .update(schema.addByRssListedFeed)
      .set({ artworkChecked: 1, imageUrl })
      .where(
        and(
          eq(schema.addByRssListedFeed.kind, 'directory'),
          eq(schema.addByRssListedFeed.channelIdText, channelIdText)
        )
      );
    changed = true;
  }
  if (changed) {
    await afterArtistRelationsChanged();
  }
};

export type AddByRssFeedsByCredentials = {
  needsCredentials: AddByRssNeedsCredentialsFeed<MobileAddByRSSFeedRecord>[];
  ready: MobileAddByRSSFeedRecord[];
};

/**
 * Add-by-RSS feed repository — the source of truth for the mobile RSS list and add-by-RSS playback.
 *
 * Reads SQLite first so the list works offline. Each feed is stored **whole**, as the last
 * successful `@podverse/parser-mapping` compat bundle: the user chose the feed explicitly and there
 * is no server-side pagination behind it, so there is no window to enforce the way there is for
 * directory channels in `channelItemsRepository`.
 *
 * The interactive add/follow/unfollow calls stay in the hooks that orchestrate those flows. Keeping
 * a followed feed current is background reconciliation rather than a user action, so it lives here
 * where the sync queue can reach it (see mobile-data-layer skill).
 */
export const addByRssRepository = {
  /**
   * The member's followed Add by RSS feeds, most-recently-updated first (offline-capable list).
   * Feeds held only because an Add by RSS artist lists them are left out.
   */
  listFeeds: async (): Promise<MobileAddByRSSFeedRecord[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.followed, 1))
      .orderBy(desc(schema.addByRssFeed.updatedAt));

    return rows.map(rowToRecord);
  },

  /** Every stored feed, followed or listed-only, most-recently-updated first. */
  listAllFeeds: async (): Promise<MobileAddByRSSFeedRecord[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.addByRssFeed)
      .orderBy(desc(schema.addByRssFeed.updatedAt));

    return rows.map(rowToRecord);
  },

  /** Every stored Add by RSS row (followed or listed-only) with its guid columns. No bundles. */
  listFeedsWithRefs: async (): Promise<AddByRssFeedWithRefs[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select(feedColumnsWithoutBundle())
      .from(schema.addByRssFeed)
      .orderBy(desc(schema.addByRssFeed.updatedAt));

    return rows.map((row) => ({
      feed: rowToRecord(row),
      podcastGuid: row.podcastGuid,
      publisherGuids: parseStoredPublisherGuids(row.publisherGuidsJson),
    }));
  },

  /**
   * Feeds split into the normal list and the needs-credentials section. A feed lands in the
   * section when it needs Basic Auth and this device holds no credentials for the signed-in
   * account, or when the last parse rejected the ones it holds.
   */
  listFeedsByCredentials: async (): Promise<AddByRssFeedsByCredentials> => {
    const [feeds, feedUrlsWithCredentials] = await Promise.all([
      addByRssRepository.listFeeds(),
      addByRssCredentialStore.listFeedUrlsForCurrentAccount(),
    ]);
    return partitionAddByRssFeedsByCredentials(feeds, feedUrlsWithCredentials);
  },

  getFeedByUrl: async (feedUrl: string): Promise<MobileAddByRSSFeedRecord | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl))
      .limit(1);

    const row = rows[0];
    return row === undefined ? null : rowToRecord(row);
  },

  getFeedByIdText: async (idText: string): Promise<MobileAddByRSSFeedRecord | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.idText, idText))
      .limit(1);

    const row = rows[0];
    return row === undefined ? null : rowToRecord(row);
  },

  /** Read the last-parsed compat bundle for a feed (for full-resource-data playback). */
  getMappedFeedByUrl: async (feedUrl: string): Promise<AddByRSSMappedFeed | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ mappedFeedJson: schema.addByRssFeed.mappedFeedJson })
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl))
      .limit(1);

    const raw = rows[0]?.mappedFeedJson ?? null;
    return raw === null ? null : safeJsonParse<AddByRSSMappedFeed>(raw);
  },

  /** Followed feed URLs that already have a parsed bundle stored, for parse-status display. */
  listParsedFeedUrls: async (): Promise<string[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ feedUrl: schema.addByRssFeed.feedUrl })
      .from(schema.addByRssFeed)
      .where(
        and(isNotNull(schema.addByRssFeed.mappedFeedJson), eq(schema.addByRssFeed.followed, 1))
      );

    return rows.map((row) => row.feedUrl);
  },

  /**
   * Upsert a feed record. When `mappedFeed` is provided (a fresh successful parse) its bundle is
   * persisted; when omitted (e.g. a followed-list merge), the existing `mapped_feed_json` is left
   * untouched so the parsed bundle is preserved.
   *
   * `latest_item_pub_date_ms` follows the bundle for the same reason: both are derived from a parse,
   * and a followed-list merge that wrote a null over a known date would drop a followed feed to the
   * bottom of a recency-ordered list until the next parse landed. The feed's live status is derived
   * at the same moment and for the same reason — reading it when the list is drawn would mean
   * deserializing a whole feed per row. The livestreams flag is derived at the same moment and is
   * never cleared. The resource type is derived from that same bundle with
   * `getAddByRSSResourceTypeFromMappedFeed`, the helper web uses after a parse. The feed's
   * `podcast:guid` and publisher guids come from the same bundle.
   *
   * `followed` is written only when the record sets it: an update without it keeps the stored
   * value, and an insert without it is a follow. A listed-only feed gets no auto-download rule.
   */
  upsertFeed: async (
    record: MobileAddByRSSFeedRecord,
    mappedFeed?: AddByRSSMappedFeed | null
  ): Promise<void> => {
    await initializeDatabase();

    const existingRows = await getDb()
      .select({
        feedUrl: schema.addByRssFeed.feedUrl,
        mayHaveLivestreams: schema.addByRssFeed.mayHaveLivestreams,
      })
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.feedUrl, record.feedUrl))
      .limit(1);
    const isNewFeed = existingRows.length === 0;
    const seedsAutoDownload = isNewFeed && record.followed !== false;

    const baseValues = {
      feedUrl: record.feedUrl,
      id: record.id,
      idText: record.idText,
      resourceType: record.resourceType,
      title: record.title,
      imageUrl: record.imageUrl,
      enclosureUrl: record.enclosureUrl,
      playbackPosition: record.playbackPosition,
      updatedAt: record.updatedAt,
      ...credentialColumnValues(record),
      ...(record.followed !== undefined ? { followed: record.followed ? 1 : 0 } : {}),
    };

    if (mappedFeed !== undefined) {
      const parsedValues = {
        latestItemPubDateMs: record.latestItemPubDateMs,
        mappedFeedJson: mappedFeed === null ? null : JSON.stringify(mappedFeed),
        resourceType:
          mappedFeed === null
            ? record.resourceType
            : getAddByRSSResourceTypeFromMappedFeed(mappedFeed),
        mayHaveLivestreams: addByRSSFeedMayHaveLivestreams(
          existingRows[0]?.mayHaveLivestreams === 1,
          mappedFeed
        )
          ? 1
          : 0,
        ...(mappedFeed !== null ? publisherRefColumnsFromMappedFeed(mappedFeed) : {}),
      };
      await getDb()
        .insert(schema.addByRssFeed)
        .values({ ...baseValues, ...parsedValues })
        .onConflictDoUpdate({
          target: schema.addByRssFeed.feedUrl,
          set: { ...baseValues, ...parsedValues },
        });
      await channelLiveStatusRepository.setFromAddByRssBundle(record.feedUrl, mappedFeed);
      if (seedsAutoDownload) {
        seedAutoDownloadRule(record.feedUrl);
      }
      if (mappedFeed !== null || record.followed !== undefined) {
        await afterArtistRelationsChanged();
      }
      return;
    }

    await getDb()
      .insert(schema.addByRssFeed)
      .values({
        ...baseValues,
        latestItemPubDateMs: record.latestItemPubDateMs,
        mappedFeedJson: null,
      })
      .onConflictDoUpdate({
        target: schema.addByRssFeed.feedUrl,
        set: baseValues,
      });
    if (seedsAutoDownload) {
      seedAutoDownloadRule(record.feedUrl);
    }
    if (record.followed !== undefined) {
      await afterArtistRelationsChanged();
    }
  },

  /**
   * Mark a stored feed as followed or listed-only. Following it seeds its auto-download rule the
   * way a new follow does.
   */
  setFollowed: async (feedUrl: string, followed: boolean): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.addByRssFeed)
      .set({ followed: followed ? 1 : 0 })
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl));
    if (followed) {
      seedAutoDownloadRule(feedUrl);
    }
    await afterArtistRelationsChanged();
  },

  /** Store the directory channels this feed's publisher guids resolved to. */
  setPublisherDirectoryMatches: async (
    feedUrl: string,
    matches: AddByRssDirectoryPublisherMatch[]
  ): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.addByRssFeed)
      .set({ publisherDirectoryJson: JSON.stringify(matches) })
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl));
    await afterArtistRelationsChanged();
  },

  /**
   * The feed's stored publisher guids, and the directory matches last looked up for them (null
   * when never looked up). Null when no row has this URL.
   */
  getPublisherState: async (
    feedUrl: string
  ): Promise<{
    publisherGuids: string[];
    directoryMatches: AddByRssDirectoryPublisherMatch[] | null;
  } | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({
        publisherDirectoryJson: schema.addByRssFeed.publisherDirectoryJson,
        publisherGuidsJson: schema.addByRssFeed.publisherGuidsJson,
      })
      .from(schema.addByRssFeed)
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      publisherGuids: parseStoredPublisherGuids(row.publisherGuidsJson),
      directoryMatches:
        row.publisherDirectoryJson === null
          ? null
          : parseStoredPublisherDirectoryMatches(row.publisherDirectoryJson),
    };
  },

  /** What one Add by RSS artist lists, in its feed order. */
  listListedFeeds: async (publisherFeedUrl: string): Promise<AddByRssListedFeedRecord[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.addByRssListedFeed)
      .where(eq(schema.addByRssListedFeed.publisherFeedUrl, publisherFeedUrl))
      .orderBy(asc(schema.addByRssListedFeed.position));
    return rows.map(rowToListedFeedRecord);
  },

  /** What every Add by RSS artist on this device lists. */
  listAllListedFeeds: async (): Promise<AddByRssListedFeedRecord[]> => {
    await initializeDatabase();
    return readAllListedFeeds();
  },

  /**
   * Replace one artist's listings with the list its latest parse returned. The server sends the
   * whole list on every parse, so nothing is merged; directory artwork for an unchanged entry
   * carries over. Listed-only feeds the new list no longer names are removed.
   */
  replaceListedFeeds: async (
    publisherFeedUrl: string,
    listed: readonly AddByRSSPublisherListedFeed[]
  ): Promise<void> => {
    await initializeDatabase();
    await getDb().transaction(async (transaction) => {
      const existingRows = await transaction
        .select()
        .from(schema.addByRssListedFeed)
        .where(eq(schema.addByRssListedFeed.publisherFeedUrl, publisherFeedUrl));
      await transaction
        .delete(schema.addByRssListedFeed)
        .where(eq(schema.addByRssListedFeed.publisherFeedUrl, publisherFeedUrl));
      const inserts = toListedFeedInserts(
        publisherFeedUrl,
        listed,
        existingRows.map(rowToListedFeedRecord)
      );
      for (let index = 0; index < inserts.length; index += LISTED_FEED_INSERT_CHUNK_SIZE) {
        await transaction
          .insert(schema.addByRssListedFeed)
          .values(inserts.slice(index, index + LISTED_FEED_INSERT_CHUNK_SIZE));
      }
    });
    await pruneListedOnlyFeeds();
    await afterArtistRelationsChanged();
  },

  /** Set or clear the parse request a listed feed waits on. */
  setListedFeedPending: async (
    publisherFeedUrl: string,
    feedGuid: string,
    requestId: string | null
  ): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.addByRssListedFeed)
      .set({ pendingRequestId: requestId })
      .where(
        and(
          eq(schema.addByRssListedFeed.publisherFeedUrl, publisherFeedUrl),
          eq(schema.addByRssListedFeed.feedGuid, feedGuid.trim().toLowerCase())
        )
      );
    await afterArtistRelationsChanged();
  },

  /** Store a directory listing's artwork (null when the channel has none) and mark it checked. */
  setListedFeedArtwork: async (
    publisherFeedUrl: string,
    feedGuid: string,
    imageUrl: string | null
  ): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.addByRssListedFeed)
      .set({ artworkChecked: 1, imageUrl })
      .where(
        and(
          eq(schema.addByRssListedFeed.publisherFeedUrl, publisherFeedUrl),
          eq(schema.addByRssListedFeed.feedGuid, feedGuid.trim().toLowerCase())
        )
      );
    await afterArtistRelationsChanged();
  },

  /** Record what a parse said about credentials without touching the rest of the row. */
  setCredentialStatus: async (feedUrl: string, status: AddByRssCredentialStatus): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.addByRssFeed)
      .set(credentialColumnValues(status))
      .where(eq(schema.addByRssFeed.feedUrl, feedUrl));
  },

  /**
   * Move `user:pass@` out of stored feed URLs and into SecureStore. Rows only carry userinfo when
   * they were added before credentials moved to the device, so once rewritten the scan finds
   * nothing and costs one small read. The account's follow row already uses the clean URL.
   */
  splitStoredUserinfo: async (accountIdText: string): Promise<void> => {
    const feeds = await addByRssRepository.listFeeds();
    for (const feed of feeds) {
      const split = splitAddByRssPastedUrl(feed.feedUrl);
      if (split === null) {
        continue;
      }
      const cleanUrl = toAddByRssCredentialFeedUrl(split.feedUrl);
      if (split.credentials !== null) {
        await addByRssCredentialStore.set(accountIdText, cleanUrl, split.credentials);
      }

      const existingClean = await addByRssRepository.getFeedByUrl(cleanUrl);
      if (existingClean === null) {
        await getDb()
          .update(schema.addByRssFeed)
          .set({ feedUrl: cleanUrl, requiresCredentials: 1 })
          .where(eq(schema.addByRssFeed.feedUrl, feed.feedUrl));
      } else {
        await getDb()
          .delete(schema.addByRssFeed)
          .where(eq(schema.addByRssFeed.feedUrl, feed.feedUrl));
        await addByRssRepository.setCredentialStatus(cleanUrl, {
          lastAuthFailure: existingClean.lastAuthFailure ?? null,
          requiresCredentials: true,
        });
      }
    }
  },

  /**
   * Ask the server to re-parse every feed the account follows, and return a ticket per feed.
   *
   * One request rather than one per feed: the endpoint fans out server-side and dedupes feeds it
   * parsed recently, so a device that foregrounds often does not repeatedly ask for the same work.
   * Feeds the server deduped come back with no ticket and are simply left as they are.
   *
   * Credentials this device holds for the account ride along in `credentials_by_url`; the API seals
   * them for the worker and never stores them. A feed that needs credentials this device lacks
   * gets no ticket back to poll: the server skips it, and the needs-credentials section already
   * says why.
   *
   * The caller is responsible for checking that the account may refresh at all — a lapsed
   * membership keeps its feeds readable and playable, and only stops them updating.
   */
  requestRefreshAll: async (
    context: MobileAuthRequestContext,
    accountIdText: string
  ): Promise<AddByRssRefreshTicket[]> => {
    const [credentials, feeds] = await Promise.all([
      addByRssCredentialStore.readAllForAccount(accountIdText),
      addByRssRepository.listFeeds(),
    ]);
    const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.apiRequest<ParseAllResponse>({
        path: '/account/add-by-rss/parse/all',
        method: 'POST',
        config: {
          withCredentials: true,
        },
        data: credentials.size > 0 ? { credentials_by_url: toCredentialsByUrl(credentials) } : {},
      })
    );

    const feedsByUrl = new Map(feeds.map((feed) => [feed.feedUrl, feed]));
    return response.request_ids
      .filter((entry) => {
        const feed = feedsByUrl.get(entry.feed_url);
        if (feed === undefined || feed.requiresCredentials !== true) {
          return true;
        }
        return credentials.has(toAddByRssCredentialFeedUrl(entry.feed_url));
      })
      .map((entry) => ({
        feedUrl: entry.feed_url,
        requestId: entry.request_id,
      }));
  },

  /**
   * Parse one feed now and store what came back: the interactive add, and save-and-check on the
   * credentials screen. Credentials go only in this request body, which the API seals for the
   * worker; they are never part of the follow.
   *
   * A feed already on the device keeps its stored episodes when this parse yields none, the same
   * rule a background refresh follows. A new feed is written either way so the add lands.
   *
   * `followed` is written only when set: the add flow follows, while a credentials check or feed
   * check leaves a listed-only album listed-only.
   */
  parseNow: async (
    context: MobileAuthRequestContext,
    feedUrl: string,
    credentials: AddByRssCredentials | null,
    options?: { followed?: boolean }
  ): Promise<{ requestId: string; result: AddByRssPollResult }> => {
    const parseRequestId = await enqueueParseRequest(context, feedUrl, credentials);

    const result = await pollAddByRssParseStatus(parseRequestId, async (requestId) =>
      readParseStatus(context, requestId)
    );

    const existingFeed = await addByRssRepository.getFeedByUrl(feedUrl);
    const previousPublisherState =
      result.mappedFeed === null ? null : await addByRssRepository.getPublisherState(feedUrl);
    const credentialStatus = resolveAddByRssCredentialStatus({
      credentialsState: result.credentialsState,
      current: credentials !== null || existingFeed?.requiresCredentials === true,
      failureReason: result.failureReason,
      status: result.status,
    });
    const record = buildAddByRssFeedRecord(feedUrl, existingFeed ?? undefined, result.preview);
    await addByRssRepository.upsertFeed(
      {
        ...record,
        ...(credentials !== null ? { requiresCredentials: true } : {}),
        ...credentialStatus,
        ...(options?.followed !== undefined ? { followed: options.followed } : {}),
      },
      existingFeed === null ? result.mappedFeed : (result.mappedFeed ?? undefined)
    );
    if (result.mappedFeed !== null) {
      await storeArtistRelations(context, feedUrl, result, previousPublisherState);
    }

    return { requestId: parseRequestId, result };
  },

  /**
   * Store a server follow this device has no row for, using that follow's title and image.
   * A listed-only row becomes followed, since the follow was made elsewhere; any other existing
   * row is left untouched. A later parse still fills episodes.
   */
  ensureLocalFeedFromFollow: async (
    context: MobileAuthRequestContext,
    feedUrl: string,
    accountIdText: string | null
  ): Promise<void> => {
    if (accountIdText === null || accountIdText.length === 0) {
      return;
    }
    const existing = await addByRssRepository.getFeedByUrl(feedUrl);
    if (existing !== null) {
      if (existing.followed === false) {
        await addByRssRepository.setFollowed(feedUrl, true);
      }
      return;
    }
    let follows: DTOAccountFollowingAddByRSSChannel[];
    try {
      follows = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
        apiRequestService.reqAccountGetFollowedAddByRSSChannels({
          account_id_text: accountIdText,
        })
      );
    } catch {
      return;
    }
    const follow = follows.find((entry) => entry.feed_url === feedUrl);
    if (follow === undefined) {
      return;
    }
    const again = await addByRssRepository.getFeedByUrl(feedUrl);
    const record = localFeedForServerFollow(follow, again);
    if (record === null) {
      return;
    }
    await addByRssRepository.upsertFeed(record);
  },

  /**
   * Poll one re-parse ticket and adopt the result.
   *
   * A parse that has not resolved yet, or resolved without a usable payload, leaves the stored
   * bundle untouched. Overwriting it with nothing would take a feed that reads and plays offline
   * today and leave the user with a title and no episodes, which is strictly worse than stale.
   * The failure is still recorded in the error log so a feed that silently stopped updating has
   * an explanation.
   *
   * Every ticket is a server follow, so the stored row is written as followed.
   */
  applyRefreshResult: async (
    context: MobileAuthRequestContext,
    ticket: AddByRssRefreshTicket,
    accountIdText: string | null
  ): Promise<boolean> => {
    const result = await pollAddByRssParseStatus(ticket.requestId, async (requestId) =>
      readParseStatus(context, requestId)
    );
    const { mappedFeed, preview } = result;
    let existingFeed = await addByRssRepository.getFeedByUrl(ticket.feedUrl);
    if (existingFeed === null) {
      await addByRssRepository.ensureLocalFeedFromFollow(context, ticket.feedUrl, accountIdText);
      existingFeed = await addByRssRepository.getFeedByUrl(ticket.feedUrl);
    }
    const credentialStatus = resolveAddByRssCredentialStatus({
      credentialsState: result.credentialsState,
      current: existingFeed?.requiresCredentials === true,
      failureReason: result.failureReason,
      status: result.status,
    });

    if (mappedFeed === null) {
      if (credentialStatus !== null && existingFeed !== null) {
        await addByRssRepository.setCredentialStatus(ticket.feedUrl, credentialStatus);
      }
      if (!isExpectedMissingCredentials(result)) {
        recordRefreshFailure(ticket, result, 'add-by-rss-parse');
      }
      return false;
    }

    const previousPublisherState = await addByRssRepository.getPublisherState(ticket.feedUrl);
    const record = buildAddByRssFeedRecord(ticket.feedUrl, existingFeed ?? undefined, preview);
    await addByRssRepository.upsertFeed(
      { ...record, ...credentialStatus, followed: true },
      mappedFeed
    );
    await storeArtistRelations(context, ticket.feedUrl, result, previousPublisherState);
    return true;
  },

  /** True when any listed album waits on a parse or any directory row lacks checked artwork. */
  hasListedFeedWork: async (): Promise<boolean> => {
    const listings = await addByRssRepository.listAllListedFeeds();
    return listings.some(listedFeedNeedsWork);
  },

  /**
   * Fetch every pending album parse, store the results, and fill directory artwork.
   *
   * One run reads each pending album's status once per round, for up to `LISTED_FEED_POLL_ROUNDS`
   * rounds, so the serial queue is never held for long by an artist with many albums. An album
   * still pending afterwards keeps its request id for the next run, and the artist's next parse
   * replaces it. An album this device holds credentials for is parsed with them by its own request
   * instead of the server's, which only sends an artist's credentials to its own domain.
   */
  runListedFeedWork: async (
    context: MobileAuthRequestContext,
    accountIdText: string,
    sleep: (ms: number) => Promise<unknown>,
    signal?: AbortSignal
  ): Promise<void> => {
    const startedAt = Date.now();
    const listings = await addByRssRepository.listAllListedFeeds();

    let pending: PendingListedAlbum[] = [];
    for (const album of groupPendingListedAlbums(listings)) {
      pending.push(await withOwnAlbumParseRequest(context, accountIdText, album));
    }

    for (let round = 0; round < LISTED_FEED_POLL_ROUNDS && pending.length > 0; round += 1) {
      if (round > 0) {
        await sleep(LISTED_FEED_POLL_DELAY_MS);
      }
      const stillPending: PendingListedAlbum[] = [];
      for (const album of pending) {
        if (signal?.aborted === true) {
          return;
        }
        if ((await settleListedAlbum(context, album)) === 'pending') {
          stillPending.push(album);
        }
      }
      pending = stillPending;
    }

    await fillDirectoryListingArtwork(
      context,
      listings,
      () => signal?.aborted === true || Date.now() - startedAt > LISTED_FEED_WORK_BUDGET_MS
    );
  },

  /**
   * Ends this device's follow of a feed. A feed an Add by RSS artist on the device still lists
   * stays as listed-only; any other feed is removed.
   */
  unfollowFeed: async (feedUrl: string): Promise<'listed' | 'removed'> => {
    await initializeDatabase();
    const [feed, guidRows, listings] = await Promise.all([
      addByRssRepository.getFeedByUrl(feedUrl),
      getDb()
        .select({ podcastGuid: schema.addByRssFeed.podcastGuid })
        .from(schema.addByRssFeed)
        .where(eq(schema.addByRssFeed.feedUrl, feedUrl))
        .limit(1),
      addByRssRepository.listAllListedFeeds(),
    ]);
    const podcastGuid = guidRows[0]?.podcastGuid ?? null;
    if (feed !== null && isFeedListed({ feedUrl, podcastGuid }, listings)) {
      await addByRssRepository.setFollowed(feedUrl, false);
      await autoDownloadRepository.removeChannel(feedUrl);
      return 'listed';
    }
    await addByRssRepository.removeFeed(feedUrl);
    return 'removed';
  },

  /**
   * Remove a feed from the device. When it is an artist, its listings go too, and so do the
   * listed-only albums no other artist on the device lists.
   */
  removeFeed: async (feedUrl: string): Promise<void> => {
    await initializeDatabase();
    await deleteStoredFeed(feedUrl);
    await getDb()
      .delete(schema.addByRssListedFeed)
      .where(eq(schema.addByRssListedFeed.publisherFeedUrl, feedUrl));
    await pruneListedOnlyFeeds();
    await afterArtistRelationsChanged();
  },

  /** Clear all feeds and listings (session reset / logout). */
  clear: async (): Promise<void> => {
    await initializeDatabase();
    await getDb().delete(schema.addByRssFeed);
    await getDb().delete(schema.addByRssListedFeed);
    await afterArtistRelationsChanged();
  },
};
