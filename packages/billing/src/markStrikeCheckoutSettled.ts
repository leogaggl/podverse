import type { NormalizedBillingEvent } from '@podverse/helpers';
import { BillingCheckoutSessionService } from '@podverse/orm';

/**
 * A settled Strike payment closes the checkout session that created the receive request.
 * Polling, the webhook, and reconciliation all ingest through the same processor, so the
 * session is marked here once the grant is on the ledger.
 */
export async function markStrikeCheckoutSettled(event: NormalizedBillingEvent): Promise<void> {
  if (event.processor !== 'strike' || event.type !== 'payment_settled') {
    return;
  }
  const sessions = new BillingCheckoutSessionService();
  const session = await sessions.findByExternalId('strike', event.externalTransactionId);
  if (session === null || session.settled_at !== null) {
    return;
  }
  const settledAt = new Date(event.occurredAt);
  await sessions.markSettled(
    session.id,
    Number.isNaN(settledAt.getTime()) ? new Date() : settledAt
  );
}
