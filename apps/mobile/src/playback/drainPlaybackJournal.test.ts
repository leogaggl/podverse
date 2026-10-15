import { beforeEach, describe, expect, it, vi } from 'vitest';

const readPlaybackJournal = vi.fn();
const writePlaybackJournal = vi.fn();
const enqueue = vi.fn();
const writeLastPlaybackSnapshot = vi.fn();

vi.mock('../bridge/nativePlaybackBridge', () => ({
  nativePlaybackBridge: {
    readPlaybackJournal: () => readPlaybackJournal(),
    writePlaybackJournal: (payload: string) => writePlaybackJournal(payload),
  },
}));

vi.mock('../data/repositories/playbackOutboxRepository', () => ({
  playbackOutboxRepository: {
    enqueue: (row: unknown) => enqueue(row),
  },
}));

vi.mock('../lib/playback/lastPlaybackStorage', () => ({
  writeLastPlaybackSnapshot: (snapshot: unknown) => writeLastPlaybackSnapshot(snapshot),
}));

const asyncStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => asyncStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      asyncStore.set(key, value);
    },
  },
}));

describe('drainPlaybackJournal', () => {
  beforeEach(() => {
    asyncStore.clear();
    readPlaybackJournal.mockReset();
    writePlaybackJournal.mockReset();
    enqueue.mockReset();
    writeLastPlaybackSnapshot.mockReset();
  });

  it('is idempotent across two drains with the same journal', async () => {
    const { drainPlaybackJournal } = await import('./drainPlaybackJournal');
    const journal = JSON.stringify({
      schemaVersion: 2,
      updatedAtMs: 1,
      entries: [
        {
          seq: 1,
          accountIdText: null,
          idText: 'ep1',
          kind: 'item',
          queueMedium: 'av',
          positionSeconds: 12,
          durationSeconds: 100,
          eventKind: 'progress',
          origin: 'car',
          occurredAtMs: 1000,
        },
      ],
    });
    readPlaybackJournal.mockResolvedValue(journal);

    const first = await drainPlaybackJournal({ accountIdText: null, queueIdText: null });
    const second = await drainPlaybackJournal({ accountIdText: null, queueIdText: null });

    expect(first.drained).toBe(1);
    expect(second.drained).toBe(0);
    expect(writeLastPlaybackSnapshot).toHaveBeenCalledTimes(1);
  });
});
