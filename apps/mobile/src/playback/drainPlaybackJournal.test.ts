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

    const signedOut = { accountIdText: null, avQueueIdText: null, musicQueueIdText: null };
    const first = await drainPlaybackJournal(signedOut);
    const second = await drainPlaybackJournal(signedOut);

    expect(first.drained).toBe(1);
    expect(second.drained).toBe(0);
    expect(writeLastPlaybackSnapshot).toHaveBeenCalledTimes(1);
  });

  it('routes signed-in entries to the queue for their medium', async () => {
    const { drainPlaybackJournal } = await import('./drainPlaybackJournal');
    const entry = {
      accountIdText: 'acct1',
      durationSeconds: 200,
      eventKind: 'progress',
      kind: 'item',
      occurredAtMs: 1000,
      origin: 'car',
      positionSeconds: 30,
    };
    readPlaybackJournal.mockResolvedValue(
      JSON.stringify({
        schemaVersion: 2,
        updatedAtMs: 1,
        entries: [
          { ...entry, seq: 1, idText: 'episode1', queueMedium: 'av' },
          { ...entry, seq: 2, idText: 'track1', queueMedium: 'music' },
        ],
      })
    );

    await drainPlaybackJournal({
      accountIdText: 'acct1',
      avQueueIdText: 'queueAv',
      musicQueueIdText: 'queueMusic',
    });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ queueIdText: 'queueAv', resourceIdText: 'episode1' })
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ queueIdText: 'queueMusic', resourceIdText: 'track1' })
    );
    expect(writeLastPlaybackSnapshot).not.toHaveBeenCalled();
  });
});
