export type WebCheckoutMethod = 'paypal' | 'strike';

export function hasWebPurchasableProcessor(params: {
  processorIds: readonly string[];
  paypalClientId: string;
}): boolean {
  if (params.processorIds.includes('test')) {
    return true;
  }
  if (params.processorIds.includes('strike')) {
    return true;
  }
  return params.processorIds.includes('paypal') && params.paypalClientId !== '';
}

/** PayPal and Lightning, in the order the checkout page offers them. */
export function webCheckoutMethods(params: {
  paypalPurchasable: boolean;
  strikeOffered: boolean;
}): WebCheckoutMethod[] {
  const methods: WebCheckoutMethod[] = [];
  if (params.paypalPurchasable) {
    methods.push('paypal');
  }
  if (params.strikeOffered) {
    methods.push('strike');
  }
  return methods;
}
