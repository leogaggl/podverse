import { convertFile, TimestampFormatter } from 'transcriptator';

import type { TranscriptRow } from '../../dtos/item/itemTranscript.js';
import { formatHHMMSS } from '../time.js';

/**
 * Parses a transcript file string (JSON, VTT, SRT, or HTML) into speaker rows.
 * Blank a repeated speaker so consecutive lines from the same person read as a run.
 */
export function parseTranscriptRows(data: string): TranscriptRow[] {
  TimestampFormatter.registerCustomFormatter(formatHHMMSS);
  const parsedTranscript = convertFile(data);

  let previousSpeaker = '';
  for (const row of parsedTranscript) {
    if (row?.speaker && previousSpeaker === row.speaker) {
      row.speaker = '';
    } else if (row?.speaker) {
      previousSpeaker = row.speaker;
    }
  }

  return parsedTranscript;
}

/** Parses a transcript string, or returns [] when empty or unparseable. */
export function parseTranscriptRowsOrEmpty(data: string | null | undefined): TranscriptRow[] {
  if (data === null || data === undefined || data.trim().length === 0) {
    return [];
  }
  try {
    return parseTranscriptRows(data);
  } catch {
    return [];
  }
}
