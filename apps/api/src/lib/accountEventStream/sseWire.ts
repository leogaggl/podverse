/**
 * Server-sent events wire format. `JSON.stringify` never emits a raw newline, so every event fits
 * on one `data:` line.
 */
export function formatSseEvent(params: { event: string; data: unknown; id?: number }): string {
  const idLine = params.id === undefined ? '' : `id: ${params.id}\n`;
  return `${idLine}event: ${params.event}\ndata: ${JSON.stringify(params.data)}\n\n`;
}

export function formatSseComment(text: string): string {
  return `: ${text}\n\n`;
}

/** Sets how long the browser waits before it reconnects a dropped stream. */
export function formatSseRetry(ms: number): string {
  return `retry: ${ms}\n\n`;
}

/** A positive safe integer, or null for anything else, which means no replay. */
export function parseSseLastEventId(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
