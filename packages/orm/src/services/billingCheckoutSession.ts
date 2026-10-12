import { getDataSourceRead, getDataSourceReadWrite } from '@orm/context.js';
import { BillingCheckoutSession } from '@orm/entities/billingCheckoutSession.js';
import type { DataSource } from 'typeorm';
import { IsNull, MoreThanOrEqual } from 'typeorm';

type BillingCheckoutSessionServiceParams = {
  dataSourceRead?: DataSource;
  dataSourceReadWrite?: DataSource;
};

type CreateBillingCheckoutSessionParams = {
  processorId: string;
  externalId: string;
  accountId: number;
  billingProcessorProductId: number;
  amount: string;
  currencyCode: string;
  expiresAt: Date;
};

export class BillingCheckoutSessionService {
  private dataSourceRead: DataSource;
  private dataSourceReadWrite: DataSource;

  constructor(params?: BillingCheckoutSessionServiceParams) {
    this.dataSourceRead = params?.dataSourceRead ?? getDataSourceRead();
    this.dataSourceReadWrite = params?.dataSourceReadWrite ?? getDataSourceReadWrite();
  }

  async create(params: CreateBillingCheckoutSessionParams): Promise<BillingCheckoutSession> {
    const repository = this.dataSourceReadWrite.getRepository(BillingCheckoutSession);
    const created = repository.create({
      processor_id: params.processorId,
      external_id: params.externalId,
      account_id: params.accountId,
      billing_processor_product_id: params.billingProcessorProductId,
      amount: params.amount,
      currency_code: params.currencyCode,
      expires_at: params.expiresAt,
      settled_at: null,
    });
    return repository.save(created);
  }

  async findByExternalId(
    processorId: string,
    externalId: string
  ): Promise<BillingCheckoutSession | null> {
    return this.dataSourceRead.getRepository(BillingCheckoutSession).findOne({
      where: {
        processor_id: processorId,
        external_id: externalId,
      },
    });
  }

  async getForAccount(id: number, accountId: number): Promise<BillingCheckoutSession | null> {
    return this.dataSourceRead.getRepository(BillingCheckoutSession).findOne({
      where: {
        id,
        account_id: accountId,
      },
    });
  }

  async markSettled(id: number, settledAt: Date): Promise<BillingCheckoutSession> {
    const repository = this.dataSourceReadWrite.getRepository(BillingCheckoutSession);
    const session = await repository.findOne({ where: { id } });
    if (session === null) {
      throw new Error('BillingCheckoutSession not found');
    }
    if (session.settled_at !== null) {
      return session;
    }
    session.settled_at = settledAt;
    return repository.save(session);
  }

  async listUnsettledSince(
    processorId: string,
    since: Date,
    limit: number
  ): Promise<BillingCheckoutSession[]> {
    return this.dataSourceRead.getRepository(BillingCheckoutSession).find({
      where: {
        processor_id: processorId,
        settled_at: IsNull(),
        created_at: MoreThanOrEqual(since),
      },
      order: {
        created_at: 'ASC',
        id: 'ASC',
      },
      take: limit,
    });
  }
}

export type { CreateBillingCheckoutSessionParams };
