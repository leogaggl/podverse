import { QueryFailedError } from 'typeorm';

/** PostgreSQL `unique_violation` (SQLSTATE 23505). */
export const PG_UNIQUE_VIOLATION = '23505' as const;

/**
 * True when the error is a unique-constraint failure from PostgreSQL, including
 * when the code is only present on the driver error object.
 */
export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const qe = error as QueryFailedError & { code?: string; driverError?: { code?: string } };
  return qe.code === PG_UNIQUE_VIOLATION || qe.driverError?.code === PG_UNIQUE_VIOLATION;
}

/** Unique violation on `channel.podcast_guid`, including the partial unique index. */
export function isPodcastGuidUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError) || !isPostgresUniqueViolation(error)) {
    return false;
  }
  return uniqueViolationText(error).includes('podcast_guid');
}

function uniqueViolationText(error: QueryFailedError): string {
  const chunks = [error.message];
  const driver = error.driverError;
  if (typeof driver === 'object' && driver !== null) {
    for (const key of ['constraint', 'detail', 'message']) {
      const value = Reflect.get(driver, key);
      if (typeof value === 'string') {
        chunks.push(value);
      }
    }
  }
  return chunks.join('\n');
}
