import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';
import { getBillingContext } from '@workers/lib/billing/billingContext.js';
import { reconcileBilling } from '@workers/lib/billing/reconcileBilling.js';

import {
  BillingCheckoutSessionService,
  BillingTransactionService,
  BillingWebhookEventService,
} from '@podverse/orm';

/**
 * Retries failed inbox rows, applies Google Play voids the webhook missed, and rechecks
 * unsettled Strike checkouts. This command never charges a payment method.
 */
export const billingReconcile = async (_args: CommandLineArgs) => {
  const logger = getLogger();
  const { processor, googlePlayClient, registry } = getBillingContext();
  const transactionService = new BillingTransactionService();
  const webhookEventService = new BillingWebhookEventService();
  const checkoutSessionService = new BillingCheckoutSessionService();

  logger.info('Reconciling billing with payment processors');
  const summary = await reconcileBilling({
    processor,
    googlePlayClient,
    listRetryableInboxEvents: (params) => webhookEventService.listRetryableFailed(params),
    findRecordedGooglePlayPurchase: async (externalTransactionId) => {
      const recorded = await transactionService.getByExternalId(
        'google_play',
        externalTransactionId
      );
      return recorded === null ? null : { isSandbox: recorded.is_sandbox };
    },
    strikeAdapter: registry.get('strike'),
    listUnsettledStrikeSessions: async (params) => {
      const rows = await checkoutSessionService.listUnsettledSince(
        'strike',
        params.since,
        params.limit
      );
      return rows.map((row) => ({
        accountId: row.account_id,
        externalId: row.external_id,
        expiresAt: new Date(row.expires_at),
      }));
    },
    logger,
    now: new Date(),
  });

  logger.info('Reconciled billing with payment processors', {
    inbox: summary.inbox,
    googlePlayVoids: summary.googlePlayVoids,
    strike: summary.strike,
  });

  if (summary.stepErrors.length > 0) {
    throw new Error(`Billing reconcile steps stopped early: ${summary.stepErrors.join('; ')}`);
  }
};
