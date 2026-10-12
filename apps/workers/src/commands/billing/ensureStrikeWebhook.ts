import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';
import { getBillingContext } from '@workers/lib/billing/billingContext.js';

/** Billing routes are mounted at this prefix. The public base URL has no path of its own. */
const STRIKE_WEBHOOK_PATH = '/api/v2/billing/webhooks/strike';
const STRIKE_WEBHOOK_EVENT = 'receive-request.receive-completed';

function requireTrimmedEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (value === '') {
    throw new Error(`${name} is required`);
  }
  return value;
}

/**
 * Creates or updates the Strike subscription that delivers completed receives to this server.
 * Logs the subscription id. The webhook secret stays in the request body and out of the log.
 */
export const billingStrikeEnsureWebhook = async (_args: CommandLineArgs) => {
  const logger = getLogger();
  const { strikeClient } = getBillingContext();
  if (strikeClient === null) {
    throw new Error('Strike is not enabled');
  }

  const publicBase = requireTrimmedEnv('BILLING_WEBHOOK_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const webhookUrl = `${publicBase}${STRIKE_WEBHOOK_PATH}`;
  const secret = requireTrimmedEnv('STRIKE_WEBHOOK_SECRET');
  const subscriptionBody = {
    enabled: true,
    eventTypes: [STRIKE_WEBHOOK_EVENT],
    secret,
    webhookUrl,
    webhookVersion: 'v1' as const,
  };

  const existing = (await strikeClient.listSubscriptions()).find(
    (subscription) => subscription.webhookUrl === webhookUrl
  );
  const subscription =
    existing === undefined
      ? await strikeClient.createSubscription(subscriptionBody)
      : await strikeClient.updateSubscription(existing.id, subscriptionBody);

  logger.info(`Strike webhook subscription ${subscription.id} is ready`, { webhookUrl });
};
