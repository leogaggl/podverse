import { AppDataSourceReadWrite } from '@orm/db/index.js';
import { Channel } from '@orm/entities/channel/channel.js';
import {
  ChannelMerge,
  ChannelMergeMode,
  ChannelMergeStatus,
} from '@orm/entities/channel/channelMerge.js';
import { ItemMergeMap, ItemMergeMatchTier } from '@orm/entities/channel/itemMergeMap.js';
import { Feed } from '@orm/entities/feed/feed.js';
import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import { FeedLifecycleUpdateSourceEnum } from '@orm/entities/feed/feedLifecycleUpdateSource.js';
import { loggerService } from '@orm/factories/loggerService.js';
import type {
  DuplicateMatchTier,
  MatchFeed,
  MatchItem,
  PairAssessment,
} from '@orm/lib/duplicateFeedMatch.js';
import { assessDuplicatePair } from '@orm/lib/duplicateFeedMatch.js';
import { isPodcastGuidUniqueViolation } from '@orm/lib/postgresUniqueViolation.js';
import type { EntityManager } from 'typeorm';

import { FeedService } from '../feed/feed.js';
import type { SqlKey } from './channelMergeRowJournal.js';
import {
  journaledDelete,
  journaledInsert,
  journaledUpdate,
  revertChannelMergeJournal,
  selectMergeRows,
} from './channelMergeRowJournal.js';

const STATS_COUNT_COLUMNS = [
  'day_current_count',
  'day_1_count',
  'day_2_count',
  'day_3_count',
  'day_4_count',
  'day_5_count',
  'day_6_count',
  'day_7_count',
  'day_8_count',
  'week_current_count',
  'week_1_count',
  'week_2_count',
  'week_3_count',
  'week_4_count',
  'month_current_count',
  'month_1_count',
  'all_time_count',
] as const;

export type SurvivorFeedSnapshot = {
  url: string;
  match: MatchFeed;
};

export type RepointParseRequest = {
  feedUrl: string;
  podcastIndexId: number;
  options: {
    forceParse: true;
    onDemandParserEvent: {
      accountId: null;
      remoteParentPodcastIndexId: null;
      type: null;
    };
    suppressNewItemSideEffectsPublishedBeforeMs: number;
  };
};

export type VerifyAndApplyDuplicateMergesOptions = {
  mode: 'dry_run' | 'apply';
  fetchSurvivorFeed: (podcastIndexId: number) => Promise<SurvivorFeedSnapshot | null>;
  enqueueRepointParse: (request: RepointParseRequest) => Promise<void>;
};

type StoredChannel = {
  channelId: number;
  feedId: number;
  feedUrl: string;
  podcastIndexId: number;
};

type RepointTarget = {
  fromItemId: number;
  guid: string | null;
  enclosureUrl: string | null;
  tier: DuplicateMatchTier;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sqlKey(value: unknown): SqlKey | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function timestampMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function assessmentStats(assessment: PairAssessment): Record<string, unknown> {
  return {
    oldCount: assessment.stats.oldCount,
    survivorCount: assessment.stats.survivorCount,
    matched: assessment.stats.matched,
    byTier: assessment.stats.byTier,
    sharedPodcastGuid: assessment.stats.sharedPodcastGuid,
    sharedItunesId: assessment.stats.sharedItunesId,
    selfLinkAgrees: assessment.stats.selfLinkAgrees,
  };
}

function rowImage(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(value) ? value : null;
}

function confidenceText(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.0000';
  }
  return Math.min(1, Math.max(0, value)).toFixed(4);
}

function matchTier(tier: DuplicateMatchTier): ItemMergeMatchTier {
  if (tier === 'guid') {
    return ItemMergeMatchTier.Guid;
  }
  if (tier === 'enclosure') {
    return ItemMergeMatchTier.Enclosure;
  }
  return ItemMergeMatchTier.Fuzzy;
}

function isFuzzyTier(tier: unknown): boolean {
  return tier === ItemMergeMatchTier.Fuzzy || tier === 'fuzzy';
}

function errorText(error: unknown, key: string): string {
  if (typeof error !== 'object' || error === null || !(key in error)) {
    return '';
  }
  const value: unknown = Reflect.get(error, key);
  return typeof value === 'string' ? value : '';
}

/** Raw `manager.query` raises the driver error, not TypeORM's wrapper. */
function isPodcastGuidCollision(error: unknown): boolean {
  if (isPodcastGuidUniqueViolation(error)) {
    return true;
  }
  if (errorText(error, 'code') !== '23505') {
    return false;
  }
  const text = ['message', 'constraint', 'detail'].map((key) => errorText(error, key)).join('\n');
  return text.includes('podcast_guid');
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function pubDateMs(value: unknown): number | null {
  return timestampMs(value);
}

function durationSeconds(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = asNumber(value);
  return value === 0 || value === '0' || parsed !== 0 ? parsed : null;
}

async function lockMerge(manager: EntityManager, id: number): Promise<ChannelMerge | null> {
  return manager
    .getRepository(ChannelMerge)
    .createQueryBuilder('channel_merge')
    .setLock('pessimistic_write')
    .where('channel_merge.id = :id', { id })
    .getOne();
}

async function storedChannel(
  manager: EntityManager,
  podcastIndexId: number
): Promise<StoredChannel | null> {
  const feed = await manager.getRepository(Feed).findOne({
    where: { podcast_index_id: podcastIndexId },
  });
  if (feed === null) {
    return null;
  }
  const channel = await manager.getRepository(Channel).findOne({
    where: { feed_id: feed.id },
  });
  if (channel === null) {
    return null;
  }
  return {
    channelId: channel.id,
    feedId: feed.id,
    feedUrl: feed.url,
    podcastIndexId: feed.podcast_index_id,
  };
}

async function matchFeedForChannel(manager: EntityManager, channelId: number): Promise<MatchFeed> {
  const channel = await manager.getRepository(Channel).findOne({ where: { id: channelId } });
  const rows: unknown = await manager.query(
    `SELECT i.id, i.guid, i.guid_enclosure_url, i.title, i.pub_date, ia.duration,
            (
              SELECT s.uri
              FROM item_enclosure e
              JOIN item_enclosure_source s ON s.item_enclosure_id = e.id
              WHERE e.item_id = i.id
              ORDER BY e.item_enclosure_default DESC, e.id ASC, s.id ASC
              LIMIT 1
            ) AS enclosure_uri
     FROM item i
     LEFT JOIN item_about ia ON ia.item_id = i.id
     WHERE i.channel_id = $1
       AND (i.item_flag_status_id IS NULL OR i.item_flag_status_id = 1)`,
    [channelId]
  );
  const items: MatchItem[] = [];
  if (Array.isArray(rows)) {
    for (const entry of rows) {
      if (!isRecord(entry) || typeof entry.id !== 'number') {
        continue;
      }
      const enclosureUri = nullableText(entry.enclosure_uri);
      items.push({
        id: entry.id,
        guid: nullableText(entry.guid),
        enclosureUrl: enclosureUri ?? nullableText(entry.guid_enclosure_url),
        title: nullableText(entry.title),
        pubDateMs: pubDateMs(entry.pub_date),
        durationSeconds: durationSeconds(entry.duration),
      });
    }
  }
  return {
    podcastGuid: channel?.podcast_guid ?? null,
    itunesId: null,
    selfUrl: null,
    items,
  };
}

async function replaceItemMap(
  manager: EntityManager,
  channelMergeId: number,
  oldItems: readonly MatchItem[],
  pairs: PairAssessment['pairs'],
  toItemId: (fromId: number) => number | null
): Promise<void> {
  await manager.getRepository(ItemMergeMap).delete({ channel_merge_id: channelMergeId });
  const pairByFrom = new Map(pairs.map((pair) => [pair.fromId, pair]));
  for (const item of oldItems) {
    const pair = pairByFrom.get(item.id);
    const row = manager.getRepository(ItemMergeMap).create({
      channel_merge_id: channelMergeId,
      from_item_id: item.id,
      to_item_id: pair === undefined ? null : toItemId(pair.fromId),
      match_tier: pair === undefined ? null : matchTier(pair.tier),
    });
    await manager.getRepository(ItemMergeMap).save(row);
  }
}

function repointTargets(
  pairs: PairAssessment['pairs'],
  survivorItems: readonly MatchItem[]
): RepointTarget[] {
  const byId = new Map(survivorItems.map((item) => [item.id, item]));
  const targets: RepointTarget[] = [];
  for (const pair of pairs) {
    const survivor = byId.get(pair.toId);
    if (survivor === undefined) {
      continue;
    }
    targets.push({
      fromItemId: pair.fromId,
      guid: survivor.guid,
      enclosureUrl: survivor.enclosureUrl,
      tier: pair.tier,
    });
  }
  return targets;
}

function readRepointTargets(stats: Record<string, unknown>): RepointTarget[] {
  const raw = stats.repointTargets;
  if (!Array.isArray(raw)) {
    return [];
  }
  const targets: RepointTarget[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.fromItemId !== 'number') {
      continue;
    }
    const tier = entry.tier;
    if (tier !== 'guid' && tier !== 'enclosure' && tier !== 'fuzzy') {
      continue;
    }
    targets.push({
      fromItemId: entry.fromItemId,
      guid: nullableText(entry.guid),
      enclosureUrl: nullableText(entry.enclosureUrl),
      tier,
    });
  }
  return targets;
}

async function saveAssessment(
  manager: EntityManager,
  merge: ChannelMerge,
  input: {
    mode: ChannelMergeMode;
    status: ChannelMergeStatus;
    confidence: number;
    fromChannelId: number | null;
    toChannelId: number | null;
    note: string | null;
    stats: Record<string, unknown>;
  }
): Promise<void> {
  merge.mode = input.mode;
  merge.status = input.status;
  merge.confidence = confidenceText(input.confidence);
  merge.from_channel_id = input.fromChannelId;
  merge.to_channel_id = input.toChannelId;
  merge.note = input.note;
  merge.match_stats = input.stats;
  await manager.getRepository(ChannelMerge).save(merge);
}

async function assessMerge(
  manager: EntityManager,
  channelMergeId: number,
  fetchSurvivorFeed: VerifyAndApplyDuplicateMergesOptions['fetchSurvivorFeed']
): Promise<void> {
  const merge = await lockMerge(manager, channelMergeId);
  if (merge === null || merge.status !== ChannelMergeStatus.Detected) {
    return;
  }

  const from = await storedChannel(manager, merge.from_podcast_index_id);
  if (from === null) {
    return;
  }
  const to = await storedChannel(manager, merge.to_podcast_index_id);
  if (to !== null && to.channelId === from.channelId) {
    merge.note = 'already_one_channel';
    merge.from_channel_id = from.channelId;
    await manager.getRepository(ChannelMerge).save(merge);
    await manager.getRepository(ItemMergeMap).delete({ channel_merge_id: merge.id });
    return;
  }

  const oldFeed = await matchFeedForChannel(manager, from.channelId);
  if (to === null) {
    const snapshot = await fetchSurvivorFeed(merge.to_podcast_index_id);
    if (snapshot === null) {
      await saveAssessment(manager, merge, {
        mode: ChannelMergeMode.Repoint,
        status: ChannelMergeStatus.NeedsReview,
        confidence: 0,
        fromChannelId: from.channelId,
        toChannelId: null,
        note: 'survivor_fetch_failed',
        stats: { oldCount: oldFeed.items.length, survivorCount: 0, matched: 0 },
      });
      await manager.getRepository(ItemMergeMap).delete({ channel_merge_id: merge.id });
      return;
    }
    const assessment = assessDuplicatePair(oldFeed, snapshot.match);
    await replaceItemMap(manager, merge.id, oldFeed.items, assessment.pairs, () => null);
    await saveAssessment(manager, merge, {
      mode: ChannelMergeMode.Repoint,
      status:
        assessment.status === 'verified'
          ? ChannelMergeStatus.Verified
          : ChannelMergeStatus.NeedsReview,
      confidence: assessment.confidence,
      fromChannelId: from.channelId,
      toChannelId: null,
      note: null,
      stats: {
        ...assessmentStats(assessment),
        survivorUrl: snapshot.url,
        survivorPodcastGuid: snapshot.match.podcastGuid,
        repointTargets: repointTargets(assessment.pairs, snapshot.match.items),
      },
    });
    return;
  }

  const survivorFeed = await matchFeedForChannel(manager, to.channelId);
  const assessment = assessDuplicatePair(oldFeed, survivorFeed);
  await replaceItemMap(manager, merge.id, oldFeed.items, assessment.pairs, (fromId) => {
    const pair = assessment.pairs.find((entry) => entry.fromId === fromId);
    return pair === undefined ? null : pair.toId;
  });
  await saveAssessment(manager, merge, {
    mode: ChannelMergeMode.Absorb,
    status:
      assessment.status === 'verified'
        ? ChannelMergeStatus.Verified
        : ChannelMergeStatus.NeedsReview,
    confidence: assessment.confidence,
    fromChannelId: from.channelId,
    toChannelId: to.channelId,
    note: null,
    stats: assessmentStats(assessment),
  });
}

async function assignPodcastGuid(
  manager: EntityManager,
  channelMergeId: number,
  channelId: number,
  podcastGuid: string
): Promise<boolean> {
  const existing = await selectMergeRows(manager, 'channel', { id: channelId });
  if (existing[0]?.podcast_guid === podcastGuid) {
    return false;
  }
  await manager.query('SAVEPOINT channel_merge_podcast_guid');
  try {
    await journaledUpdate(
      manager,
      channelMergeId,
      'channel',
      { id: channelId },
      {
        podcast_guid: podcastGuid,
      }
    );
    await manager.query('RELEASE SAVEPOINT channel_merge_podcast_guid');
    return false;
  } catch (error) {
    await manager.query('ROLLBACK TO SAVEPOINT channel_merge_podcast_guid');
    await manager.query('RELEASE SAVEPOINT channel_merge_podcast_guid');
    if (isPodcastGuidCollision(error)) {
      return true;
    }
    throw error;
  }
}

async function moveFollows(
  manager: EntityManager,
  channelMergeId: number,
  fromChannelId: number,
  toChannelId: number
): Promise<void> {
  const follows = await selectMergeRows(manager, 'account_following_channel', {
    channel_id: fromChannelId,
  });
  for (const follow of follows) {
    const accountId = sqlKey(follow.account_id);
    if (accountId === null) {
      continue;
    }
    const existing = await selectMergeRows(manager, 'account_following_channel', {
      account_id: accountId,
      channel_id: toChannelId,
    });
    if (existing.length === 0) {
      await journaledInsert(manager, channelMergeId, 'account_following_channel', {
        account_id: accountId,
        channel_id: toChannelId,
      });
    }
    await journaledDelete(manager, channelMergeId, 'account_following_channel', {
      account_id: accountId,
      channel_id: fromChannelId,
    });
  }
}

async function moveNotificationChannels(
  manager: EntityManager,
  channelMergeId: number,
  fromChannelId: number,
  toChannelId: number
): Promise<void> {
  const rows = await selectMergeRows(manager, 'account_notification_channel', {
    channel_id: fromChannelId,
  });
  for (const row of rows) {
    const id = sqlKey(row.id);
    const accountId = sqlKey(row.account_id);
    if (id === null || accountId === null) {
      continue;
    }
    const types = await selectMergeRows(manager, 'account_notification_channel_type', {
      account_notification_channel_id: id,
    });
    const existing = await selectMergeRows(manager, 'account_notification_channel', {
      account_id: accountId,
      channel_id: toChannelId,
    });
    if (existing.length === 0) {
      const inserted = await journaledInsert(
        manager,
        channelMergeId,
        'account_notification_channel',
        {
          account_id: accountId,
          channel_id: toChannelId,
        }
      );
      const insertedId = sqlKey(inserted.id);
      if (insertedId !== null) {
        for (const typeRow of types) {
          if (typeof typeRow.type !== 'string') {
            continue;
          }
          await journaledInsert(manager, channelMergeId, 'account_notification_channel_type', {
            account_notification_channel_id: insertedId,
            type: typeRow.type,
          });
        }
      }
    }
    for (const typeRow of types) {
      const typeId = sqlKey(typeRow.id);
      if (typeId === null) {
        continue;
      }
      await journaledDelete(manager, channelMergeId, 'account_notification_channel_type', {
        id: typeId,
      });
    }
    await journaledDelete(manager, channelMergeId, 'account_notification_channel', { id });
  }
}

async function moveAutoDownload(
  manager: EntityManager,
  channelMergeId: number,
  fromChannelId: number,
  toChannelId: number
): Promise<void> {
  const rows = await selectMergeRows(manager, 'account_device_auto_download_channel', {
    channel_id: fromChannelId,
  });
  for (const row of rows) {
    const id = sqlKey(row.id);
    const accountId = sqlKey(row.account_id);
    if (id === null || accountId === null || typeof row.installation_id !== 'string') {
      continue;
    }
    const existing = await selectMergeRows(manager, 'account_device_auto_download_channel', {
      account_id: accountId,
      installation_id: row.installation_id,
      channel_id: toChannelId,
    });
    if (existing.length === 0) {
      await journaledInsert(manager, channelMergeId, 'account_device_auto_download_channel', {
        account_id: accountId,
        installation_id: row.installation_id,
        channel_id: toChannelId,
      });
    }
    await journaledDelete(manager, channelMergeId, 'account_device_auto_download_channel', { id });
  }
}

async function movePendingFollows(
  manager: EntityManager,
  channelMergeId: number,
  from: StoredChannel,
  to: StoredChannel
): Promise<void> {
  const result: unknown = await manager.query(
    `SELECT row_to_json(t) AS row
     FROM account_pending_following_channel t
     WHERE podcast_index_id = $1 OR feed_url = $2`,
    [from.podcastIndexId, from.feedUrl]
  );
  if (!Array.isArray(result)) {
    return;
  }
  for (const entry of result) {
    if (!isRecord(entry)) {
      continue;
    }
    const row = rowImage(entry.row);
    if (row === null) {
      continue;
    }
    const id = sqlKey(row.id);
    const accountId = sqlKey(row.account_id);
    if (id === null || accountId === null) {
      continue;
    }
    const taken = await selectMergeRows(manager, 'account_pending_following_channel', {
      account_id: accountId,
      feed_url: to.feedUrl,
    });
    const blocked = taken.some((existing) => sqlKey(existing.id) !== id);
    if (blocked) {
      await journaledDelete(manager, channelMergeId, 'account_pending_following_channel', { id });
    } else {
      await journaledUpdate(
        manager,
        channelMergeId,
        'account_pending_following_channel',
        { id },
        {
          podcast_index_id: to.podcastIndexId,
          feed_url: to.feedUrl,
        }
      );
    }
  }
}

async function moveQueueRows(
  manager: EntityManager,
  channelMergeId: number,
  fromItemId: SqlKey,
  toItemId: SqlKey,
  fuzzy: boolean
): Promise<void> {
  const rows = await selectMergeRows(manager, 'queue_resource', { item_id: fromItemId });
  for (const row of rows) {
    const id = sqlKey(row.id);
    const queueId = sqlKey(row.queue_id);
    if (id === null || queueId === null) {
      continue;
    }
    const destination = await selectMergeRows(manager, 'queue_resource', {
      queue_id: queueId,
      item_id: toItemId,
    });
    const other = destination[0];
    const completed = row.completed === true || other?.completed === true;
    let position = Math.max(asNumber(row.playback_position), asNumber(other?.playback_position));
    if (fuzzy && !completed) {
      position = 0;
    }
    if (other !== undefined) {
      const otherId = sqlKey(other.id);
      if (otherId !== null) {
        await journaledUpdate(
          manager,
          channelMergeId,
          'queue_resource',
          { id: otherId },
          {
            completed,
            playback_position: position,
          }
        );
      }
      await journaledDelete(manager, channelMergeId, 'queue_resource', { id });
    } else {
      await journaledUpdate(
        manager,
        channelMergeId,
        'queue_resource',
        { id },
        {
          item_id: toItemId,
          completed,
          playback_position: position,
        }
      );
    }
  }
}

async function moveItemColumn(
  manager: EntityManager,
  channelMergeId: number,
  table: 'clip' | 'playlist_resource',
  fromItemId: SqlKey,
  toItemId: SqlKey
): Promise<number> {
  const rows = await selectMergeRows(manager, table, { item_id: fromItemId });
  for (const row of rows) {
    const id = sqlKey(row.id);
    if (id === null) {
      continue;
    }
    if (table === 'playlist_resource') {
      const playlistId = sqlKey(row.playlist_id);
      if (playlistId !== null) {
        const existing = await selectMergeRows(manager, 'playlist_resource', {
          playlist_id: playlistId,
          item_id: toItemId,
        });
        if (existing.length > 0) {
          await journaledDelete(manager, channelMergeId, table, { id });
          continue;
        }
      }
    }
    await journaledUpdate(manager, channelMergeId, table, { id }, { item_id: toItemId });
  }
  return rows.length;
}

async function addStats(
  manager: EntityManager,
  channelMergeId: number,
  table: 'stats_aggregated_channel' | 'stats_aggregated_item',
  key: 'channel_id' | 'item_id',
  fromId: SqlKey,
  toId: SqlKey
): Promise<void> {
  const sources = await selectMergeRows(manager, table, { [key]: fromId });
  const source = sources[0];
  if (source === undefined) {
    return;
  }
  const sourceId = sqlKey(source.id);
  const destinations = await selectMergeRows(manager, table, { [key]: toId });
  const destination = destinations[0];
  if (destination === undefined) {
    const values: Record<string, unknown> = { [key]: toId };
    for (const column of STATS_COUNT_COLUMNS) {
      values[column] = asNumber(source[column]);
    }
    await journaledInsert(manager, channelMergeId, table, values);
  } else {
    const destinationId = sqlKey(destination.id);
    if (destinationId !== null) {
      const values: Record<string, unknown> = {};
      for (const column of STATS_COUNT_COLUMNS) {
        values[column] = asNumber(destination[column]) + asNumber(source[column]);
      }
      await journaledUpdate(manager, channelMergeId, table, { id: destinationId }, values);
    }
  }
  if (sourceId !== null) {
    await journaledDelete(manager, channelMergeId, table, { id: sourceId });
  }
}

async function moveTrackEvents(
  manager: EntityManager,
  channelMergeId: number,
  table: 'stats_track_event_channel' | 'stats_track_event_item',
  key: 'channel_id' | 'item_id',
  fromId: SqlKey,
  toId: SqlKey
): Promise<void> {
  const rows = await selectMergeRows(manager, table, { [key]: fromId });
  for (const row of rows) {
    const id = sqlKey(row.id);
    if (id === null || typeof row.account_guid !== 'string') {
      continue;
    }
    const existing = await selectMergeRows(manager, table, {
      [key]: toId,
      account_guid: row.account_guid,
    });
    if (existing.length > 0) {
      await journaledDelete(manager, channelMergeId, table, { id });
    } else {
      await journaledUpdate(manager, channelMergeId, table, { id }, { [key]: toId });
    }
  }
}

async function listenerKeepsItem(manager: EntityManager, itemId: SqlKey): Promise<boolean> {
  const queue = await selectMergeRows(manager, 'queue_resource', { item_id: itemId });
  if (queue.length > 0) {
    return true;
  }
  const clips = await selectMergeRows(manager, 'clip', { item_id: itemId });
  if (clips.length > 0) {
    return true;
  }
  const playlists = await selectMergeRows(manager, 'playlist_resource', { item_id: itemId });
  return playlists.length > 0;
}

async function applyAbsorb(
  manager: EntityManager,
  merge: ChannelMerge,
  from: StoredChannel,
  to: StoredChannel
): Promise<void> {
  await moveFollows(manager, merge.id, from.channelId, to.channelId);
  await moveNotificationChannels(manager, merge.id, from.channelId, to.channelId);
  await moveAutoDownload(manager, merge.id, from.channelId, to.channelId);
  await movePendingFollows(manager, merge.id, from, to);

  const maps = await manager.getRepository(ItemMergeMap).find({
    where: { channel_merge_id: merge.id },
    order: { id: 'ASC' },
  });
  let uncertainClipCount = 0;
  for (const map of maps) {
    if (map.to_item_id === null) {
      continue;
    }
    const fuzzy = isFuzzyTier(map.match_tier);
    await moveQueueRows(manager, merge.id, map.from_item_id, map.to_item_id, fuzzy);
    const clipCount = await moveItemColumn(
      manager,
      merge.id,
      'clip',
      map.from_item_id,
      map.to_item_id
    );
    if (fuzzy) {
      uncertainClipCount += clipCount;
    }
    await moveItemColumn(manager, merge.id, 'playlist_resource', map.from_item_id, map.to_item_id);
    await addStats(
      manager,
      merge.id,
      'stats_aggregated_item',
      'item_id',
      map.from_item_id,
      map.to_item_id
    );
    await moveTrackEvents(
      manager,
      merge.id,
      'stats_track_event_item',
      'item_id',
      map.from_item_id,
      map.to_item_id
    );
  }

  let unmatchedKept = 0;
  for (const map of maps) {
    if (map.to_item_id !== null) {
      continue;
    }
    if (await listenerKeepsItem(manager, map.from_item_id)) {
      unmatchedKept += 1;
      continue;
    }
    await journaledUpdate(
      manager,
      merge.id,
      'item',
      { id: map.from_item_id },
      {
        item_flag_status_id: 2,
      }
    );
  }

  await addStats(
    manager,
    merge.id,
    'stats_aggregated_channel',
    'channel_id',
    from.channelId,
    to.channelId
  );
  await moveTrackEvents(
    manager,
    merge.id,
    'stats_track_event_channel',
    'channel_id',
    from.channelId,
    to.channelId
  );

  await new FeedService().setFeedLifecycleState(
    from.feedId,
    {
      toStateKey: FeedLifecycleStateKeyEnum.Merged,
      source: FeedLifecycleUpdateSourceEnum.System,
    },
    { manager }
  );

  merge.match_stats = {
    ...merge.match_stats,
    uncertainClipCount,
    unmatchedKept,
  };
  merge.mode = ChannelMergeMode.Absorb;
  merge.to_channel_id = to.channelId;
}

async function applyRepoint(
  manager: EntityManager,
  merge: ChannelMerge,
  from: StoredChannel
): Promise<RepointParseRequest | null> {
  const stats = merge.match_stats;
  const survivorUrl = nullableText(stats.survivorUrl);
  if (survivorUrl === null) {
    throw new Error(`channel merge ${merge.id} is missing the survivor feed URL`);
  }
  for (const target of readRepointTargets(stats)) {
    const set: Record<string, unknown> = {};
    if (target.guid !== null) {
      set.guid = target.guid;
    }
    if (target.enclosureUrl !== null) {
      set.guid_enclosure_url = target.enclosureUrl;
    }
    if (Object.keys(set).length === 0) {
      continue;
    }
    await journaledUpdate(manager, merge.id, 'item', { id: target.fromItemId }, set);
  }

  const feedRows = await selectMergeRows(manager, 'feed', { id: from.feedId });
  const hash = feedRows[0]?.last_parsed_file_hash;
  const feedSet: Record<string, unknown> = {
    url: survivorUrl,
    podcast_index_id: merge.to_podcast_index_id,
  };
  if (hash !== null && hash !== undefined) {
    feedSet.last_parsed_file_hash = null;
  }
  await journaledUpdate(manager, merge.id, 'feed', { id: from.feedId }, feedSet);

  const survivorGuid = nullableText(stats.survivorPodcastGuid);
  if (survivorGuid !== null) {
    const collided = await assignPodcastGuid(manager, merge.id, from.channelId, survivorGuid);
    if (collided) {
      merge.match_stats = { ...merge.match_stats, guidCollision: true };
    }
  }

  merge.mode = ChannelMergeMode.Repoint;
  merge.to_channel_id = null;
  return {
    feedUrl: survivorUrl,
    podcastIndexId: merge.to_podcast_index_id,
    options: {
      forceParse: true,
      onDemandParserEvent: {
        accountId: null,
        remoteParentPodcastIndexId: null,
        type: null,
      },
      suppressNewItemSideEffectsPublishedBeforeMs: 0,
    },
  };
}

async function appliedAtMs(manager: EntityManager, channelMergeId: number): Promise<number> {
  const rows: unknown = await manager.query(`SELECT applied_at FROM channel_merge WHERE id = $1`, [
    channelMergeId,
  ]);
  const first = Array.isArray(rows) ? rows[0] : null;
  if (isRecord(first)) {
    const ms = timestampMs(first.applied_at);
    if (ms !== null) {
      return ms;
    }
  }
  return Date.now();
}

async function applyMerge(
  manager: EntityManager,
  channelMergeId: number
): Promise<RepointParseRequest | null> {
  const merge = await lockMerge(manager, channelMergeId);
  if (merge === null || merge.status !== ChannelMergeStatus.Verified) {
    return null;
  }
  const from = await storedChannel(manager, merge.from_podcast_index_id);
  if (from === null) {
    return null;
  }

  let request: RepointParseRequest | null = null;
  if (merge.mode === ChannelMergeMode.Repoint) {
    request = await applyRepoint(manager, merge, from);
  } else if (merge.mode === ChannelMergeMode.Absorb) {
    const to = await storedChannel(manager, merge.to_podcast_index_id);
    if (to === null || to.channelId === from.channelId) {
      return null;
    }
    await applyAbsorb(manager, merge, from, to);
  } else {
    return null;
  }

  merge.status = ChannelMergeStatus.Applied;
  merge.applied_at = new Date();
  await manager.getRepository(ChannelMerge).save(merge);
  if (request !== null) {
    request.options.suppressNewItemSideEffectsPublishedBeforeMs = await appliedAtMs(
      manager,
      merge.id
    );
  }
  return request;
}

function warnMerge(channelMergeId: number, error: unknown): void {
  loggerService.warn('Duplicate merge failed', { channelMergeId, error });
}

export async function verifyAndApplyDuplicateMerges(
  options: VerifyAndApplyDuplicateMergesOptions
): Promise<void> {
  const repo = AppDataSourceReadWrite.getRepository(ChannelMerge);
  const detected = await repo.find({
    where: { status: ChannelMergeStatus.Detected },
    order: { id: 'ASC' },
  });
  for (const row of detected) {
    try {
      await AppDataSourceReadWrite.transaction((manager) =>
        assessMerge(manager, row.id, options.fetchSurvivorFeed)
      );
    } catch (error) {
      warnMerge(row.id, error);
    }
  }

  if (options.mode !== 'apply') {
    return;
  }

  const verified = await repo.find({
    where: { status: ChannelMergeStatus.Verified },
    order: { id: 'ASC' },
  });
  for (const row of verified) {
    try {
      const request = await AppDataSourceReadWrite.transaction((manager) =>
        applyMerge(manager, row.id)
      );
      if (request !== null) {
        try {
          await options.enqueueRepointParse(request);
        } catch (error) {
          warnMerge(row.id, error);
        }
      }
    } catch (error) {
      warnMerge(row.id, error);
    }
  }
}

export async function revertChannelMerge(channelMergeId: number): Promise<void> {
  await AppDataSourceReadWrite.transaction(async (manager) => {
    const merge = await lockMerge(manager, channelMergeId);
    if (merge === null || merge.status !== ChannelMergeStatus.Applied) {
      return;
    }
    await revertChannelMergeJournal(manager, merge.id);
    if (merge.mode === ChannelMergeMode.Absorb && merge.from_channel_id !== null) {
      const channel = await manager.getRepository(Channel).findOne({
        where: { id: merge.from_channel_id },
      });
      if (channel !== null) {
        await new FeedService().setFeedLifecycleState(
          channel.feed_id,
          {
            toStateKey: FeedLifecycleStateKeyEnum.Active,
            source: FeedLifecycleUpdateSourceEnum.System,
            transitionOptions: { explicitManagementOverride: true },
          },
          { manager }
        );
      }
    }
    merge.status = ChannelMergeStatus.Reverted;
    await manager.getRepository(ChannelMerge).save(merge);
  });
}
