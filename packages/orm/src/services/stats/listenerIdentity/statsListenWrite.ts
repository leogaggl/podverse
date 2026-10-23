import { StatsListenerService } from '@orm/services/stats/listenerIdentity/statsListener.js';
import type { UtcDayBounds } from '@orm/services/stats/listenerIdentity/statsWriteGuard.js';
import {
  isTrackingAllowedForUpdate,
  lockListener,
  queryRows,
  readTransactionNow,
  runListenerWrite,
  utcDayBounds,
} from '@orm/services/stats/listenerIdentity/statsWriteGuard.js';
import type { EntityManager } from 'typeorm';

import type { PopularityListenResult } from '@podverse/helpers';
import {
  isCountedListen,
  MediumEnum,
  POPULARITY_TASTE_COMPLETION_WEIGHT,
  POPULARITY_TASTE_HALF_LIFE_DAYS,
  POPULARITY_TASTE_LISTEN_WEIGHT,
  subtractDays,
} from '@podverse/helpers';

export type StatsListenTarget =
  { kind: 'item'; id_text: string } | { kind: 'clip'; id_text: string };

export type StatsListenReport = {
  account_id: number;
  /** The agreement version the account must have accepted for this report to count. */
  agreement_version: string;
  /** Stored listens allowed per listener per UTC day. */
  daily_cap: number;
  target: StatsListenTarget;
  /** Device-generated id shared by every report of one listening session. */
  client_listen_id: string;
  /** Media seconds heard in the session so far. */
  seconds_heard: number;
  completed: boolean;
};

/** A report whose session was first stored more than this many days ago is a new listen. */
const LISTEN_REPORT_LOOKBACK_DAYS = 7;

/**
 * Upper bound on the half-lives one fade applies. Past it a faded score is below 1e-150 of its
 * stored value; without it Postgres raises an underflow error instead of returning 0.
 */
const MAX_FADE_HALF_LIVES = 500;

type ListenEntity = 'item' | 'channel' | 'clip';

type EntityFlags = Record<ListenEntity, boolean>;

/** The item, its channel, and the clip (clip listens only) one listen counts toward. */
type ListenEntities = { itemId: number; channelId: number; clipId: number | null };

type ResolvedListenTarget = ListenEntities & {
  mediumId: number;
  /** Seconds of media the listen covers: the clip's span or the item's duration. */
  durationSeconds: number | null;
};

type SessionEvent = ListenEntities & {
  createdAt: Date;
  id: string;
  secondsHeard: number;
  completed: boolean;
};

type ListenerDay = {
  listenCount: number;
  listened: EntityFlags;
  completed: EntityFlags;
};

type ItemRow = { id: number; channelId: number; mediumId: number; durationSeconds: number | null };

const DAILY_LISTEN_TABLES: Record<ListenEntity, { table: string; column: string }> = {
  item: { table: 'stats_daily_item', column: 'item_id' },
  channel: { table: 'stats_daily_channel', column: 'channel_id' },
  clip: { table: 'stats_daily_clip', column: 'clip_id' },
};

const ITEM_TARGET_SELECT = `SELECT i.id, i.channel_id, c.medium_id, ia.duration
  FROM item i
  JOIN channel c ON c.id = i.channel_id
  LEFT JOIN item_about ia ON ia.item_id = i.id`;

const ITEM_BY_ID_TEXT_SQL = `${ITEM_TARGET_SELECT} WHERE i.id_text = $1`;

const ITEM_BY_ID_SQL = `${ITEM_TARGET_SELECT} WHERE i.id = $1`;

const CLIP_TARGET_SQL = `SELECT id, item_id, source_removed_at, start_time, end_time
  FROM clip
  WHERE id_text = $1`;

const SESSION_EVENT_SQL = `SELECT created_at, id, seconds_heard, completed, item_id, channel_id, clip_id
  FROM stats_listen_event
  WHERE listener_id = $1 AND client_listen_id = $2 AND created_at >= $3
  LIMIT 1
  FOR UPDATE`;

const LISTENER_DAY_SQL = `SELECT
    count(*)::int AS listen_count,
    COALESCE(bool_or(item_id = $4), false) AS item_listened,
    COALESCE(bool_or(channel_id = $5), false) AS channel_listened,
    COALESCE(bool_or(clip_id = $6), false) AS clip_listened,
    COALESCE(bool_or(completed AND item_id = $4), false) AS item_completed,
    COALESCE(bool_or(completed AND channel_id = $5), false) AS channel_completed,
    COALESCE(bool_or(completed AND clip_id = $6), false) AS clip_completed
  FROM stats_listen_event
  WHERE listener_id = $1 AND created_at >= $2 AND created_at < $3
    AND ($7::bigint IS NULL OR id <> $7::bigint)`;

const INSERT_LISTEN_EVENT_SQL = `INSERT INTO stats_listen_event
    (created_at, listener_id, channel_id, item_id, clip_id, client_listen_id, seconds_heard, completed)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

const UPDATE_LISTEN_EVENT_SQL = `UPDATE stats_listen_event
  SET seconds_heard = $3, completed = $4
  WHERE created_at = $1 AND id = $2`;

const ARTIST_CHANNEL_SQL = `SELECT DISTINCT c.id
  FROM channel_publisher cp
  JOIN channel_publisher_remote_item r ON r.channel_publisher_id = cp.id
  JOIN channel c ON c.podcast_guid = r.feed_guid
  WHERE cp.channel_id = $1 AND c.medium_id = $2 AND c.id <> $1`;

const HIDDEN_CHANNEL_SQL = `SELECT channel_id
  FROM stats_taste_profile_hidden
  WHERE listener_id = $1 AND channel_id = ANY($2::int[])`;

function fadeFactorSql(elapsed: string, halfLifeDays: string): string {
  return `power(0.5, LEAST(extract(epoch FROM ${elapsed})::double precision / 86400.0 / ${halfLifeDays}, ${MAX_FADE_HALF_LIVES}))`;
}

/**
 * A taste score after adding `weight` at time `at`. When `at` is not before the row's
 * `scores_updated_at`, the stored score fades to `at` and the weight is added. When it is (a
 * completion of an event stored before the row's last update, or a transaction whose `now()` is
 * a moment earlier than the one that wrote the row), the weight fades to the stored time instead.
 */
function scoreAfterAddSql(
  column: 'recent_score' | 'long_term_score',
  at: string,
  weight: string,
  halfLifeDays: string
): string {
  return `CASE
      WHEN ${at} >= tp.scores_updated_at
        THEN tp.${column} * ${fadeFactorSql(`${at} - tp.scores_updated_at`, halfLifeDays)} + ${weight}
      ELSE tp.${column} + ${weight} * ${fadeFactorSql(`tp.scores_updated_at - ${at}`, halfLifeDays)}
    END`;
}

const TASTE_LISTEN_SQL = `INSERT INTO stats_taste_profile AS tp
    (listener_id, channel_id, listen_count, completion_count, first_listened_at, last_listened_at,
     recent_score, long_term_score, scores_updated_at)
  VALUES ($1, $2, 1, $3, $4::timestamptz, $4::timestamptz, $5::double precision,
          $5::double precision, $4::timestamptz)
  ON CONFLICT (listener_id, channel_id) DO UPDATE SET
    listen_count = tp.listen_count + 1,
    completion_count = tp.completion_count + EXCLUDED.completion_count,
    first_listened_at = LEAST(tp.first_listened_at, EXCLUDED.first_listened_at),
    last_listened_at = GREATEST(tp.last_listened_at, EXCLUDED.last_listened_at),
    recent_score = ${scoreAfterAddSql('recent_score', '$4::timestamptz', '$5::double precision', '$6::double precision')},
    long_term_score = ${scoreAfterAddSql('long_term_score', '$4::timestamptz', '$5::double precision', '$7::double precision')},
    scores_updated_at = GREATEST(tp.scores_updated_at, EXCLUDED.scores_updated_at)`;

const TASTE_COMPLETION_SQL = `UPDATE stats_taste_profile AS tp SET
    completion_count = tp.completion_count + 1,
    recent_score = ${scoreAfterAddSql('recent_score', '$3::timestamptz', '$4::double precision', '$5::double precision')},
    long_term_score = ${scoreAfterAddSql('long_term_score', '$3::timestamptz', '$4::double precision', '$6::double precision')},
    scores_updated_at = GREATEST(tp.scores_updated_at, $3::timestamptz)
  WHERE tp.listener_id = $1 AND tp.channel_id = ANY($2::int[])`;

/** Postgres returns `numeric` columns as strings. */
function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOrNull(value: number | null): number | null {
  return value !== null && value > 0 ? value : null;
}

/** Whole media seconds to store: never negative and at most the rounded-up listened duration. */
function storedSecondsHeard(reported: number, durationSeconds: number | null): number {
  const whole = Number.isFinite(reported) && reported > 0 ? Math.floor(reported) : 0;
  return durationSeconds === null ? whole : Math.min(whole, Math.ceil(durationSeconds));
}

async function readItem(
  manager: EntityManager,
  sql: string,
  param: string | number
): Promise<ItemRow | null> {
  const [row] = await queryRows(manager, sql, [param]);
  if (row === undefined) {
    return null;
  }
  const { id, channel_id, medium_id, duration } = row;
  if (typeof id !== 'number' || typeof channel_id !== 'number' || typeof medium_id !== 'number') {
    return null;
  }
  return {
    id,
    channelId: channel_id,
    mediumId: medium_id,
    durationSeconds: positiveOrNull(finiteNumber(duration)),
  };
}

/**
 * The clip's span when it has an end time; otherwise from its start to the end of the item when
 * the item's duration is known and longer than the start.
 */
function clipDurationSeconds(
  startTime: unknown,
  endTime: unknown,
  itemDurationSeconds: number | null
): number | null {
  const start = finiteNumber(startTime) ?? 0;
  const end = finiteNumber(endTime);
  if (end !== null) {
    return positiveOrNull(end - start);
  }
  if (itemDurationSeconds !== null && itemDurationSeconds > start) {
    return itemDurationSeconds - start;
  }
  return null;
}

async function resolveListenTarget(
  manager: EntityManager,
  target: StatsListenTarget
): Promise<ResolvedListenTarget | 'not_found' | 'clip_source_removed'> {
  if (target.kind === 'item') {
    const item = await readItem(manager, ITEM_BY_ID_TEXT_SQL, target.id_text);
    if (item === null) {
      return 'not_found';
    }
    return {
      itemId: item.id,
      channelId: item.channelId,
      clipId: null,
      mediumId: item.mediumId,
      durationSeconds: item.durationSeconds,
    };
  }

  const [clip] = await queryRows(manager, CLIP_TARGET_SQL, [target.id_text]);
  const clipId = clip?.id;
  if (clip === undefined || typeof clipId !== 'number') {
    return 'not_found';
  }
  const clipItemId = clip.item_id;
  if (clip.source_removed_at !== null || typeof clipItemId !== 'number') {
    return 'clip_source_removed';
  }
  const item = await readItem(manager, ITEM_BY_ID_SQL, clipItemId);
  if (item === null) {
    return 'clip_source_removed';
  }
  return {
    itemId: item.id,
    channelId: item.channelId,
    clipId,
    mediumId: item.mediumId,
    durationSeconds: clipDurationSeconds(clip.start_time, clip.end_time, item.durationSeconds),
  };
}

async function findSessionEvent(
  manager: EntityManager,
  listenerId: string,
  clientListenId: string,
  storedSince: Date
): Promise<SessionEvent | null> {
  const [row] = await queryRows(manager, SESSION_EVENT_SQL, [
    listenerId,
    clientListenId,
    storedSince,
  ]);
  if (row === undefined) {
    return null;
  }
  const { created_at, id, seconds_heard, completed, item_id, channel_id, clip_id } = row;
  if (
    !(created_at instanceof Date) ||
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof seconds_heard !== 'number' ||
    typeof completed !== 'boolean' ||
    typeof item_id !== 'number' ||
    typeof channel_id !== 'number' ||
    (clip_id !== null && typeof clip_id !== 'number')
  ) {
    return null;
  }
  return {
    createdAt: created_at,
    id: String(id),
    secondsHeard: seconds_heard,
    completed,
    itemId: item_id,
    channelId: channel_id,
    clipId: clip_id,
  };
}

/**
 * The listener's listens in one UTC day: how many, and whether any (or any completed one) was of
 * each of `entities`. `excludeEventId` leaves one event out of every answer.
 */
async function readListenerDay(
  manager: EntityManager,
  listenerId: string,
  bounds: UtcDayBounds,
  entities: ListenEntities,
  excludeEventId: string | null
): Promise<ListenerDay> {
  const [row] = await queryRows(manager, LISTENER_DAY_SQL, [
    listenerId,
    bounds.start,
    bounds.end,
    entities.itemId,
    entities.channelId,
    entities.clipId,
    excludeEventId,
  ]);
  const listenCount = row?.listen_count;
  return {
    listenCount: typeof listenCount === 'number' ? listenCount : 0,
    listened: {
      item: row?.item_listened === true,
      channel: row?.channel_listened === true,
      clip: row?.clip_listened === true,
    },
    completed: {
      item: row?.item_completed === true,
      channel: row?.channel_completed === true,
      clip: row?.clip_completed === true,
    },
  };
}

/** Item, channel, then clip: the order every writer of daily rows follows. */
function entityIds(entities: ListenEntities): Array<[ListenEntity, number]> {
  const ids: Array<[ListenEntity, number]> = [
    ['item', entities.itemId],
    ['channel', entities.channelId],
  ];
  if (entities.clipId !== null) {
    ids.push(['clip', entities.clipId]);
  }
  return ids;
}

async function addToDailyRow(
  manager: EntityManager,
  entity: ListenEntity,
  entityId: number,
  day: string,
  listeners: number,
  completions: number
): Promise<void> {
  if (listeners === 0 && completions === 0) {
    return;
  }
  if (listeners === 0) {
    for (let added = 0; added < completions; added += 1) {
      await addCompletionToDailyRow(manager, entity, entityId, day);
    }
    return;
  }
  const { table, column } = DAILY_LISTEN_TABLES[entity];
  await manager.query(
    `INSERT INTO ${table} (${column}, day, listener_count, completion_count)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (${column}, day) DO UPDATE SET
       listener_count = ${table}.listener_count + EXCLUDED.listener_count,
       completion_count = ${table}.completion_count + EXCLUDED.completion_count`,
    [entityId, day, listeners, completions]
  );
}

/**
 * Adds a finisher to an existing daily row. A missing row is left alone; inserting one would count
 * a finisher with no listener.
 */
async function addCompletionToDailyRow(
  manager: EntityManager,
  entity: ListenEntity,
  entityId: number,
  day: string
): Promise<void> {
  const { table, column } = DAILY_LISTEN_TABLES[entity];
  await manager.query(
    `UPDATE ${table} SET completion_count = completion_count + 1
     WHERE ${column} = $1 AND day = $2::date`,
    [entityId, day]
  );
}

/**
 * The shows a listen to `channelId` feeds: that channel and, for music, each artist channel its
 * publisher remote items point to. Shows on the listener's Hidden From Taste Profile list are left
 * out.
 */
async function tasteChannelIds(
  manager: EntityManager,
  listenerId: string,
  channelId: number,
  mediumId: number | null
): Promise<number[]> {
  const shows = [channelId];
  if (mediumId === MediumEnum.Music || mediumId === MediumEnum.MusicL) {
    const artists = await queryRows(manager, ARTIST_CHANNEL_SQL, [
      channelId,
      MediumEnum.PublisherMusic,
    ]);
    for (const artist of artists) {
      if (typeof artist.id === 'number') {
        shows.push(artist.id);
      }
    }
  }
  const hidden = await queryRows(manager, HIDDEN_CHANNEL_SQL, [listenerId, shows]);
  const hiddenIds = new Set(hidden.map((row) => row.channel_id));
  return shows.filter((id) => !hiddenIds.has(id));
}

async function readChannelMediumId(
  manager: EntityManager,
  channelId: number
): Promise<number | null> {
  const [row] = await queryRows(manager, 'SELECT medium_id FROM channel WHERE id = $1', [
    channelId,
  ]);
  const mediumId = row?.medium_id;
  return typeof mediumId === 'number' ? mediumId : null;
}

async function addListenToTaste(
  manager: EntityManager,
  listenerId: string,
  target: ResolvedListenTarget,
  completed: boolean,
  at: Date
): Promise<void> {
  const shows = await tasteChannelIds(manager, listenerId, target.channelId, target.mediumId);
  const weight =
    POPULARITY_TASTE_LISTEN_WEIGHT + (completed ? POPULARITY_TASTE_COMPLETION_WEIGHT : 0);
  for (const channelId of shows) {
    await manager.query(TASTE_LISTEN_SQL, [
      listenerId,
      channelId,
      completed ? 1 : 0,
      at,
      weight,
      POPULARITY_TASTE_HALF_LIFE_DAYS.recent,
      POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm,
    ]);
  }
}

/**
 * Counts a stored listen's completion on the event's own UTC day and in the taste rows that still
 * exist for its shows. Listen counts and listen times stay as they are.
 */
async function addCompletionOfStoredListen(
  manager: EntityManager,
  listenerId: string,
  event: SessionEvent
): Promise<void> {
  const eventDay = utcDayBounds(event.createdAt);
  const otherListens = await readListenerDay(manager, listenerId, eventDay, event, event.id);
  for (const [entity, entityId] of entityIds(event)) {
    if (!otherListens.completed[entity]) {
      await addCompletionToDailyRow(manager, entity, entityId, eventDay.day);
    }
  }

  const mediumId = await readChannelMediumId(manager, event.channelId);
  const shows = await tasteChannelIds(manager, listenerId, event.channelId, mediumId);
  if (shows.length === 0) {
    return;
  }
  await manager.query(TASTE_COMPLETION_SQL, [
    listenerId,
    shows,
    event.createdAt,
    POPULARITY_TASTE_COMPLETION_WEIGHT,
    POPULARITY_TASTE_HALF_LIFE_DAYS.recent,
    POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm,
  ]);
}

/**
 * A later report for a stored session only raises seconds heard and marks it finished. The
 * counted-listen rule and the daily cap do not apply; the session was already counted.
 */
async function updateSessionEvent(
  manager: EntityManager,
  listenerId: string,
  event: SessionEvent,
  secondsHeard: number,
  completed: boolean
): Promise<PopularityListenResult> {
  const nextSecondsHeard = Math.max(event.secondsHeard, secondsHeard);
  const nextCompleted = event.completed || completed;
  if (nextSecondsHeard === event.secondsHeard && nextCompleted === event.completed) {
    return 'unchanged';
  }
  await manager.query(UPDATE_LISTEN_EVENT_SQL, [
    event.createdAt,
    event.id,
    nextSecondsHeard,
    nextCompleted,
  ]);
  if (nextCompleted && !event.completed) {
    await addCompletionOfStoredListen(manager, listenerId, event);
  }
  return 'updated';
}

/**
 * Records listen reports in the listener identity zone. Callers pass an `account_id` and get back
 * a `PopularityListenResult`; the listener id never leaves this module. The write order (event,
 * item daily row, channel daily row, clip daily row, taste rows) is the lock order the channel
 * merge relies on. Contracts: docs/features/POPULARITY-TRACKING.md.
 */
export class StatsListenWriteService {
  private readonly listenerService = new StatsListenerService();

  async recordListen(report: StatsListenReport): Promise<PopularityListenResult> {
    return runListenerWrite(async (manager) => {
      const allowed = await isTrackingAllowedForUpdate(
        manager,
        report.account_id,
        report.agreement_version
      );
      if (!allowed) {
        return 'not_allowed';
      }

      const target = await resolveListenTarget(manager, report.target);
      if (typeof target === 'string') {
        return target;
      }

      const secondsHeard = storedSecondsHeard(report.seconds_heard, target.durationSeconds);
      const meetsRule = isCountedListen({ secondsHeard, durationSeconds: target.durationSeconds });

      let listenerId = await this.listenerService.findListenerId(report.account_id, manager);
      if (listenerId === null) {
        if (!meetsRule) {
          return 'below_threshold';
        }
        listenerId = await this.listenerService.getOrCreateListenerId(report.account_id, manager);
      }

      await lockListener(manager, listenerId);
      const now = await readTransactionNow(manager);

      const session = await findSessionEvent(
        manager,
        listenerId,
        report.client_listen_id,
        subtractDays(now, LISTEN_REPORT_LOOKBACK_DAYS)
      );
      if (session !== null) {
        return updateSessionEvent(manager, listenerId, session, secondsHeard, report.completed);
      }
      if (!meetsRule) {
        return 'below_threshold';
      }

      const today = utcDayBounds(now);
      const listenerDay = await readListenerDay(manager, listenerId, today, target, null);
      if (listenerDay.listenCount >= report.daily_cap) {
        return 'daily_cap_reached';
      }

      await manager.query(INSERT_LISTEN_EVENT_SQL, [
        now,
        listenerId,
        target.channelId,
        target.itemId,
        target.clipId,
        report.client_listen_id,
        secondsHeard,
        report.completed,
      ]);
      for (const [entity, entityId] of entityIds(target)) {
        await addToDailyRow(
          manager,
          entity,
          entityId,
          today.day,
          listenerDay.listened[entity] ? 0 : 1,
          report.completed && !listenerDay.completed[entity] ? 1 : 0
        );
      }
      await addListenToTaste(manager, listenerId, target, report.completed, now);
      return 'counted';
    });
  }
}
