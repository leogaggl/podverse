import type { Readable } from 'node:stream';

import csv from 'csv-parser';

export type DeadFeedCsvRow = {
  id_to_archive: number;
  duplicate_id_to_keep: number | null;
};

export type DeadFeedDuplicatePair = {
  fromPodcastIndexId: number;
  toPodcastIndexId: number;
};

/**
 * Column 0 is the dead Podcast Index id. Column 1 is `duplicateOf`, or empty when
 * the feed was marked dead for another reason.
 */
export function extractDeadFeedCsvRow(row: readonly string[]): DeadFeedCsvRow | null {
  const fromId = parseInt(row[0] ?? '', 10);
  if (!Number.isFinite(fromId)) {
    return null;
  }
  const rawTarget = row[1] ?? '';
  if (rawTarget.trim() === '') {
    return { id_to_archive: fromId, duplicate_id_to_keep: null };
  }
  const targetId = parseInt(rawTarget, 10);
  return {
    id_to_archive: fromId,
    duplicate_id_to_keep: Number.isFinite(targetId) ? targetId : null,
  };
}

export function deadFeedTargetMap(rows: readonly DeadFeedCsvRow[]): Map<number, number | null> {
  const targets = new Map<number, number | null>();
  for (const row of rows) {
    if (!Number.isFinite(row.id_to_archive)) {
      continue;
    }
    targets.set(row.id_to_archive, row.duplicate_id_to_keep);
  }
  return targets;
}

/**
 * Walk each dead id to a feed that is not on the dead list.
 * A cycle, or a final id that is itself dead and has no further target, is omitted.
 */
export function resolveDeadFeedDuplicateChains(
  targets: ReadonlyMap<number, number | null>
): Map<number, number> {
  const resolved = new Map<number, number>();
  for (const fromId of targets.keys()) {
    const survivor = walkToLiveSurvivor(fromId, targets);
    if (survivor !== null) {
      resolved.set(fromId, survivor);
    }
  }
  return resolved;
}

function walkToLiveSurvivor(
  start: number,
  targets: ReadonlyMap<number, number | null>
): number | null {
  const visited = new Set<number>();
  let current = start;
  while (targets.has(current)) {
    if (visited.has(current)) {
      return null;
    }
    visited.add(current);
    const next = targets.get(current);
    if (next === null || next === undefined || !Number.isFinite(next)) {
      return null;
    }
    if (!targets.has(next)) {
      return next;
    }
    current = next;
  }
  return null;
}

/**
 * Held Podcast Index ids that are on the dead list and do not resolve to a live survivor.
 * That is an empty `duplicateOf`, a cycle, or a chain that ends on another dead id.
 */
export function podcastIndexIdsToRetire(
  targets: ReadonlyMap<number, number | null>,
  heldPodcastIndexIds: ReadonlySet<number>
): number[] {
  const resolved = resolveDeadFeedDuplicateChains(targets);
  const ids: number[] = [];
  for (const podcastIndexId of heldPodcastIndexIds) {
    if (!targets.has(podcastIndexId) || resolved.has(podcastIndexId)) {
      continue;
    }
    ids.push(podcastIndexId);
  }
  ids.sort((left, right) => left - right);
  return ids;
}

/** Growth above this, and above 1% of held feeds, refuses a retire run. */
export const RETIRE_BRAKE_MIN_GROWTH = 2000;

/** How many feeds one apply run may move to pending archive. */
export const RETIRE_MAX_PER_RUN = 200;

/**
 * True when there is no stored count, or when eligible growth is above
 * max(2000, 1% of held feeds). A drop in the eligible count is false.
 */
export function retireGrowthExceedsBrake(params: {
  eligibleCount: number;
  previousEligibleCount: number | null;
  heldCount: number;
}): boolean {
  if (params.previousEligibleCount === null) {
    return true;
  }
  const growth = params.eligibleCount - params.previousEligibleCount;
  if (growth < 0) {
    return false;
  }
  const limit = Math.max(RETIRE_BRAKE_MIN_GROWTH, Math.ceil(params.heldCount * 0.01));
  return growth > limit;
}

/** Keep pairs whose dead id is a Podcast Index id we already store. */
export function deadFeedPairsWeHold(
  resolved: ReadonlyMap<number, number>,
  heldPodcastIndexIds: ReadonlySet<number>
): DeadFeedDuplicatePair[] {
  const pairs: DeadFeedDuplicatePair[] = [];
  for (const [fromPodcastIndexId, toPodcastIndexId] of resolved) {
    if (!heldPodcastIndexIds.has(fromPodcastIndexId)) {
      continue;
    }
    pairs.push({ fromPodcastIndexId, toPodcastIndexId });
  }
  return pairs;
}

function csvRowCells(row: unknown): string[] {
  if (Array.isArray(row)) {
    return row.map((cell) => (typeof cell === 'string' ? cell : ''));
  }
  if (typeof row !== 'object' || row === null) {
    return [];
  }
  const cells: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const value = Reflect.get(row, String(index));
    cells.push(typeof value === 'string' ? value : '');
  }
  return cells;
}

export async function forEachDeadFeedCsvRow(
  input: Readable,
  onRow: (row: string[]) => void | Promise<void>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error === undefined) {
        resolve();
      } else {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const stream = input.pipe(csv({ headers: false, skipLines: 0 }));
    stream.on('data', (row: unknown) => {
      stream.pause();
      Promise.resolve()
        .then(() => onRow(csvRowCells(row)))
        .then(() => {
          stream.resume();
        })
        .catch((error: unknown) => {
          stream.destroy(error instanceof Error ? error : new Error(String(error)));
        });
    });
    stream.on('end', () => finish());
    stream.on('error', (error: unknown) => finish(error));
  });
}
