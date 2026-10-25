/**
 * The source the native advance window was built from, saved on the device so JS can continue it
 * after adopting an item the engine reached on its own (the app was closed, or the car started
 * it). Pure; the SQLite half is `nativeAdvanceSourceRepository`.
 */

import type { DTOQueueResource } from '@podverse/helpers/dto';
import { isPlainObject } from '@podverse/helpers/guards';
import type { PlaybackTarget } from '@podverse/playback-core';
import type {
  AutoQueueConfig,
  AutoQueueResourcesMap,
  AutoQueueResourcesMapRow,
} from '@podverse/playback-core/autoQueue';
import { autoQueueSeedFromPlaybackTarget } from '@podverse/playback-core/autoQueue';

import { safeJsonParse } from '../../data/db/serialization';
import type {
  AdvanceWindowAnchorKind,
  NativeCacheQueueEntryKind,
} from '../../data/nativeCache/projection';
import {
  advanceIdentityFromAutoQueueRow,
  autoQueueRowFromQueueResource,
  nativeAdvanceIdentityKey,
} from '../../data/nativeCache/queueEntryMapping';
import { hasUrlUserinfo, isAddByRssResourceData } from '../addByRss/playbackUrl';
import { addByRssPlaybackMediaId } from '../addByRss/resourceData';
import { engineSourceIdentityFromTarget } from './mediaEngineSourceMeta';

export const NATIVE_ADVANCE_SOURCE_VERSION = 1 as const;

export type NativeAdvanceSourceRow = {
  kind: NativeCacheQueueEntryKind;
  idText: string;
  row: AutoQueueResourcesMapRow;
};

export type NativeAdvanceSourceV1 = {
  v: typeof NATIVE_ADVANCE_SOURCE_VERSION;
  anchor: { kind: AdvanceWindowAnchorKind; idText: string };
  /** The auto-queue buffer from the active row through the highest key, with its config. */
  autoQueue: { config: AutoQueueConfig; rows: NativeAdvanceSourceRow[] } | null;
  /** Add by RSS entries in the window (the anchor too, when it is one), with their feed URL. */
  addByRss: { idText: string; feedUrl: string }[];
  updatedAtMs: number;
};

export type AdoptedQueueCaches = {
  nowPlaying: DTOQueueResource | null;
  upcoming: DTOQueueResource[];
};

export type AdoptedContinuation = {
  /** Saved auto-queue buffer to restore at active row 0. Null: refill from the item's own source. */
  autoQueue: { resources: AutoQueueResourcesMap; config: AutoQueueConfig } | null;
  /** The saved auto-queue row or account queue row the adopted item plays as. */
  row: AutoQueueResourcesMapRow | null;
  /** Feed URL of an adopted Add by RSS episode that the saved source lists. */
  addByRssFeedUrl: string | null;
};

type AdvanceIdentity = { kind: string; idText: string };

const ROW_KIND_LIST: readonly NativeCacheQueueEntryKind[] = [
  'item',
  'clip',
  'item_soundbite',
  'add_by_rss',
];
const ROW_KINDS: ReadonlySet<string> = new Set<string>(ROW_KIND_LIST);
const ANCHOR_KINDS: ReadonlySet<string> = new Set<string>([...ROW_KIND_LIST, 'livestream']);

const sortedResourceKeys = (resources: AutoQueueResourcesMap): number[] =>
  Object.keys(resources)
    .map(Number)
    .filter((key) => Number.isFinite(key))
    .sort((a, b) => a - b);

const savedAutoQueueRows = (
  resources: AutoQueueResourcesMap,
  activeRow: number
): NativeAdvanceSourceRow[] => {
  const rows: NativeAdvanceSourceRow[] = [];
  for (const key of sortedResourceKeys(resources)) {
    const row = resources[key];
    if (key < activeRow || row === undefined) {
      continue;
    }
    rows.push({ ...advanceIdentityFromAutoQueueRow(row), row });
  }
  return rows;
};

/**
 * What the window hook saves beside the window it wrote. The whole buffer tail is kept, not only
 * the rows in the window: the config pages from the buffer's highest key, so a shorter list would
 * skip rows when the fill resumes. Null when nothing could continue.
 */
export const buildNativeAdvanceSource = (input: {
  target: PlaybackTarget | null;
  resources: AutoQueueResourcesMap;
  activeRow: number;
  config: AutoQueueConfig;
  addByRssFeedUrls: ReadonlyMap<string, string>;
  nowMs: number;
}): NativeAdvanceSourceV1 | null => {
  const { target } = input;
  if (target === null) {
    return null;
  }
  const anchor = engineSourceIdentityFromTarget(target);
  if (anchor === null) {
    return null;
  }

  const rows =
    autoQueueSeedFromPlaybackTarget(target) !== null && !input.config.disabled
      ? savedAutoQueueRows(input.resources, input.activeRow)
      : [];
  const autoQueue = rows.length > 0 ? { config: input.config, rows } : null;

  const addByRss: NativeAdvanceSourceV1['addByRss'] = [];
  for (const [idText, feedUrl] of input.addByRssFeedUrls) {
    if (!hasUrlUserinfo(feedUrl)) {
      addByRss.push({ feedUrl, idText });
    }
  }

  if (autoQueue === null && addByRss.length === 0) {
    return null;
  }
  return {
    addByRss,
    anchor: { idText: anchor.idText, kind: anchor.kind },
    autoQueue,
    updatedAtMs: input.nowMs,
    v: NATIVE_ADVANCE_SOURCE_VERSION,
  };
};

/** Equal for two sources that would continue the same way; `updatedAtMs` is not part of it. */
export const nativeAdvanceSourceWriteKey = (source: NativeAdvanceSourceV1 | null): string => {
  if (source === null) {
    return '';
  }
  const parts = [
    `anchor=${nativeAdvanceIdentityKey(source.anchor)}`,
    `config=${source.autoQueue === null ? '' : JSON.stringify(source.autoQueue.config)}`,
  ];
  for (const row of source.autoQueue?.rows ?? []) {
    parts.push(`row=${nativeAdvanceIdentityKey(row)}`);
  }
  for (const pair of source.addByRss) {
    parts.push(`rss=${pair.idText}=${pair.feedUrl}`);
  }
  return parts.join('|');
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isSavedRow = (value: unknown): value is NativeAdvanceSourceRow =>
  isPlainObject(value) &&
  typeof value.kind === 'string' &&
  ROW_KINDS.has(value.kind) &&
  typeof value.idText === 'string' &&
  isPlainObject(value.row);

const isSavedAutoQueue = (value: unknown): value is NativeAdvanceSourceV1['autoQueue'] =>
  value === null ||
  (isPlainObject(value) &&
    isPlainObject(value.config) &&
    Array.isArray(value.rows) &&
    value.rows.every(isSavedRow));

const isSavedAddByRssPair = (value: unknown): value is { idText: string; feedUrl: string } =>
  isPlainObject(value) && typeof value.idText === 'string' && typeof value.feedUrl === 'string';

const isNativeAdvanceSource = (value: unknown): value is NativeAdvanceSourceV1 =>
  isPlainObject(value) &&
  value.v === NATIVE_ADVANCE_SOURCE_VERSION &&
  isPlainObject(value.anchor) &&
  isNonEmptyString(value.anchor.kind) &&
  ANCHOR_KINDS.has(value.anchor.kind) &&
  isNonEmptyString(value.anchor.idText) &&
  isSavedAutoQueue(value.autoQueue) &&
  Array.isArray(value.addByRss) &&
  value.addByRss.every(isSavedAddByRssPair) &&
  typeof value.updatedAtMs === 'number' &&
  Number.isFinite(value.updatedAtMs);

/** The stored source, or null when it is missing or not in the shape this build writes. */
export const parseNativeAdvanceSource = (raw: string | null): NativeAdvanceSourceV1 | null => {
  if (raw === null) {
    return null;
  }
  const parsed = safeJsonParse<unknown>(raw);
  return isNativeAdvanceSource(parsed) ? parsed : null;
};

/**
 * The identity keys the engine can report for a manual queue row: the advance window's (a clip
 * row is `clip` plus the clip id) and the account snapshot's (`item` plus the item id, since the
 * car's Queue tab plays the whole item). An Add by RSS row has its media id only.
 */
export const manualQueueResourceIdentityKeys = (resource: DTOQueueResource): string[] => {
  if (isAddByRssResourceData(resource.add_by_rss_resource_data)) {
    return [
      nativeAdvanceIdentityKey({
        idText: addByRssPlaybackMediaId(resource.add_by_rss_resource_data),
        kind: 'add_by_rss',
      }),
    ];
  }
  // The DTO types `item` as required, but clip and soundbite rows can arrive without it.
  const hasItem = resource.item !== null && resource.item !== undefined;
  const keys: string[] = [];
  if (resource.clip || resource.item_soundbite?.item || hasItem) {
    keys.push(
      nativeAdvanceIdentityKey(
        advanceIdentityFromAutoQueueRow(autoQueueRowFromQueueResource(resource))
      )
    );
  }
  if (hasItem) {
    const snapshotKey = nativeAdvanceIdentityKey({ idText: resource.item.id_text, kind: 'item' });
    if (!keys.includes(snapshotKey)) {
      keys.push(snapshotKey);
    }
  }
  return keys;
};

/** The first manual queue row the engine identity names, now playing before upcoming. */
export const findManualQueueResource = (
  queues: readonly AdoptedQueueCaches[],
  identity: AdvanceIdentity
): DTOQueueResource | null => {
  const key = nativeAdvanceIdentityKey(identity);
  for (const queue of queues) {
    const resources =
      queue.nowPlaying === null ? queue.upcoming : [queue.nowPlaying, ...queue.upcoming];
    for (const resource of resources) {
      if (manualQueueResourceIdentityKeys(resource).includes(key)) {
        return resource;
      }
    }
  }
  return null;
};

const renumberedFromZero = (rows: readonly NativeAdvanceSourceRow[]): AutoQueueResourcesMap => {
  const resources: AutoQueueResourcesMap = {};
  rows.forEach((saved, index) => {
    resources[index] = saved.row;
  });
  return resources;
};

/**
 * How JS continues after adopting the item the engine is playing. An item in the account queue
 * keeps the whole saved buffer behind it, with its active row, as a manual-queue load in the app
 * does. Otherwise a saved auto-queue row restores the buffer from that row on. An item that is
 * neither (an episode of the same podcast included) gets no buffer and refills from its own
 * source. Null when nothing saved applies.
 */
export const decideAdoptedContinuation = (
  source: NativeAdvanceSourceV1 | null,
  identity: AdvanceIdentity,
  manualResource: DTOQueueResource | null
): AdoptedContinuation | null => {
  if (source === null) {
    return null;
  }
  const key = nativeAdvanceIdentityKey(identity);
  const savedRows = source.autoQueue?.rows ?? [];
  const savedIndex = savedRows.findIndex((saved) => nativeAdvanceIdentityKey(saved) === key);

  const addByRssFeedUrl =
    identity.kind === 'add_by_rss'
      ? (source.addByRss.find((pair) => pair.idText === identity.idText)?.feedUrl ?? null)
      : null;

  // A clip row the car played as its whole item matched by the snapshot key, so it is adopted
  // as that item and not as the clip.
  const manualRow =
    manualResource !== null &&
    !isAddByRssResourceData(manualResource.add_by_rss_resource_data) &&
    manualQueueResourceIdentityKeys(manualResource)[0] === key
      ? autoQueueRowFromQueueResource(manualResource)
      : null;

  const autoQueue = ((): AdoptedContinuation['autoQueue'] => {
    if (source.autoQueue === null || savedRows.length === 0) {
      return null;
    }
    if (manualResource !== null) {
      return { config: source.autoQueue.config, resources: renumberedFromZero(savedRows) };
    }
    if (savedIndex >= 0) {
      return {
        config: source.autoQueue.config,
        resources: renumberedFromZero(savedRows.slice(savedIndex)),
      };
    }
    return null;
  })();

  const row = manualRow ?? (savedIndex >= 0 ? (savedRows[savedIndex]?.row ?? null) : null);

  if (autoQueue === null && row === null && addByRssFeedUrl === null) {
    return null;
  }
  return { addByRssFeedUrl, autoQueue, row };
};
