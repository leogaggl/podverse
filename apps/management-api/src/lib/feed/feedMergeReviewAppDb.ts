import { MergeStatusConflictError } from '@management-api/lib/feed/feedMergeReviewErrors.js';
import { AppDbDataSourceRead, AppDbDataSourceReadWrite } from '@management-api/orm/db/appDb.js';

import { revertChannelMerge } from '@podverse/orm';

const MERGE_STATUSES = [
  'detected',
  'verified',
  'needs_review',
  'applied',
  'rejected',
  'reverted',
] as const;

export type FeedMergeStatus = (typeof MERGE_STATUSES)[number];

const MERGE_STATUS_VALUES = new Set<string>(MERGE_STATUSES);

const APPROVE_FROM: readonly FeedMergeStatus[] = ['needs_review'];
const REJECT_FROM: readonly FeedMergeStatus[] = ['detected', 'verified', 'needs_review'];

export type FeedMergeMode = 'repoint' | 'absorb';

export type FeedMergeItemTier = 'guid' | 'enclosure' | 'fuzzy';

export type FeedMergeListRow = {
  id: number;
  from_podcast_index_id: number;
  to_podcast_index_id: number;
  from_channel_title: string | null;
  to_channel_title: string | null;
  confidence: string | null;
  mode: FeedMergeMode | null;
  status: FeedMergeStatus;
};

export type FeedMergeItemPair = {
  from_title: string | null;
  to_title: string | null;
  match_tier: FeedMergeItemTier | null;
};

export type FeedMergeDetail = FeedMergeListRow & {
  note: string | null;
  from_feed_lifecycle_state_key: string | null;
  match_stats: Record<string, unknown>;
  item_pairs: FeedMergeItemPair[];
};

export type FeedMergeAuditSnapshot = {
  id: number;
  status: FeedMergeStatus;
  note: string | null;
  from_podcast_index_id: number;
  to_podcast_index_id: number;
};

export type FeedMergeReviewUpdate = {
  before: FeedMergeAuditSnapshot;
  merge: FeedMergeDetail;
};

type Queryable = {
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>;
};

const LIST_SQL = `
SELECT
  m.id,
  m.from_podcast_index_id,
  m.to_podcast_index_id,
  m.confidence::text AS confidence,
  m.mode,
  m.status,
  fc.title AS from_channel_title,
  tc.title AS to_channel_title
FROM channel_merge m
LEFT JOIN channel fc ON fc.id = m.from_channel_id
LEFT JOIN channel tc ON tc.id = m.to_channel_id
WHERE ($1::text IS NULL OR m.status = $1)
ORDER BY m.id DESC
LIMIT $2 OFFSET $3
`;

const COUNT_SQL = `
SELECT COUNT(*)::int AS total
FROM channel_merge m
WHERE ($1::text IS NULL OR m.status = $1)
`;

const DETAIL_SQL = `
SELECT
  m.id,
  m.from_podcast_index_id,
  m.to_podcast_index_id,
  m.confidence::text AS confidence,
  m.mode,
  m.status,
  m.note,
  m.match_stats,
  fc.title AS from_channel_title,
  tc.title AS to_channel_title,
  flst.state_key AS from_feed_lifecycle_state_key
FROM channel_merge m
LEFT JOIN channel fc ON fc.id = m.from_channel_id
LEFT JOIN channel tc ON tc.id = m.to_channel_id
LEFT JOIN feed f ON f.id = fc.feed_id
LEFT JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
LEFT JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
WHERE m.id = $1
`;

const PAIRS_SQL = `
SELECT
  fi.title AS from_title,
  ti.title AS to_title,
  map.match_tier
FROM item_merge_map map
LEFT JOIN item fi ON fi.id = map.from_item_id
LEFT JOIN item ti ON ti.id = map.to_item_id
WHERE map.channel_merge_id = $1
  AND map.match_tier IS NOT NULL
ORDER BY map.id ASC
LIMIT 20
`;

const LOCK_SQL = `
SELECT
  id,
  status,
  note,
  from_podcast_index_id,
  to_podcast_index_id
FROM channel_merge
WHERE id = $1
FOR UPDATE
`;

const UPDATE_SQL = `
UPDATE channel_merge
SET status = $2,
    note = CASE WHEN $3::boolean THEN $4 ELSE note END
WHERE id = $1
  AND status = ANY($5::text[])
RETURNING id
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFeedMergeStatus(value: string): value is FeedMergeStatus {
  return MERGE_STATUS_VALUES.has(value);
}

function readRequiredInt(value: unknown, label: string): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  throw new Error(`${label} is not an integer`);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readStatus(value: unknown): FeedMergeStatus {
  if (typeof value === 'string' && isFeedMergeStatus(value)) {
    return value;
  }
  throw new Error('channel_merge status is not recognized');
}

function readMode(value: unknown): FeedMergeMode | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === 'repoint' || value === 'absorb') {
    return value;
  }
  throw new Error('channel_merge mode is not recognized');
}

function readTier(value: unknown): FeedMergeItemTier | null {
  if (value === 'guid' || value === 'enclosure' || value === 'fuzzy') {
    return value;
  }
  return null;
}

function readMatchStats(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
    return readMatchStats(parsed);
  }
  if (!isRecord(value)) {
    return {};
  }
  const stats: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    stats[key] = entry;
  }
  return stats;
}

async function queryRows(db: Queryable, sql: string, parameters: unknown[]): Promise<unknown[]> {
  const result = await db.query(sql, parameters);
  if (!Array.isArray(result)) {
    throw new Error('channel_merge query did not return rows');
  }
  return result;
}

function mapListRow(value: unknown): FeedMergeListRow {
  if (!isRecord(value)) {
    throw new Error('channel_merge row is not an object');
  }
  return {
    id: readRequiredInt(value.id, 'id'),
    from_podcast_index_id: readRequiredInt(value.from_podcast_index_id, 'from_podcast_index_id'),
    to_podcast_index_id: readRequiredInt(value.to_podcast_index_id, 'to_podcast_index_id'),
    from_channel_title: readOptionalString(value.from_channel_title),
    to_channel_title: readOptionalString(value.to_channel_title),
    confidence: readOptionalString(value.confidence),
    mode: readMode(value.mode),
    status: readStatus(value.status),
  };
}

function mapAudit(value: unknown): FeedMergeAuditSnapshot {
  if (!isRecord(value)) {
    throw new Error('channel_merge row is not an object');
  }
  return {
    id: readRequiredInt(value.id, 'id'),
    status: readStatus(value.status),
    note: readOptionalString(value.note),
    from_podcast_index_id: readRequiredInt(value.from_podcast_index_id, 'from_podcast_index_id'),
    to_podcast_index_id: readRequiredInt(value.to_podcast_index_id, 'to_podcast_index_id'),
  };
}

function mapPair(value: unknown): FeedMergeItemPair {
  if (!isRecord(value)) {
    throw new Error('item_merge_map row is not an object');
  }
  return {
    from_title: readOptionalString(value.from_title),
    to_title: readOptionalString(value.to_title),
    match_tier: readTier(value.match_tier),
  };
}

async function loadDetail(db: Queryable, id: number): Promise<FeedMergeDetail | null> {
  const rows = await queryRows(db, DETAIL_SQL, [id]);
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  if (!isRecord(first)) {
    throw new Error('channel_merge row is not an object');
  }
  const pairs = await queryRows(db, PAIRS_SQL, [id]);
  return {
    ...mapListRow(first),
    note: readOptionalString(first.note),
    from_feed_lifecycle_state_key: readOptionalString(first.from_feed_lifecycle_state_key),
    match_stats: readMatchStats(first.match_stats),
    item_pairs: pairs.map(mapPair),
  };
}

function normalizeStoredNote(note: string | null | undefined): {
  provided: boolean;
  value: string | null;
} {
  if (note === undefined) {
    return { provided: false, value: null };
  }
  if (note === null) {
    return { provided: true, value: null };
  }
  const trimmed = note.trim();
  return { provided: true, value: trimmed === '' ? null : trimmed };
}

async function setStatus(
  id: number,
  nextStatus: FeedMergeStatus,
  allowed: readonly FeedMergeStatus[],
  note: string | null | undefined,
  conflictMessage: string
): Promise<FeedMergeReviewUpdate | null> {
  const storedNote = normalizeStoredNote(note);
  return AppDbDataSourceReadWrite.transaction(async (manager) => {
    const locked = await queryRows(manager, LOCK_SQL, [id]);
    const current = locked[0];
    if (current === undefined) {
      return null;
    }
    const before = mapAudit(current);
    if (!allowed.includes(before.status)) {
      throw new MergeStatusConflictError(conflictMessage);
    }
    const updated = await queryRows(manager, UPDATE_SQL, [
      id,
      nextStatus,
      storedNote.provided,
      storedNote.value,
      allowed,
    ]);
    if (updated.length === 0) {
      throw new MergeStatusConflictError(conflictMessage);
    }
    const merge = await loadDetail(manager, id);
    if (merge === null) {
      throw new Error('channel_merge disappeared during update');
    }
    return { before, merge };
  });
}

export async function listFeedMerges(params: {
  page: number;
  limit: number;
  status: FeedMergeStatus | null;
}): Promise<{ merges: FeedMergeListRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;
  const [countRows, rows] = await Promise.all([
    queryRows(AppDbDataSourceRead, COUNT_SQL, [params.status]),
    queryRows(AppDbDataSourceRead, LIST_SQL, [params.status, params.limit, offset]),
  ]);
  const countRow = countRows[0];
  const total =
    countRow === undefined
      ? 0
      : readRequiredInt(isRecord(countRow) ? countRow.total : undefined, 'total');
  return { merges: rows.map(mapListRow), total };
}

export async function getFeedMerge(id: number): Promise<FeedMergeDetail | null> {
  return loadDetail(AppDbDataSourceRead, id);
}

/**
 * Marks a needs-review pair verified and stores the note.
 * The next apply run moves the feeds. This does not.
 */
export async function approveChannelMerge(
  id: number,
  note: string | null | undefined
): Promise<FeedMergeReviewUpdate | null> {
  return setStatus(
    id,
    'verified',
    APPROVE_FROM,
    note,
    'Approve is allowed only when the merge needs review'
  );
}

export async function rejectChannelMerge(
  id: number,
  note: string | null | undefined
): Promise<FeedMergeReviewUpdate | null> {
  return setStatus(
    id,
    'rejected',
    REJECT_FROM,
    note,
    'Reject is allowed only from detected, verified, or needs review'
  );
}

/**
 * Restores an applied merge. Any other status is refused before the restore runs.
 */
export async function revertAppliedChannelMerge(id: number): Promise<FeedMergeReviewUpdate | null> {
  const existing = await loadDetail(AppDbDataSourceRead, id);
  if (existing === null) {
    return null;
  }
  if (existing.status !== 'applied') {
    throw new MergeStatusConflictError('Revert is allowed only when the merge is applied');
  }
  const before: FeedMergeAuditSnapshot = {
    id: existing.id,
    status: existing.status,
    note: existing.note,
    from_podcast_index_id: existing.from_podcast_index_id,
    to_podcast_index_id: existing.to_podcast_index_id,
  };
  await revertChannelMerge(id);
  const merge = await loadDetail(AppDbDataSourceRead, id);
  if (merge === null || merge.status !== 'reverted') {
    throw new MergeStatusConflictError('Revert is allowed only when the merge is applied');
  }
  return { before, merge };
}
