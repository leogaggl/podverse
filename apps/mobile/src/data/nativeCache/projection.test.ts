import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NativeCacheQueueEntry } from './projection';
import {
  buildAccountContextPayload,
  buildDownloadsIndexPayload,
  buildHistoryIndexPayload,
  buildLibraryBrowseIndexPayload,
  buildLibraryChildrenPayload,
  buildLiveIndexPayload,
  buildQueueSnapshotPayload,
  NATIVE_CACHE_SCHEMA_VERSION,
  projectAdvanceWindowToNativeCache,
  projectQueueSnapshotAvToNativeCache,
  projectQueueSnapshotToNativeCache,
} from './projection';

// Vitest hoists this above the imports. Payload builders do not call the bridge. Queue writes
// resolve through these spies.
const nativeCacheWriters = vi.hoisted(() => ({
  writeAccountContext: vi.fn().mockResolvedValue(undefined),
  writeAdvanceWindow: vi.fn().mockResolvedValue(undefined),
  writeDownloadsIndex: vi.fn().mockResolvedValue(undefined),
  writeHistoryIndex: vi.fn().mockResolvedValue(undefined),
  writeLibraryBrowseIndex: vi.fn().mockResolvedValue(undefined),
  writeLibraryChildren: vi.fn().mockResolvedValue(undefined),
  writeLiveIndex: vi.fn().mockResolvedValue(undefined),
  writeQueueSnapshotAv: vi.fn().mockResolvedValue(undefined),
  writeQueueSnapshotMusic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../bridge/nativePlaybackBridge', () => ({
  nativePlaybackBridge: nativeCacheWriters,
}));

describe('native cache projection envelopes', () => {
  it('stamps schema version 2 on queue snapshots', () => {
    const payload = buildQueueSnapshotPayload({
      nowPlayingIdText: 'ep1',
      entries: [
        {
          idText: 'ep1',
          title: 'Episode',
          artworkUrl: null,
          mediaUrl: 'https://example.com/a.mp3',
        },
      ],
      mediumBucket: 'av',
    });
    expect(payload.schemaVersion).toBe(NATIVE_CACHE_SCHEMA_VERSION);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.entries[0]?.mediaUrl).toBe('https://example.com/a.mp3');
  });

  it('keeps an artist on a queue snapshot at schema version 2', () => {
    const payload = buildQueueSnapshotPayload({
      nowPlayingIdText: 'ep1',
      entries: [
        {
          idText: 'ep1',
          title: 'Episode',
          artworkUrl: null,
          mediaUrl: 'https://example.com/a.mp3',
          artist: 'E2E Music Artist',
        },
      ],
      mediumBucket: 'av',
    });
    expect(payload.schemaVersion).toBe(NATIVE_CACHE_SCHEMA_VERSION);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.entries[0]?.artist).toBe('E2E Music Artist');
  });

  it('includes relative download file names', () => {
    const payload = buildDownloadsIndexPayload({
      entries: [
        {
          idText: 'ep1',
          title: 'Episode',
          filePath: 'downloads/ep1.mp3',
          artworkUrl: 'https://example.com/art.jpg',
          channelTitle: 'Show',
          artist: 'E2E Music Artist',
        },
      ],
    });
    expect(payload.entries[0]?.filePath).toBe('downloads/ep1.mp3');
    expect(payload.entries[0]?.artist).toBe('E2E Music Artist');
    expect(payload.schemaVersion).toBe(2);
  });

  it('builds library children and history / live envelopes', () => {
    const children = buildLibraryChildrenPayload({
      channelIdText: 'ch1',
      mediumBucket: 'av',
      items: [
        {
          idText: 'ep1',
          title: 'Episode',
          mediaUrl: 'https://example.com/a.mp3',
          artist: 'E2E Music Artist',
        },
      ],
    });
    expect(children.channelIdText).toBe('ch1');
    expect(children.items[0]?.artist).toBe('E2E Music Artist');
    expect(buildHistoryIndexPayload({ entries: [] }).schemaVersion).toBe(2);
    expect(buildLiveIndexPayload({ entries: [] }).schemaVersion).toBe(2);
    expect(
      buildLibraryBrowseIndexPayload({
        nodes: [
          {
            idText: 'ch1',
            title: 'Show',
            kind: 'podcast',
            mediumBucket: 'av',
          },
        ],
      }).nodes[0]?.mediumBucket
    ).toBe('av');
    expect(buildAccountContextPayload({ signedIn: true, accountIdText: 'acc1' }).signedIn).toBe(
      true
    );
  });
});

describe('native cache queue snapshot writes', () => {
  const emptyQueue = {
    nowPlayingIdText: null,
    entries: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls writeQueueSnapshotAv once when mediumBucket is omitted', async () => {
    await projectQueueSnapshotToNativeCache(emptyQueue);

    expect(nativeCacheWriters.writeQueueSnapshotAv).toHaveBeenCalledTimes(1);
    expect(nativeCacheWriters.writeQueueSnapshotMusic).not.toHaveBeenCalled();
  });

  it('calls writeQueueSnapshotMusic once and never calls writeQueueSnapshotAv for music', async () => {
    await projectQueueSnapshotToNativeCache({ ...emptyQueue, mediumBucket: 'music' });

    expect(nativeCacheWriters.writeQueueSnapshotMusic).toHaveBeenCalledTimes(1);
    expect(nativeCacheWriters.writeQueueSnapshotAv).not.toHaveBeenCalled();
  });

  it('calls writeQueueSnapshotAv once', async () => {
    await projectQueueSnapshotAvToNativeCache(emptyQueue);

    expect(nativeCacheWriters.writeQueueSnapshotAv).toHaveBeenCalledTimes(1);
    expect(nativeCacheWriters.writeQueueSnapshotMusic).not.toHaveBeenCalled();
  });
});

describe('native cache advance window write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls writeAdvanceWindow once with the anchor and entries at schema version 2', async () => {
    const entry: NativeCacheQueueEntry = {
      idText: 'clip-1',
      title: 'Clip',
      artworkUrl: null,
      mediaUrl: 'https://example.com/a.mp3',
      kind: 'clip',
      startPositionSeconds: 10,
      clipStartSeconds: 10,
      clipEndSeconds: 20,
      downloadFileName: null,
    };
    await projectAdvanceWindowToNativeCache({
      mediumBucket: 'music',
      anchorIdText: 'ep-1',
      anchorKind: 'item',
      entries: [entry],
    });

    expect(nativeCacheWriters.writeAdvanceWindow).toHaveBeenCalledTimes(1);
    const [payloadJson] = nativeCacheWriters.writeAdvanceWindow.mock.calls[0] ?? [];
    expect(JSON.parse(String(payloadJson))).toMatchObject({
      schemaVersion: 2,
      mediumBucket: 'music',
      anchorIdText: 'ep-1',
      anchorKind: 'item',
      entries: [entry],
    });
  });
});
