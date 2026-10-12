/** PayPal invoice ids are unique per merchant and at most this many characters. */
const PAYPAL_INVOICE_ID_MAX_LENGTH = 127;

/**
 * Separates the sold product id from the per-order suffix. Product ids do not contain this
 * character, so the longest matching prefix is unambiguous.
 */
const PAYPAL_INVOICE_PRODUCT_SEPARATOR = '-';

export function buildPayPalInvoiceId(productId: string, uniqueSuffix: string): string {
  const invoiceId = `${productId}${PAYPAL_INVOICE_PRODUCT_SEPARATOR}${uniqueSuffix}`;
  if (invoiceId.length > PAYPAL_INVOICE_ID_MAX_LENGTH) {
    throw new Error(`PayPal invoice id exceeds ${PAYPAL_INVOICE_ID_MAX_LENGTH} characters`);
  }
  return invoiceId;
}

/**
 * A bare product id and a product id plus a per-order suffix both identify that product.
 * The longest matching id wins when one product id prefixes another.
 */
export function resolvePayPalProductId(
  invoiceId: string | null,
  productIds: readonly string[]
): string | null {
  if (invoiceId === null || invoiceId === '') {
    return null;
  }

  let match: string | null = null;
  for (const productId of productIds) {
    if (productId.length === 0) {
      continue;
    }
    const isProduct =
      invoiceId === productId ||
      invoiceId.startsWith(`${productId}${PAYPAL_INVOICE_PRODUCT_SEPARATOR}`);
    if (!isProduct) {
      continue;
    }
    if (match === null || productId.length > match.length) {
      match = productId;
    }
  }
  return match;
}
