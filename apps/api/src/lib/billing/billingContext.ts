import type { TestPaymentProcessorAdapter } from '@podverse/billing';
import {
  BillingAdapterRegistry,
  BillingEventProcessor,
  createOrmBillingLedgerStore,
  parseSandboxAllowedAccountIds,
} from '@podverse/billing';
import type { PayPalService } from '@podverse/external-services-paypal';
import type { StrikeAdapter, StrikeClient } from '@podverse/external-services-strike';

import type { BillingAdaptersConfig } from './registerBillingAdapters.js';
import { registerBillingAdapters } from './registerBillingAdapters.js';

export interface BillingContextConfig extends BillingAdaptersConfig {
  /** Raw `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS`. */
  sandboxAllowedAccountIds: string | undefined;
  /** `BILLING_SANDBOX_GRANT_ALL`. Every sandbox purchase grants while `NODE_ENV` is production. */
  grantAllSandboxPurchases: boolean;
}

export interface BillingContext {
  registry: BillingAdapterRegistry;
  processor: BillingEventProcessor;
  paypalService: PayPalService | null;
  strikeAdapter: StrikeAdapter | null;
  strikeClient: StrikeClient | null;
  testAdapter: TestPaymentProcessorAdapter | null;
}

let billingContext: BillingContext | null = null;

/** Builds the adapters and the event processor once at startup; calling again replaces them. */
export function initBillingContext(config: BillingContextConfig): BillingContext {
  const registry = new BillingAdapterRegistry();
  const { paypalService, strikeAdapter, strikeClient, testAdapter } = registerBillingAdapters(
    registry,
    config
  );
  const processor = new BillingEventProcessor({
    store: createOrmBillingLedgerStore(),
    sandboxPolicy: {
      isProduction: config.nodeEnv === 'production',
      allowedAccountIds: parseSandboxAllowedAccountIds(config.sandboxAllowedAccountIds),
      grantAllSandboxPurchases: config.grantAllSandboxPurchases,
    },
  });
  billingContext = { registry, processor, paypalService, strikeAdapter, strikeClient, testAdapter };
  return billingContext;
}

export function getBillingContext(): BillingContext {
  if (billingContext === null) {
    throw new Error('Billing context not initialized; call initBillingContext from startApp first');
  }
  return billingContext;
}
