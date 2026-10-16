import type { Order } from '@paypal/paypal-server-sdk';
import { describe, expect, it, vi } from 'vitest';

import { PAYPAL_ONE_TIME_PRODUCT_IDS } from '@podverse/helpers';

import type { CreatePayPalOrderParams } from './payPalService.js';
import { PayPalService } from './payPalService.js';

const MONTHLY_INVOICE_ID = new RegExp(
  `^${PAYPAL_ONE_TIME_PRODUCT_IDS.monthly}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
);

describe('PayPalService.resolveEnvironment', () => {
  it('stays sandbox when unset', () => {
    expect(PayPalService.resolveEnvironment(undefined)).toBe('sandbox');
  });

  it('uses live only when that value is set', () => {
    expect(PayPalService.resolveEnvironment('live')).toBe('live');
    expect(PayPalService.resolveEnvironment('sandbox')).toBe('sandbox');
  });
});

describe('PayPalService', () => {
  it('creates and captures one-time orders with the cadence SKU', async () => {
    const createOrder =
      vi.fn<
        (params: {
          body: unknown;
          paypalRequestId?: string;
          prefer?: string;
        }) => Promise<{ result: Order }>
      >();
    createOrder.mockResolvedValue({ result: { id: 'ORDER-1' } });
    const captureOrder =
      vi.fn<
        (params: {
          id: string;
          paypalRequestId?: string;
          prefer?: string;
        }) => Promise<{ result: Order }>
      >();
    captureOrder.mockResolvedValue({ result: { id: 'ORDER-1' } });

    const service = new PayPalService({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      ordersController: {
        createOrder,
        captureOrder,
      },
      paymentsController: {
        getAuthorizedPayment: vi.fn().mockResolvedValue({}),
        getCapturedPayment: vi.fn().mockResolvedValue({}),
      },
    });

    const orderParams: CreatePayPalOrderParams = {
      accountBillingCustomerRef: 'customer-ref-1',
      cadence: 'monthly',
      amount: '4.99',
      currencyCode: 'USD',
      paypalRequestId: 'request-1',
    };
    await service.createOrder(orderParams);
    await service.createOrder(orderParams);
    await service.captureOrder({ orderId: 'ORDER-1', paypalRequestId: 'request-2' });

    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paypalRequestId: 'request-1',
        prefer: 'return=representation',
      })
    );
    expect(createOrder.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          purchaseUnits: [
            expect.objectContaining({
              customId: 'customer-ref-1',
              invoiceId: expect.stringMatching(MONTHLY_INVOICE_ID),
              amount: {
                currencyCode: 'USD',
                value: '4.99',
                breakdown: {
                  itemTotal: {
                    currencyCode: 'USD',
                    value: '4.99',
                  },
                },
              },
              items: [
                expect.objectContaining({
                  sku: PAYPAL_ONE_TIME_PRODUCT_IDS.monthly,
                  unitAmount: {
                    currencyCode: 'USD',
                    value: '4.99',
                  },
                }),
              ],
            }),
          ],
        }),
      })
    );

    const firstInvoiceId = readInvoiceId(createOrder.mock.calls[0]?.[0]);
    const secondInvoiceId = readInvoiceId(createOrder.mock.calls[1]?.[0]);
    expect(firstInvoiceId).not.toBe(secondInvoiceId);

    expect(captureOrder).toHaveBeenCalledTimes(1);
    expect(captureOrder).toHaveBeenCalledWith({
      id: 'ORDER-1',
      paypalRequestId: 'request-2',
      prefer: 'return=representation',
    });
  });

  it('includes the PayPal status and issue when create order is rejected', async () => {
    const createOrder =
      vi.fn<
        (params: {
          body: unknown;
          paypalRequestId?: string;
          prefer?: string;
        }) => Promise<{ result: Order }>
      >();
    createOrder.mockRejectedValue({
      statusCode: 422,
      result: {
        name: 'UNPROCESSABLE_ENTITY',
        details: [{ issue: 'ITEM_TOTAL_REQUIRED', description: 'item_total is required' }],
      },
    });

    const service = new PayPalService({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      ordersController: {
        createOrder,
        captureOrder: async () => ({ result: { id: 'ORDER-1' } }),
      },
      paymentsController: {
        getAuthorizedPayment: async () => ({ result: null }),
        getCapturedPayment: async () => ({ result: null }),
      },
    });

    await expect(
      service.createOrder({
        accountBillingCustomerRef: 'customer-ref-1',
        cadence: 'monthly',
        amount: '4.99',
        currencyCode: 'USD',
      })
    ).rejects.toThrow(
      'PayPal create order failed with status 422: UNPROCESSABLE_ENTITY: ITEM_TOTAL_REQUIRED: item_total is required'
    );
  });
});

function readInvoiceId(params: unknown): string | null {
  if (typeof params !== 'object' || params === null) {
    return null;
  }
  const body = Reflect.get(params, 'body');
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const purchaseUnits = Reflect.get(body, 'purchaseUnits');
  if (!Array.isArray(purchaseUnits)) {
    return null;
  }
  const purchaseUnit = purchaseUnits[0];
  if (typeof purchaseUnit !== 'object' || purchaseUnit === null) {
    return null;
  }
  const invoiceId = Reflect.get(purchaseUnit, 'invoiceId');
  return typeof invoiceId === 'string' ? invoiceId : null;
}
