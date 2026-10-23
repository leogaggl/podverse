import Joi from 'joi';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const STATS_FLAGGED_LISTENER_STATUSES = ['active', 'cleared', 'all'] as const;

export type StatsFlaggedListenerStatus = (typeof STATS_FLAGGED_LISTENER_STATUSES)[number];

const LIST_STATUS_VALUES = new Set<string>(STATS_FLAGGED_LISTENER_STATUSES);

export const statsFlaggedListenerListQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...STATS_FLAGGED_LISTENER_STATUSES)
    .default('active'),
  page: Joi.number().integer().min(1).default(DEFAULT_PAGE),
  limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
}).unknown(false);

export type StatsFlaggedListenerListQueryValidated = {
  page: number;
  limit: number;
  status: StatsFlaggedListenerStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStatsFlaggedListenerStatus(value: string): value is StatsFlaggedListenerStatus {
  return LIST_STATUS_VALUES.has(value);
}

export function parseStatsFlaggedListenerListQuery(
  value: unknown
): StatsFlaggedListenerListQueryValidated | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  const page = value.page;
  const limit = value.limit;
  if (typeof status !== 'string' || !isStatsFlaggedListenerStatus(status)) {
    return null;
  }
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
    return null;
  }
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return null;
  }
  return { status, page, limit };
}
