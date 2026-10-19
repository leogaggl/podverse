import Joi from 'joi';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const FEED_MERGE_LIST_STATUSES = [
  'detected',
  'verified',
  'needs_review',
  'applied',
  'rejected',
  'reverted',
  'all',
] as const;

export type FeedMergeListStatus = (typeof FEED_MERGE_LIST_STATUSES)[number];

const LIST_STATUS_VALUES = new Set<string>(FEED_MERGE_LIST_STATUSES);

export const feedMergeListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  status: Joi.string()
    .valid(...FEED_MERGE_LIST_STATUSES)
    .default('needs_review'),
}).unknown(false);

export type FeedMergeListQueryValidated = {
  page: number;
  limit: number;
  status: FeedMergeListStatus;
};

export const feedMergeNoteBodySchema = Joi.object({
  note: Joi.string().trim().max(2000).allow('', null).optional(),
}).unknown(false);

export type FeedMergeNoteBodyValidated = {
  note?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFeedMergeListStatus(value: string): value is FeedMergeListStatus {
  return LIST_STATUS_VALUES.has(value);
}

export function parseFeedMergeListQuery(value: unknown): FeedMergeListQueryValidated | null {
  if (!isRecord(value)) {
    return null;
  }
  const page = value.page;
  const limit = value.limit;
  const status = value.status;
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
    return null;
  }
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return null;
  }
  if (typeof status !== 'string' || !isFeedMergeListStatus(status)) {
    return null;
  }
  return { page, limit, status };
}

export function parseFeedMergeNoteBody(value: unknown): FeedMergeNoteBodyValidated | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!('note' in value) || value.note === undefined) {
    return {};
  }
  if (value.note === null) {
    return { note: null };
  }
  if (typeof value.note === 'string') {
    return { note: value.note };
  }
  return null;
}
