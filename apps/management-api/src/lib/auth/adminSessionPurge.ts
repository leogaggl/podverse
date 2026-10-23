import { subtractDays } from '@podverse/helpers';

/** Days an admin_session row is kept after its idle expiry when the env var is blank or unset. */
export const DEFAULT_ADMIN_SESSION_RETENTION_DAYS = 30;

/**
 * Blank or unset uses the default. A present value is parsed as an integer and left as NaN when
 * it is not a number, so startup validation can reject it.
 */
export function resolveAdminSessionRetentionDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_ADMIN_SESSION_RETENTION_DAYS;
  }
  return Number.parseInt(raw, 10);
}

/**
 * Deletes admin_session rows whose idle expiry is older than the retention window.
 * A revoked row keeps its idle expiry. A re-run removes whatever is left.
 */
export async function adminSessionPurge(): Promise<number> {
  const { loggerService } = await import('@management-api/factories/loggerService.js');
  const { deleteAdminSessionsIdleExpiredBefore } =
    await import('@management-api/orm/services/adminSession.js');

  const retentionDays = resolveAdminSessionRetentionDays(process.env.ADMIN_SESSION_RETENTION_DAYS);
  const retentionCutoff = subtractDays(new Date(), retentionDays);

  loggerService.info(
    `adminSessionPurge starting with retention_days=${retentionDays} ` +
      `retention_cutoff=${retentionCutoff.toISOString()}`
  );

  const rowsDeleted = await deleteAdminSessionsIdleExpiredBefore(retentionCutoff);

  loggerService.info(`adminSessionPurge completed rows_deleted=${rowsDeleted}`);
  return rowsDeleted;
}
