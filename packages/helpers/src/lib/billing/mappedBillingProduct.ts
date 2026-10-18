/**
 * Whether this deployment has a `billing_processor_product` row for the store ids. Callers that
 * can see the database supply the lookup. An inactive row still counts, so a refund for a retired
 * product still applies.
 */
export type IsMappedBillingProduct = (
  processorId: string,
  externalProductId: string,
  externalBasePlanId: string | null
) => Promise<boolean>;
