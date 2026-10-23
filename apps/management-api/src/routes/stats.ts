// These routes read popularity range totals and the daily listener series. The window
// lengths live in `@podverse/helpers`. The storage rules are in
// docs/features/POPULARITY-TRACKING.md.

import { config } from '@management-api/config/index.js';
import { ensureAuthenticated } from '@management-api/lib/auth/index.js';
import { requireCrud } from '@management-api/lib/authz/requireCrud.js';
import { getParamRequired } from '@management-api/lib/params.js';
import {
  buildDailyListenerSeries,
  readDailyListenerQueryRow,
  readPopularityCountRow,
  readPopularityListRow,
  readQueryTotal,
  utcDateDaysBefore,
  utcTodayDateString,
} from '@management-api/lib/stats/dailyListenerSeries.js';
import { AppDbDataSourceRead } from '@management-api/orm/db/appDb.js';
import express from 'express';
import Joi from 'joi';

import type { StatsPopularityCountField, StatsPopularityRange } from '@podverse/helpers';
import {
  STATS_POPULARITY_COUNT_FIELDS,
  STATS_POPULARITY_RANGE_LOOKBACK_DAYS,
} from '@podverse/helpers';

const router = express.Router();

const VALID_ENTITY_TYPES = ['channel', 'item', 'clip', 'playlist', 'account'] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

const ENTITY_CONFIG = {
  channel: {
    fkColumn: 'channel_id',
    titleExpression: 'c.title',
    titleJoin: 'LEFT JOIN channel c ON c.id = sa.channel_id',
  },
  item: {
    fkColumn: 'item_id',
    titleExpression: 'i.title',
    titleJoin: 'LEFT JOIN item i ON i.id = sa.item_id',
  },
  clip: {
    fkColumn: 'clip_id',
    titleExpression: 'cl.title',
    titleJoin: 'LEFT JOIN clip cl ON cl.id = sa.clip_id',
  },
  playlist: {
    fkColumn: 'playlist_id',
    titleExpression: 'p.title',
    titleJoin: 'LEFT JOIN playlist p ON p.id = sa.playlist_id',
  },
  account: {
    fkColumn: 'account_id',
    titleExpression: 'ap.display_name',
    titleJoin: 'LEFT JOIN account_profile ap ON ap.account_id = sa.account_id',
  },
} as const satisfies Record<
  EntityType,
  { fkColumn: string; titleExpression: string; titleJoin: string }
>;

const topQuerySchema = Joi.object({
  range: Joi.string().valid('day', 'week', 'month', 'all-time').default('all-time'),
  limit: Joi.number().integer().min(1).max(100).default(25),
  page: Joi.number().integer().min(1).default(1),
});

const searchQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required(),
  range: Joi.string().valid('day', 'week', 'month', 'all-time').default('all-time'),
  limit: Joi.number().integer().min(1).max(100).default(25),
  page: Joi.number().integer().min(1).default(1),
});

type StatsListQuery = {
  range: StatsPopularityRange;
  limit: number;
  page: number;
};

function isEntityType(value: string): value is EntityType {
  for (const entityType of VALID_ENTITY_TYPES) {
    if (entityType === value) {
      return true;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPopularityRange(value: unknown): value is StatsPopularityRange {
  return value === 'day' || value === 'week' || value === 'month' || value === 'all-time';
}

function readStatsListQuery(value: unknown): StatsListQuery {
  if (!isRecord(value) || !isPopularityRange(value.range)) {
    throw new Error('Expected a stats list query');
  }
  const { limit, page } = value;
  if (
    typeof limit !== 'number' ||
    typeof page !== 'number' ||
    !Number.isInteger(limit) ||
    !Number.isInteger(page) ||
    limit < 1 ||
    limit > 100 ||
    page < 1
  ) {
    throw new Error('Expected a stats list query');
  }
  return { range: value.range, limit, page };
}

function readStatsSearchQuery(value: unknown): StatsListQuery & { q: string } {
  const listQuery = readStatsListQuery(value);
  if (!isRecord(value) || typeof value.q !== 'string') {
    throw new Error('Expected a stats search query');
  }
  return { ...listQuery, q: value.q };
}

function readQueryRows(result: unknown): unknown[] {
  if (!Array.isArray(result)) {
    throw new Error('Expected query rows');
  }
  return result;
}

function readTotal(result: unknown): number {
  const first = readQueryRows(result)[0];
  if (first === undefined) {
    throw new Error('Expected a count row');
  }
  return readQueryTotal(first);
}

function countColumn(range: StatsPopularityRange): StatsPopularityCountField {
  return STATS_POPULARITY_COUNT_FIELDS[range];
}

function popularityCountSelect(entityType: EntityType): string {
  const entity = ENTITY_CONFIG[entityType];
  return `sa.${entity.fkColumn}::int AS id,
    ${entity.titleExpression} AS title,
    sa.day_count::int AS day_count,
    sa.week_count::int AS week_count,
    sa.month_count::int AS month_count,
    sa.all_time_count::int AS all_time_count`;
}

function listOrderBy(entityType: EntityType, range: StatsPopularityRange): string {
  const entity = ENTITY_CONFIG[entityType];
  const countField = countColumn(range);
  return `ORDER BY sa.${countField} DESC, sa.${entity.fkColumn} ASC`;
}

router.get(
  '/:entityType/top',
  ensureAuthenticated,
  requireCrud('stats', 'read'),
  async (req, res): Promise<void> => {
    try {
      const entityTypeParam = getParamRequired(req, 'entityType');
      if (!isEntityType(entityTypeParam)) {
        res.status(400).json({
          message: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
        });
        return;
      }

      const { error, value } = topQuerySchema.validate(req.query);
      if (error) {
        res.status(400).json({ message: error.message });
        return;
      }

      const query = readStatsListQuery(value);
      const entity = ENTITY_CONFIG[entityTypeParam];
      const countField = countColumn(query.range);
      const offset = (query.page - 1) * query.limit;

      const countResult: unknown = await AppDbDataSourceRead.query(
        `SELECT COUNT(*)::int AS total FROM stats_popularity_${entityTypeParam} sa`
      );
      const total = readTotal(countResult);

      const rowResult: unknown = await AppDbDataSourceRead.query(
        `SELECT
          ${popularityCountSelect(entityTypeParam)},
          sa.${countField}::int AS range_count
        FROM stats_popularity_${entityTypeParam} sa
        ${entity.titleJoin}
        ${listOrderBy(entityTypeParam, query.range)}
        LIMIT $1 OFFSET $2`,
        [query.limit, offset]
      );
      const rows = readQueryRows(rowResult).map(readPopularityListRow);

      res.json({ rows, total, page: query.page, pageSize: query.limit });
    } catch (err) {
      console.error('[stats/:entityType/top]', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/:entityType/search',
  ensureAuthenticated,
  requireCrud('stats', 'read'),
  async (req, res): Promise<void> => {
    try {
      const entityTypeParam = getParamRequired(req, 'entityType');
      if (!isEntityType(entityTypeParam)) {
        res.status(400).json({
          message: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
        });
        return;
      }

      const { error, value } = searchQuerySchema.validate(req.query);
      if (error) {
        res.status(400).json({ message: error.message });
        return;
      }

      const query = readStatsSearchQuery(value);
      const entity = ENTITY_CONFIG[entityTypeParam];
      const countField = countColumn(query.range);
      const offset = (query.page - 1) * query.limit;
      const searchPattern = `%${query.q}%`;

      const rowResult: unknown = await AppDbDataSourceRead.query(
        `SELECT
          ${popularityCountSelect(entityTypeParam)},
          sa.${countField}::int AS range_count
        FROM stats_popularity_${entityTypeParam} sa
        ${entity.titleJoin}
        WHERE ${entity.titleExpression} ILIKE $1
        ${listOrderBy(entityTypeParam, query.range)}
        LIMIT $2 OFFSET $3`,
        [searchPattern, query.limit, offset]
      );
      const rows = readQueryRows(rowResult).map(readPopularityListRow);

      const countResult: unknown = await AppDbDataSourceRead.query(
        `SELECT COUNT(*)::int AS total
        FROM stats_popularity_${entityTypeParam} sa
        ${entity.titleJoin}
        WHERE ${entity.titleExpression} ILIKE $1`,
        [searchPattern]
      );
      const total = readTotal(countResult);

      res.json({ rows, total, page: query.page, pageSize: query.limit });
    } catch (err) {
      console.error('[stats/:entityType/search]', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/:entityType/:id',
  ensureAuthenticated,
  requireCrud('stats', 'read'),
  async (req, res): Promise<void> => {
    try {
      const entityTypeParam = getParamRequired(req, 'entityType');
      if (!isEntityType(entityTypeParam)) {
        res.status(400).json({
          message: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
        });
        return;
      }

      const idParam = getParamRequired(req, 'id');
      const id = parseInt(idParam, 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid id' });
        return;
      }

      const entity = ENTITY_CONFIG[entityTypeParam];
      const rowResult: unknown = await AppDbDataSourceRead.query(
        `SELECT
          ${popularityCountSelect(entityTypeParam)}
        FROM stats_popularity_${entityTypeParam} sa
        ${entity.titleJoin}
        WHERE sa.${entity.fkColumn} = $1
        LIMIT 1`,
        [id]
      );
      const popularityRows = readQueryRows(rowResult);
      const popularityRow = popularityRows[0];
      if (popularityRow === undefined) {
        res.status(404).json({ message: 'Stats record not found' });
        return;
      }

      const counts = readPopularityCountRow(popularityRow);
      const todayUtc = utcTodayDateString();
      const lookbackDays = STATS_POPULARITY_RANGE_LOOKBACK_DAYS.month;
      const windowStart = utcDateDaysBefore(todayUtc, lookbackDays);
      const dailyResult: unknown = await AppDbDataSourceRead.query(
        `SELECT day::text AS day, listener_count::int AS listener_count
        FROM stats_daily_${entityTypeParam}
        WHERE ${entity.fkColumn} = $1 AND day >= $2::date
        ORDER BY day ASC`,
        [id, windowStart]
      );
      const daily = buildDailyListenerSeries(
        readQueryRows(dailyResult).map(readDailyListenerQueryRow),
        todayUtc,
        lookbackDays
      );

      res.json({
        id: counts.id,
        title: counts.title,
        day_count: counts.day_count,
        week_count: counts.week_count,
        month_count: counts.month_count,
        all_time_count: counts.all_time_count,
        daily,
      });
    } catch (err) {
      console.error('[stats/:entityType/:id]', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

const statsRoot = express.Router();
statsRoot.use(`${config.api.prefix}${config.api.version}/stats`, router);
export const statsRouter = statsRoot;
