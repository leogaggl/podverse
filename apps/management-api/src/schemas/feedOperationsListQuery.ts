import Joi from 'joi';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const SORT_KEYS = [
  'id',
  'podcast_index_id',
  'channel_title',
  'lifecycle_state_key',
  'url',
  'description_longest_source_length',
] as const;

export const feedOperationsListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sort: Joi.string()
    .valid(...SORT_KEYS)
    .default('id'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  q: Joi.string().trim().allow('').optional(),
  lifecycle: Joi.string().trim().allow('').optional(),
  /** True keeps only feeds whose last successful parse shortened a description. */
  description_truncated: Joi.boolean().optional(),
}).unknown(false);

export type FeedOperationsListQueryValidated = {
  page: number;
  limit: number;
  sort: (typeof SORT_KEYS)[number];
  order: 'asc' | 'desc';
  q?: string;
  lifecycle?: string;
  description_truncated?: boolean;
};
