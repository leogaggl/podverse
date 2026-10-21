import { isFeedContentApiPath } from './feedContentApiPathPrefixes.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isArchivedShowGone = (body: Record<string, unknown>): boolean => {
  const gone = body.gone;
  return isRecord(gone) && gone.reason === 'archived';
};

const isMergedInto = (body: Record<string, unknown>): boolean => {
  const merged = body.merged_into;
  return (
    isRecord(merged) &&
    (merged.kind === 'channel' || merged.kind === 'item') &&
    typeof merged.id_text === 'string' &&
    merged.id_text.length > 0
  );
};

/**
 * A directory show that left the catalog answers 410: archived, or merged into another
 * channel or item. Clients drop or remap the follow. Those responses are expected.
 */
export function skipApiRequestErrorLogForDirectoryChannelGone(
  errorInfo: { status?: number; responseData?: unknown },
  requestPath: string
): boolean {
  if (errorInfo.status !== 410 || !isFeedContentApiPath(requestPath)) {
    return false;
  }
  const body = errorInfo.responseData;
  if (!isRecord(body)) {
    return false;
  }
  return isArchivedShowGone(body) || isMergedInto(body);
}
