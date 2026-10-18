import type { IsMappedBillingProduct } from '@podverse/helpers';
import { BillingProcessorProductService } from '@podverse/orm';

/**
 * A store id is mapped when `billing_processor_product` has a row for it. Inactive rows count,
 * so a refund for a product an admin turned off still applies. The row is the only source; env
 * does not name store product ids.
 */
export const isMappedBillingProduct: IsMappedBillingProduct = async (
  processorId,
  externalProductId,
  externalBasePlanId
) => {
  if (externalProductId.trim() === '') {
    return false;
  }
  const row = await new BillingProcessorProductService().getByExternalIds(
    processorId,
    externalProductId,
    externalBasePlanId
  );
  return row !== null;
};
