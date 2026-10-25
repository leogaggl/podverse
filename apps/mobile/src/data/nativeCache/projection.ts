/**
 * Native cache projection (car / watch).
 *
 * Dual-store model (see DOCS-MOBILE-DATA-LAYER-OFFLINE.md §7.1): SQLite is phone-UI-only and is
 * unavailable when the JS runtime is suspended. CarPlay templates, Android Auto
 * `MediaLibraryService`, and watch complications can only read a **native cache**. Repositories
 * that own queue / downloads / library-index state MUST call the matching projection helper on
 * every successful local mutation (and after sync reconcile) so the native cache stays coherent.
 *
 * Bridge writes are **best-effort and soft-fail**: a failure must never roll back the SQLite
 * mutation that triggered the projection.
 */

import { nativePlaybackBridge } from '../../bridge/nativePlaybackBridge';

/**
 * Canonical native-cache schema version. Bump only on a **breaking** payload change. Native
 * readers ignore unknown keys; additive optional fields do not require a bump. Native readers
 * consume payloads tagged with this version and ignore older envelopes.
 */
export const NATIVE_CACHE_SCHEMA_VERSION = 2 as const;

export type NativeCacheSchemaVersion = typeof NATIVE_CACHE_SCHEMA_VERSION;

export type NativeCacheMediumBucket = 'av' | 'music';

/** Engine meta `kind` values a queue entry can carry. Missing means `item`. */
export type NativeCacheQueueEntryKind = 'item' | 'clip' | 'item_soundbite' | 'add_by_rss';

/** Engine meta `kind` of the item a window continues from. */
export type AdvanceWindowAnchorKind = NativeCacheQueueEntryKind | 'livestream';

/**
 * Denormalized queue entry for car/watch now-playing + skip/advance. Required fields must always be
 * present; optional fields are additive. Native identifies a row by `kind` plus `idText`.
 */
export type NativeCacheQueueEntry = {
  idText: string;
  title: string;
  artworkUrl: string | null;
  /** Remote enclosure or relative download file name; `null` when unavailable. */
  mediaUrl: string | null;
  durationMs?: number | null;
  podcastTitle?: string | null;
  /** Verified artist names; when set, `podcastTitle` is the album. */
  artist?: string | null;
  startPositionSeconds?: number | null;
  kind?: NativeCacheQueueEntryKind | null;
  /** Range a clip or soundbite plays, the same values the engine meta carries. */
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  /** Completed download native prefers over `mediaUrl` when the file exists. */
  downloadFileName?: string | null;
};

export type QueueSnapshotProjection = {
  nowPlayingIdText: string | null;
  entries: NativeCacheQueueEntry[];
  mediumBucket?: NativeCacheMediumBucket;
};

/**
 * The play order after the playing item: the manual queue for its medium, then the automatic
 * rows JS already resolved. Native steps through it while JS is not running and makes no queue
 * choice of its own.
 */
export type AdvanceWindowProjection = {
  /** Must equal the engine meta's `queueMedium` for native to use the window. */
  mediumBucket: NativeCacheMediumBucket;
  /** Engine `meta.idText` of the item the window continues from. Null: nothing playing. */
  anchorIdText: string | null;
  /** Engine `meta.kind` of that item. Null exactly when `anchorIdText` is null. */
  anchorKind: AdvanceWindowAnchorKind | null;
  /** Play order after the anchor. Never contains the anchor. */
  entries: NativeCacheQueueEntry[];
};

export type NativeCacheDownloadEntry = {
  idText: string;
  title: string;
  /**
   * Download file name (or `downloads/<name>`), resolved by native against the current app
   * documents directory.
   */
  filePath: string;
  artworkUrl?: string | null;
  mediaUrl?: string | null;
  bytes?: number | null;
  channelTitle?: string | null;
  /** Verified artist names; when set, `channelTitle` is the album. */
  artist?: string | null;
};

export type DownloadsIndexProjection = {
  entries: NativeCacheDownloadEntry[];
};

export type NativeCacheBrowseNode = {
  idText: string;
  title: string;
  kind: 'podcast' | 'album' | 'artist' | 'playlist' | 'category';
  artworkUrl?: string | null;
  childCount?: number | null;
  mediumBucket?: NativeCacheMediumBucket;
};

export type LibraryBrowseIndexProjection = {
  nodes: NativeCacheBrowseNode[];
};

export type NativeCacheChildItem = {
  idText: string;
  title: string;
  subtitle?: string | null;
  /** Verified artist names; when set, `subtitle` or the library node title is the album. */
  artist?: string | null;
  artworkUrl?: string | null;
  mediaUrl: string | null;
  durationMs?: number | null;
  pubDateMs?: number | null;
  progressSeconds?: number | null;
  played?: boolean | null;
  downloadFileName?: string | null;
};

export type LibraryChildrenProjection = {
  channelIdText: string;
  mediumBucket: NativeCacheMediumBucket;
  items: NativeCacheChildItem[];
};

export type NativeCacheHistoryEntry = {
  idText: string;
  title: string;
  channelTitle?: string | null;
  /** Verified artist names; when set, `channelTitle` is the album. */
  artist?: string | null;
  artworkUrl?: string | null;
  mediaUrl: string | null;
  mediumBucket?: NativeCacheMediumBucket;
  playedAtMs?: number | null;
  downloadFileName?: string | null;
};

export type HistoryIndexProjection = {
  entries: NativeCacheHistoryEntry[];
};

export type NativeCacheLiveEntry = {
  idText: string;
  title: string;
  channelIdText: string;
  channelTitle?: string | null;
  artworkUrl?: string | null;
  mediaUrl: string;
  mediumBucket?: NativeCacheMediumBucket;
};

export type LiveIndexProjection = {
  entries: NativeCacheLiveEntry[];
};

export type AccountContextProjection = {
  signedIn: boolean;
  accountIdText: string | null;
};

/** Common envelope stamped on every persisted payload so native readers can validate the shape. */
type NativeCacheEnvelope = {
  schemaVersion: NativeCacheSchemaVersion;
  /** Epoch millis when JS produced the snapshot (native staleness / ordering). */
  updatedAtMs: number;
};

export type QueueSnapshotCachePayload = NativeCacheEnvelope & QueueSnapshotProjection;
export type AdvanceWindowCachePayload = NativeCacheEnvelope & AdvanceWindowProjection;
export type DownloadsIndexCachePayload = NativeCacheEnvelope & DownloadsIndexProjection;
export type LibraryBrowseIndexCachePayload = NativeCacheEnvelope & LibraryBrowseIndexProjection;
export type LibraryChildrenCachePayload = NativeCacheEnvelope & LibraryChildrenProjection;
export type HistoryIndexCachePayload = NativeCacheEnvelope & HistoryIndexProjection;
export type LiveIndexCachePayload = NativeCacheEnvelope & LiveIndexProjection;
export type AccountContextCachePayload = NativeCacheEnvelope & AccountContextProjection;

const nowMs = (updatedAtMs?: number): number =>
  updatedAtMs !== undefined ? updatedAtMs : Date.now();

const withEnvelope = <T extends object>(
  body: T,
  updatedAtMs?: number
): NativeCacheEnvelope & T => ({
  schemaVersion: NATIVE_CACHE_SCHEMA_VERSION,
  updatedAtMs: nowMs(updatedAtMs),
  ...body,
});

/** Wrap a queue snapshot in the versioned native-cache envelope (pure). */
export const buildQueueSnapshotPayload = (
  snapshot: QueueSnapshotProjection,
  updatedAtMs?: number
): QueueSnapshotCachePayload => withEnvelope(snapshot, updatedAtMs);

/** Wrap an advance window in the versioned native-cache envelope (pure). */
export const buildAdvanceWindowPayload = (
  window: AdvanceWindowProjection,
  updatedAtMs?: number
): AdvanceWindowCachePayload => withEnvelope(window, updatedAtMs);

/** Wrap a downloads index in the versioned native-cache envelope (pure). */
export const buildDownloadsIndexPayload = (
  index: DownloadsIndexProjection,
  updatedAtMs?: number
): DownloadsIndexCachePayload => withEnvelope(index, updatedAtMs);

/** Wrap a library browse index in the versioned native-cache envelope (pure). */
export const buildLibraryBrowseIndexPayload = (
  index: LibraryBrowseIndexProjection,
  updatedAtMs?: number
): LibraryBrowseIndexCachePayload => withEnvelope(index, updatedAtMs);

export const buildLibraryChildrenPayload = (
  children: LibraryChildrenProjection,
  updatedAtMs?: number
): LibraryChildrenCachePayload => withEnvelope(children, updatedAtMs);

export const buildHistoryIndexPayload = (
  index: HistoryIndexProjection,
  updatedAtMs?: number
): HistoryIndexCachePayload => withEnvelope(index, updatedAtMs);

export const buildLiveIndexPayload = (
  index: LiveIndexProjection,
  updatedAtMs?: number
): LiveIndexCachePayload => withEnvelope(index, updatedAtMs);

export const buildAccountContextPayload = (
  context: AccountContextProjection,
  updatedAtMs?: number
): AccountContextCachePayload => withEnvelope(context, updatedAtMs);

type NativeCacheWriteMethod =
  | 'writeQueueSnapshotAv'
  | 'writeQueueSnapshotMusic'
  | 'writeAdvanceWindow'
  | 'writeDownloadsIndex'
  | 'writeLibraryBrowseIndex'
  | 'writeHistoryIndex'
  | 'writeLiveIndex'
  | 'writeAccountContext';

/**
 * Serialize + forward a versioned payload to the durable native-cache bridge write. Best-effort:
 * a bridge failure (or unlinked native module in a JS-only context) is swallowed after a single
 * `__DEV__` warning so the caller's SQLite mutation is never rolled back.
 */
const writeToNativeCache = async (
  method: NativeCacheWriteMethod,
  payload: unknown
): Promise<void> => {
  try {
    await nativePlaybackBridge[method](JSON.stringify(payload));
  } catch (error) {
    if (__DEV__) {
      console.warn(`[native-cache] ${method} bridge unavailable (soft-fail)`, error);
    }
  }
};

export const projectQueueSnapshotToNativeCache = async (
  snapshot: QueueSnapshotProjection
): Promise<void> => {
  const bucket = snapshot.mediumBucket ?? 'av';
  const payload = buildQueueSnapshotPayload({ ...snapshot, mediumBucket: bucket });
  if (bucket === 'music') {
    await writeToNativeCache('writeQueueSnapshotMusic', payload);
  } else {
    await writeToNativeCache('writeQueueSnapshotAv', payload);
  }
};

export const projectQueueSnapshotAvToNativeCache = async (
  snapshot: QueueSnapshotProjection
): Promise<void> => {
  const payload = buildQueueSnapshotPayload({ ...snapshot, mediumBucket: 'av' });
  await writeToNativeCache('writeQueueSnapshotAv', payload);
};

export const projectQueueSnapshotMusicToNativeCache = async (
  snapshot: QueueSnapshotProjection
): Promise<void> => {
  await writeToNativeCache(
    'writeQueueSnapshotMusic',
    buildQueueSnapshotPayload({ ...snapshot, mediumBucket: 'music' })
  );
};

export const projectAdvanceWindowToNativeCache = async (
  window: AdvanceWindowProjection
): Promise<void> => {
  await writeToNativeCache('writeAdvanceWindow', buildAdvanceWindowPayload(window));
};

export const projectDownloadsIndexToNativeCache = async (
  index: DownloadsIndexProjection
): Promise<void> => {
  await writeToNativeCache('writeDownloadsIndex', buildDownloadsIndexPayload(index));
};

export const projectLibraryBrowseIndexToNativeCache = async (
  index: LibraryBrowseIndexProjection
): Promise<void> => {
  await writeToNativeCache('writeLibraryBrowseIndex', buildLibraryBrowseIndexPayload(index));
};

export const projectLibraryChildrenToNativeCache = async (
  children: LibraryChildrenProjection
): Promise<void> => {
  try {
    await nativePlaybackBridge.writeLibraryChildren(
      children.channelIdText,
      JSON.stringify(buildLibraryChildrenPayload(children))
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('[native-cache] writeLibraryChildren bridge unavailable (soft-fail)', error);
    }
  }
};

export const projectHistoryIndexToNativeCache = async (
  index: HistoryIndexProjection
): Promise<void> => {
  await writeToNativeCache('writeHistoryIndex', buildHistoryIndexPayload(index));
};

export const projectLiveIndexToNativeCache = async (index: LiveIndexProjection): Promise<void> => {
  await writeToNativeCache('writeLiveIndex', buildLiveIndexPayload(index));
};

export const projectAccountContextToNativeCache = async (
  context: AccountContextProjection
): Promise<void> => {
  await writeToNativeCache('writeAccountContext', buildAccountContextPayload(context));
};
