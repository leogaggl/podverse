export { getDb, getSqlite, initializeDatabase, schema } from './db';
export type { AppDatabase } from './db';

export {
  buildAccountContextPayload,
  buildDownloadsIndexPayload,
  buildHistoryIndexPayload,
  buildLibraryBrowseIndexPayload,
  buildLibraryChildrenPayload,
  buildLiveIndexPayload,
  buildQueueSnapshotPayload,
  NATIVE_CACHE_SCHEMA_VERSION,
  projectAccountContextToNativeCache,
  projectDownloadsIndexToNativeCache,
  projectHistoryIndexToNativeCache,
  projectLibraryBrowseIndexToNativeCache,
  projectLibraryChildrenToNativeCache,
  projectLiveIndexToNativeCache,
  projectQueueSnapshotAvToNativeCache,
  projectQueueSnapshotMusicToNativeCache,
  projectQueueSnapshotToNativeCache,
  reprojectCarCacheAll,
  reprojectLibraryIndex,
} from './nativeCache';
export type {
  AccountContextCachePayload,
  AccountContextProjection,
  DownloadsIndexCachePayload,
  DownloadsIndexProjection,
  HistoryIndexCachePayload,
  HistoryIndexProjection,
  LibraryBrowseIndexCachePayload,
  LibraryBrowseIndexProjection,
  LiveIndexCachePayload,
  LiveIndexProjection,
  NativeCacheBrowseNode,
  NativeCacheSchemaVersion,
  QueueSnapshotCachePayload,
  QueueSnapshotProjection,
} from './nativeCache';

export {
  accountRepository,
  addByRssCredentialStore,
  addByRssRepository,
  autoQueueRepository,
  clipRepository,
  downloadsRepository,
  exampleRepository,
  playbackContentRepository,
  playbackOutboxRepository,
  playlistRepository,
  queueRepository,
  segmentsRepository,
  selectPrimaryQueue,
  statsRepository,
} from './repositories';
export type {
  CreateClipInput,
  ExampleSnapshot,
  PlaybackLocalStateRecord,
  PlaybackOutboxDrainResult,
  PlaybackOutboxReconcileResult,
  PlaybackOutboxEnqueueEvent,
  PlaybackOutboxResourceKind,
  MobileAuthRequestContext,
  MoveNowPlayingToHistoryTarget,
  PlaybackStatsTargets,
  UpdateClipInput,
} from './repositories';
export {
  eventKindEmitsRemovalTombstone,
  isPositionOnlyPlaybackEvent,
  PLAYBACK_OUTBOX_RESOURCE_KINDS,
  PLAYBACK_POSITION_ONLY_EVENT_KINDS,
  selectPlaybackOutboxEvictions,
  shouldCollapsePlaybackEvent,
  shouldCollapseQueueReorderEvent,
  shouldEnqueuePlaybackEvent,
  toReplayOccurredAtIso,
} from './repositories';

export {
  isWatermarkStale,
  readPlaybackClockOffsetMs,
  readSyncWatermark,
  readThrough,
  writeBehind,
  writePlaybackClockOffsetMs,
  writeSyncWatermark,
} from './sync';
export type { PlaybackClockOffsetSnapshot, ReadThroughOptions, WriteBehindOptions } from './sync';
