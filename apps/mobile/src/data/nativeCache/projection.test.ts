import { describe, expect, it, vi } from 'vitest';

import {
  buildAccountContextPayload,
  buildDownloadsIndexPayload,
  buildHistoryIndexPayload,
  buildLibraryBrowseIndexPayload,
  buildLibraryChildrenPayload,
  buildLiveIndexPayload,
  buildQueueSnapshotPayload,
  NATIVE_CACHE_SCHEMA_VERSION,
} from './projection';

// Vitest hoists this above the imports. The payload builders are pure; only the write path
// reaches the native module, which needs Expo.
vi.mock('../../bridge/nativePlaybackBridge', () => ({ nativePlaybackBridge: {} }));

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
