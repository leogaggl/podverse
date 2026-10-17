import type { BillingAccountIdentity } from './ledgerStore.js';

/**
 * Store review and staff testing use sandbox purchases against production. Outside production any
 * sandbox purchase counts. In production, every sandbox purchase counts when
 * `BILLING_SANDBOX_GRANT_ALL` is true; otherwise only the accounts in
 * `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS` get access from one. Live purchases always count.
 * Adapters only report `isSandbox`, so this is the one place the rule is enforced.
 */
export interface BillingSandboxPolicy {
  isProduction: boolean;
  /** Account ids or `id_text` values. Used when `grantAllSandboxPurchases` is false. */
  allowedAccountIds: ReadonlySet<string>;
  /** `BILLING_SANDBOX_GRANT_ALL`. Every sandbox purchase grants while `NODE_ENV` is production. */
  grantAllSandboxPurchases: boolean;
}

/** Parses the comma-separated `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS` value. */
export function parseSandboxAllowedAccountIds(value: string | undefined): Set<string> {
  if (value === undefined) {
    return new Set();
  }
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
  );
}

export function isSandboxPurchaseAllowed(
  policy: BillingSandboxPolicy,
  account: BillingAccountIdentity
): boolean {
  if (!policy.isProduction || policy.grantAllSandboxPurchases) {
    return true;
  }
  return (
    policy.allowedAccountIds.has(String(account.id)) || policy.allowedAccountIds.has(account.idText)
  );
}
