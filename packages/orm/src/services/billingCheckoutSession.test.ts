import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { BillingCheckoutSessionService } from './billingCheckoutSession.js';

function createMockService() {
  const create = vi.fn((row: unknown) => row);
  const save = vi.fn(async (row: unknown) => row);
  const findOneRead = vi.fn();
  const findOneWrite = vi.fn();
  const findRead = vi.fn();

  const readRepository = {
    find: findRead,
    findOne: findOneRead,
  };
  const writeRepository = {
    create,
    findOne: findOneWrite,
    save,
  };

  const dataSourceRead = {
    getRepository: vi.fn(() => readRepository),
  } as unknown as DataSource;
  const dataSourceReadWrite = {
    getRepository: vi.fn(() => writeRepository),
  } as unknown as DataSource;

  return {
    create,
    dataSourceRead,
    dataSourceReadWrite,
    findOneRead,
    findOneWrite,
    findRead,
    save,
    service: new BillingCheckoutSessionService({
      dataSourceRead,
      dataSourceReadWrite,
    }),
  };
}

describe('BillingCheckoutSessionService', () => {
  it('creates a checkout session row', async () => {
    const { create, save, service } = createMockService();
    const expiresAt = new Date('2026-10-10T00:15:00.000Z');

    await service.create({
      processorId: 'strike',
      externalId: 'recv_123',
      accountId: 12,
      billingProcessorProductId: 34,
      amount: '3.00',
      currencyCode: 'USD',
      expiresAt,
    });

    expect(create).toHaveBeenCalledWith({
      processor_id: 'strike',
      external_id: 'recv_123',
      account_id: 12,
      billing_processor_product_id: 34,
      amount: '3.00',
      currency_code: 'USD',
      expires_at: expiresAt,
      settled_at: null,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('finds a checkout session by external id', async () => {
    const { findOneRead, service } = createMockService();
    findOneRead.mockResolvedValueOnce({ id: 22 });

    const result = await service.findByExternalId('strike', 'recv_22');

    expect(result).toEqual({ id: 22 });
    expect(findOneRead).toHaveBeenCalledWith({
      where: { processor_id: 'strike', external_id: 'recv_22' },
    });
  });

  it('returns null when getForAccount does not find an owned row', async () => {
    const { findOneRead, service } = createMockService();
    findOneRead.mockResolvedValueOnce(null);

    const result = await service.getForAccount(55, 101);

    expect(result).toBeNull();
    expect(findOneRead).toHaveBeenCalledWith({
      where: { id: 55, account_id: 101 },
    });
  });

  it('marks an unsettled session as settled', async () => {
    const { findOneWrite, save, service } = createMockService();
    findOneWrite.mockResolvedValueOnce({ id: 7, settled_at: null });
    save.mockImplementation(async (row) => row);
    const settledAt = new Date('2026-10-11T00:00:00.000Z');

    const result = await service.markSettled(7, settledAt);

    expect(result).toMatchObject({ id: 7, settled_at: settledAt });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps markSettled idempotent when a row is already settled', async () => {
    const { findOneWrite, save, service } = createMockService();
    const existing = { id: 8, settled_at: new Date('2026-10-10T00:00:00.000Z') };
    findOneWrite.mockResolvedValueOnce(existing);

    const result = await service.markSettled(8, new Date('2026-10-11T00:00:00.000Z'));

    expect(result).toBe(existing);
    expect(save).not.toHaveBeenCalled();
  });

  it('lists unsettled rows for one processor since a timestamp', async () => {
    const { findRead, service } = createMockService();
    findRead.mockResolvedValueOnce([{ id: 91 }]);

    const result = await service.listUnsettledSince(
      'strike',
      new Date('2026-10-11T00:00:00.000Z'),
      10
    );

    expect(result).toEqual([{ id: 91 }]);
    expect(findRead).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { created_at: 'ASC', id: 'ASC' },
        take: 10,
      })
    );
  });
});
