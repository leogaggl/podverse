import AsyncStorage from '@react-native-async-storage/async-storage';

import { isPlainObject } from '@podverse/helpers/guards';
import type { PlaybackEventKind } from '@podverse/helpers/playbackEvents';
import { isMeaningfulPlaybackEvent } from '@podverse/helpers/playbackEvents';

import { nativePlaybackBridge } from '../bridge/nativePlaybackBridge';
import type { PlaybackOutboxResourceKind } from '../data/repositories/playbackOutbox';
import { playbackOutboxRepository } from '../data/repositories/playbackOutboxRepository';
import type { LastPlaybackKind } from '../lib/playback/lastPlaybackStorage';
import { writeLastPlaybackSnapshot } from '../lib/playback/lastPlaybackStorage';

const JOURNAL_CURSOR_KEY = 'pv_mobile_playback_journal_cursor';

export type PlaybackJournalEntry = {
  seq: number;
  accountIdText: string | null;
  idText: string;
  kind: string;
  queueMedium: 'av' | 'music';
  positionSeconds: number;
  durationSeconds: number | null;
  eventKind: 'started' | 'progress' | 'paused' | 'completed' | 'skipped';
  origin: 'js' | 'car';
  occurredAtMs: number;
};

const toLastPlaybackKind = (kind: string): LastPlaybackKind | null => {
  if (kind === 'item' || kind === 'clip' || kind === 'item_soundbite') {
    return kind;
  }
  return null;
};

const toOutboxResourceKind = (kind: string): PlaybackOutboxResourceKind | null => {
  if (kind === 'item' || kind === 'clip' || kind === 'add_by_rss') {
    return kind;
  }
  if (kind === 'item_soundbite') {
    return 'soundbite';
  }
  return null;
};

const toPlaybackEventKind = (
  eventKind: PlaybackJournalEntry['eventKind']
): { eventKind: PlaybackEventKind; isPlaying: boolean; completed?: boolean } | null => {
  switch (eventKind) {
    case 'started':
      return { eventKind: 'play', isPlaying: true };
    case 'progress':
      return { eventKind: 'progress_tick', isPlaying: true };
    case 'paused':
      return { eventKind: 'pause', isPlaying: false };
    case 'completed':
      return { eventKind: 'complete', isPlaying: false, completed: true };
    case 'skipped':
      return { eventKind: 'skip', isPlaying: false };
    default:
      return null;
  }
};

const parseEntries = (raw: string | null): PlaybackJournalEntry[] => {
  if (raw === null || raw === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed) || !Array.isArray(parsed.entries)) {
      return [];
    }
    const out: PlaybackJournalEntry[] = [];
    for (const row of parsed.entries) {
      if (!isPlainObject(row)) {
        continue;
      }
      if (typeof row.seq !== 'number' || typeof row.idText !== 'string') {
        continue;
      }
      if (typeof row.positionSeconds !== 'number' || typeof row.occurredAtMs !== 'number') {
        continue;
      }
      const eventKind = row.eventKind;
      if (
        eventKind !== 'started' &&
        eventKind !== 'progress' &&
        eventKind !== 'paused' &&
        eventKind !== 'completed' &&
        eventKind !== 'skipped'
      ) {
        continue;
      }
      out.push({
        accountIdText: typeof row.accountIdText === 'string' ? row.accountIdText : null,
        durationSeconds: typeof row.durationSeconds === 'number' ? row.durationSeconds : null,
        eventKind,
        idText: row.idText,
        kind: typeof row.kind === 'string' ? row.kind : 'item',
        occurredAtMs: row.occurredAtMs,
        origin: row.origin === 'car' ? 'car' : 'js',
        positionSeconds: row.positionSeconds,
        queueMedium: row.queueMedium === 'music' ? 'music' : 'av',
        seq: row.seq,
      });
    }
    return out;
  } catch {
    return [];
  }
};

const readCursor = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_CURSOR_KEY);
    if (raw === null) {
      return 0;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeCursor = async (seq: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(JOURNAL_CURSOR_KEY, String(seq));
  } catch {
    // Best-effort.
  }
};

export type DrainPlaybackJournalParams = {
  accountIdText: string | null;
  /** Podcast queue id when signed in; podcast entries need it to reach the outbox. */
  avQueueIdText: string | null;
  /** Music queue id when signed in; Music entries need it to reach the outbox. */
  musicQueueIdText: string | null;
};

/**
 * Apply native car/engine journal entries into last-playback (signed out) and the playback outbox
 * (signed in, matching account). Idempotent via a seq cursor. Soft-fails entirely.
 */
export const drainPlaybackJournal = async (
  params: DrainPlaybackJournalParams
): Promise<{ drained: number }> => {
  let raw: string | null;
  try {
    raw = await nativePlaybackBridge.readPlaybackJournal();
  } catch {
    return { drained: 0 };
  }

  const entries = parseEntries(raw);
  if (entries.length === 0) {
    return { drained: 0 };
  }

  const cursor = await readCursor();
  const pending = entries.filter((entry) => entry.seq > cursor).sort((a, b) => a.seq - b.seq);
  if (pending.length === 0) {
    return { drained: 0 };
  }

  let maxSeq = cursor;
  let latestSnapshot: {
    idText: string;
    kind: LastPlaybackKind;
    positionSeconds: number;
    durationSeconds: number | null;
    occurredAtMs: number;
  } | null = null;

  for (const entry of pending) {
    maxSeq = Math.max(maxSeq, entry.seq);

    if (
      entry.accountIdText !== null &&
      params.accountIdText !== null &&
      entry.accountIdText !== params.accountIdText
    ) {
      continue;
    }

    const mapped = toPlaybackEventKind(entry.eventKind);
    if (mapped === null) {
      continue;
    }
    if (!isMeaningfulPlaybackEvent(mapped.eventKind, { isPlaying: mapped.isPlaying })) {
      continue;
    }

    const lastKind = toLastPlaybackKind(entry.kind);
    if (lastKind !== null) {
      if (latestSnapshot === null || entry.occurredAtMs >= latestSnapshot.occurredAtMs) {
        latestSnapshot = {
          durationSeconds: entry.durationSeconds,
          idText: entry.idText,
          kind: lastKind,
          occurredAtMs: entry.occurredAtMs,
          positionSeconds: entry.positionSeconds,
        };
      }
    }

    const queueIdText =
      entry.queueMedium === 'music' ? params.musicQueueIdText : params.avQueueIdText;
    if (
      params.accountIdText !== null &&
      queueIdText !== null &&
      (entry.accountIdText === null || entry.accountIdText === params.accountIdText)
    ) {
      const resourceKind = toOutboxResourceKind(entry.kind);
      if (resourceKind !== null) {
        try {
          await playbackOutboxRepository.enqueue({
            accountIdText: params.accountIdText,
            completed: mapped.completed,
            eventKind: mapped.eventKind,
            isPlaying: mapped.isPlaying,
            mediaFileDuration: entry.durationSeconds,
            occurredAt: entry.occurredAtMs,
            playbackPosition: entry.positionSeconds,
            queueIdText,
            resourceIdText: entry.idText,
            resourceKind,
          });
        } catch {
          // Soft-fail per entry; cursor still advances so a poison row cannot block forever.
        }
      }
    }
  }

  if (latestSnapshot !== null && params.accountIdText === null) {
    await writeLastPlaybackSnapshot({
      id_text: latestSnapshot.idText,
      kind: latestSnapshot.kind,
      playback_position_seconds: latestSnapshot.positionSeconds,
      updated_at: new Date(latestSnapshot.occurredAtMs).toISOString(),
      v: 1,
      ...(latestSnapshot.durationSeconds !== null
        ? { media_file_duration_seconds: latestSnapshot.durationSeconds }
        : {}),
    });
  }

  await writeCursor(maxSeq);
  return { drained: pending.length };
};
