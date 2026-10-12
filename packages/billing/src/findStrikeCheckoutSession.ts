import type { StrikeCheckoutSessionRecord } from '@podverse/external-services-strike';
import { BillingCheckoutSessionService, BillingProcessorProductService } from '@podverse/orm';

/** The checkout session a Strike payment settles against, or null when this server never created it. */
export async function findStrikeCheckoutSession(
  externalId: string
): Promise<StrikeCheckoutSessionRecord | null> {
  const session = await new BillingCheckoutSessionService().findByExternalId('strike', externalId);
  if (session === null) {
    return null;
  }
  const product = await new BillingProcessorProductService().getById(
    session.billing_processor_product_id
  );
  if (product === null) {
    return null;
  }
  return {
    accountId: session.account_id,
    externalProductId: product.external_product_id,
    amount: session.amount,
    currencyCode: session.currency_code.trim(),
  };
}
