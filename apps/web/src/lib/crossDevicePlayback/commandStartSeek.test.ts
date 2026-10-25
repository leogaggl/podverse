import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DTOPlaybackResourceRef } from '@podverse/helpers';

import {
  applyCommandSeekToLoadedFile,
  clearCommandStartSeek,
  COMMAND_START_SEEK_MAX_AGE_MS,
  stageCommandStartSeek,
  takeCommandStartSeek,
} from './commandStartSeek';

function itemRef(itemIdText: string): DTOPlaybackResourceRef {
  return { kind: 'item', item_id_text: itemIdText };
}

afterEach(() => {
  clearCommandStartSeek();
});

describe('takeCommandStartSeek', () => {
  it('clamps a position at or past the file end to 5 seconds before the end, once', () => {
    const ref = itemRef('item-1');
    stageCommandStartSeek({ ref, seconds: 700, nowMs: 1_000 });

    expect(takeCommandStartSeek({ ref, fileDurationSeconds: 600, nowMs: 1_001 })).toBe(595);
    expect(takeCommandStartSeek({ ref, fileDurationSeconds: 600, nowMs: 1_002 })).toBeNull();
  });

  it('keeps a position inside the file, including the last 5 seconds', () => {
    const ref = itemRef('item-1');
    stageCommandStartSeek({ ref, seconds: 120, nowMs: 1_000 });
    expect(takeCommandStartSeek({ ref, fileDurationSeconds: 600, nowMs: 1_001 })).toBe(120);

    stageCommandStartSeek({ ref, seconds: 597, nowMs: 2_000 });
    expect(takeCommandStartSeek({ ref, fileDurationSeconds: 600, nowMs: 2_001 })).toBe(597);
  });

  it('keeps the position when the file reports no duration', () => {
    const ref = itemRef('item-1');
    stageCommandStartSeek({ ref, seconds: 700, nowMs: 1_000 });

    expect(takeCommandStartSeek({ ref, fileDurationSeconds: Number.NaN, nowMs: 1_001 })).toBe(700);
  });

  it('leaves a stage in place when metadata arrives for a different resource', () => {
    const stagedRef = itemRef('item-1');
    const otherRef = itemRef('item-2');
    stageCommandStartSeek({ ref: stagedRef, seconds: 120, nowMs: 1_000 });

    expect(
      takeCommandStartSeek({ ref: otherRef, fileDurationSeconds: 600, nowMs: 1_001 })
    ).toBeNull();
    expect(takeCommandStartSeek({ ref: stagedRef, fileDurationSeconds: 600, nowMs: 1_002 })).toBe(
      120
    );
  });

  it('drops a stage older than 30 seconds', () => {
    const ref = itemRef('item-1');
    const stagedAtMs = 5_000;
    stageCommandStartSeek({ ref, seconds: 120, nowMs: stagedAtMs });

    expect(
      takeCommandStartSeek({
        ref,
        fileDurationSeconds: 600,
        nowMs: stagedAtMs + COMMAND_START_SEEK_MAX_AGE_MS + 1,
      })
    ).toBeNull();
  });
});

describe('applyCommandSeekToLoadedFile', () => {
  it('clamps and seeks when the loaded file reports a duration', () => {
    const seek = vi.fn();
    const setMPCurrentTime = vi.fn();

    applyCommandSeekToLoadedFile({
      seconds: 650,
      ref: itemRef('item-1'),
      controls: { seek, readDurationSeconds: () => 600 },
      setMPCurrentTime,
      nowMs: 1_000,
    });

    expect(seek).toHaveBeenCalledWith(595);
    expect(setMPCurrentTime).toHaveBeenCalledWith(595);
  });

  it('seeks the raw position when the file reports no finite duration', () => {
    const seek = vi.fn();
    const setMPCurrentTime = vi.fn();

    applyCommandSeekToLoadedFile({
      seconds: 650,
      ref: itemRef('item-1'),
      controls: { seek, readDurationSeconds: () => null },
      setMPCurrentTime,
      nowMs: 1_000,
    });

    expect(seek).toHaveBeenCalledWith(650);
    expect(setMPCurrentTime).toHaveBeenCalledWith(650);
  });

  it('stages the position until metadata arrives when the duration is not loaded yet', () => {
    const seek = vi.fn();
    const setMPCurrentTime = vi.fn();
    const ref = itemRef('item-1');
    const nowMs = 1_000;

    applyCommandSeekToLoadedFile({
      seconds: 650,
      ref,
      controls: { seek, readDurationSeconds: () => undefined },
      setMPCurrentTime,
      nowMs,
    });

    expect(seek).not.toHaveBeenCalled();
    expect(setMPCurrentTime).toHaveBeenCalledWith(650);
    expect(takeCommandStartSeek({ ref, fileDurationSeconds: 600, nowMs: nowMs + 1 })).toBe(595);
  });

  it('does nothing when no resource is loaded', () => {
    const seek = vi.fn();
    const setMPCurrentTime = vi.fn();

    applyCommandSeekToLoadedFile({
      seconds: 650,
      ref: null,
      controls: { seek, readDurationSeconds: () => 600 },
      setMPCurrentTime,
      nowMs: 1_000,
    });

    expect(seek).not.toHaveBeenCalled();
    expect(setMPCurrentTime).not.toHaveBeenCalled();
  });
});
