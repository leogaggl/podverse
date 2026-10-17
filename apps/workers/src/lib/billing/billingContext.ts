import type { ConfiguredBillingAdapters } from '@podverse/billing';
import {
  BillingAdapterRegistry,
  BillingEventProcessor,
  createOrmBillingLedgerStore,
  parseSandboxAllowedAccountIds,
  registerConfiguredBillingAdapters,
} from '@podverse/billing';
import type { GooglePlayClient } from '@podverse/external-services-google-play';
import type { StrikeClient } from '@podverse/external-services-strike';

export interface BillingContextConfig extends ConfiguredBillingAdapters {
  /** Raw `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS`. */
  sandboxAllowedAccountIds: string | undefined;
  /** `BILLING_SANDBOX_GRANT_ALL`. Every sandbox purchase grants while `NODE_ENV` is production. */
  grantAllSandboxPurchases: boolean;
}

export interface BillingContext {
  registry: BillingAdapterRegistry;
  processor: BillingEventProcessor;
  googlePlayClient: GooglePlayClient | null;
  strikeClient: StrikeClient | null;
}

let billingContext: BillingContext | null = null;

/**
 * Builds the adapters and the event processor for a Billing-category command. Needs the ORM
 * context, because the ledger store opens its services on creation.
 */
export function initBillingContext(config: BillingContextConfig): BillingContext {
  const registry = new BillingAdapterRegistry();
  const { googlePlayClient, strikeClient } = registerConfiguredBillingAdapters(registry, config);
  const processor = new BillingEventProcessor({
    store: createOrmBillingLedgerStore(),
    sandboxPolicy: {
      isProduction: config.nodeEnv === 'production',
      allowedAccountIds: parseSandboxAllowedAccountIds(config.sandboxAllowedAccountIds),
      grantAllSandboxPurchases: config.grantAllSandboxPurchases,
    },
  });
  billingContext = { registry, processor, googlePlayClient, strikeClient };
  return billingContext;
}

export function getBillingContext(): BillingContext {
  if (billingContext === null) {
    throw new Error(
      'Billing context not initialized; the command needs the Billing startup category'
    );
  }
  return billingContext;
}
