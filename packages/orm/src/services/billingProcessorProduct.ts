import { getDataSourceRead, getDataSourceReadWrite } from '@orm/context.js';
import { BillingProcessorProduct } from '@orm/entities/billingProcessorProduct.js';
import { BillingProduct } from '@orm/entities/billingProduct.js';
import type { DataSource, EntityManager } from 'typeorm';
import { In, IsNull } from 'typeorm';

import type { BillingCadence, PaymentProcessorId } from '@podverse/helpers';

import { PREMIUM_BILLING_PRODUCT_CODE } from './billingPriceCatalog.js';

type BillingProcessorProductServiceParams = {
  dataSourceRead?: DataSource;
  dataSourceReadWrite?: DataSource;
};

type UpsertPremiumProcessorProductParams = {
  processorId: PaymentProcessorId;
  externalProductId: string;
  externalBasePlanId: string | null;
  cadence: BillingCadence;
};

type UpsertPremiumProcessorProductResult = {
  processorProduct: BillingProcessorProduct;
  created: boolean;
};

type AddPremiumProcessorProductIfMissingResult = {
  row: BillingProcessorProduct;
  created: boolean;
};

function readInsertedId(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const first: unknown = value[0];
  if (typeof first !== 'object' || first === null) {
    return null;
  }
  const id = Reflect.get(first, 'id');
  if (typeof id === 'number' && Number.isInteger(id)) {
    return id;
  }
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
}

/** Maps a processor's store ids to the Premium product and cadence. */
export class BillingProcessorProductService {
  private dataSourceRead: DataSource;
  private dataSourceReadWrite: DataSource;

  constructor(params?: BillingProcessorProductServiceParams) {
    this.dataSourceRead = params?.dataSourceRead ?? getDataSourceRead();
    this.dataSourceReadWrite = params?.dataSourceReadWrite ?? getDataSourceReadWrite();
  }

  async listAll(): Promise<BillingProcessorProduct[]> {
    return this.dataSourceRead.getRepository(BillingProcessorProduct).find({
      relations: { billing_product: true },
      order: { processor_id: 'ASC', id: 'ASC' },
    });
  }

  async getById(id: number): Promise<BillingProcessorProduct | null> {
    return this.dataSourceRead.getRepository(BillingProcessorProduct).findOne({
      where: { id },
      relations: { billing_product: true },
    });
  }

  /** Null when no product has this id. Omitted fields keep their stored value. */
  async updateById(
    id: number,
    params: {
      isActive?: boolean;
      externalProductId?: string;
      externalBasePlanId?: string | null;
    }
  ): Promise<BillingProcessorProduct | null> {
    const repository = this.dataSourceReadWrite.getRepository(BillingProcessorProduct);
    const product = await repository.findOne({ where: { id } });
    if (product === null) {
      return null;
    }
    if (params.isActive !== undefined) {
      product.is_active = params.isActive;
    }
    if (params.externalProductId !== undefined) {
      product.external_product_id = params.externalProductId;
    }
    if (params.externalBasePlanId !== undefined) {
      product.external_base_plan_id = params.externalBasePlanId;
    }
    return repository.save(product);
  }

  /** Active products of the given processors with their catalog product, for checkout options. */
  async listActiveForProcessors(processorIds: string[]): Promise<BillingProcessorProduct[]> {
    if (processorIds.length === 0) {
      return [];
    }
    return this.dataSourceRead.getRepository(BillingProcessorProduct).find({
      where: { processor_id: In(processorIds), is_active: true },
      relations: { billing_product: true },
      order: { processor_id: 'ASC', id: 'ASC' },
    });
  }

  /** The active product a client picked at checkout; null when it is unknown or retired. */
  async getActiveById(id: number): Promise<BillingProcessorProduct | null> {
    return this.dataSourceRead.getRepository(BillingProcessorProduct).findOne({
      where: { id, is_active: true },
      relations: { billing_product: true },
    });
  }

  async getByExternalIds(
    processorId: string,
    externalProductId: string,
    externalBasePlanId: string | null
  ): Promise<BillingProcessorProduct | null> {
    return this.getByExternalIdsWithManager(
      this.dataSourceRead.manager,
      processorId,
      externalProductId,
      externalBasePlanId
    );
  }

  async getByExternalIdsWithManager(
    transactionalEntityManager: EntityManager,
    processorId: string,
    externalProductId: string,
    externalBasePlanId: string | null
  ): Promise<BillingProcessorProduct | null> {
    return transactionalEntityManager.getRepository(BillingProcessorProduct).findOne({
      where: {
        processor_id: processorId,
        external_product_id: externalProductId,
        external_base_plan_id: externalBasePlanId === null ? IsNull() : externalBasePlanId,
      },
    });
  }

  /** Creates the Premium product row first when the database has none. */
  async upsertPremiumProcessorProduct(
    params: UpsertPremiumProcessorProductParams
  ): Promise<UpsertPremiumProcessorProductResult> {
    return this.dataSourceReadWrite.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.query(
        `
        INSERT INTO billing_product (product_code, name, is_active)
        SELECT $1, $2, TRUE
        WHERE NOT EXISTS (
          SELECT 1
          FROM billing_product
          WHERE product_code = $1
        )
        `,
        [PREMIUM_BILLING_PRODUCT_CODE, 'Premium Membership']
      );
      const premiumProduct = await transactionalEntityManager
        .getRepository(BillingProduct)
        .findOneOrFail({ where: { product_code: PREMIUM_BILLING_PRODUCT_CODE } });

      const repository = transactionalEntityManager.getRepository(BillingProcessorProduct);
      const existing = await this.getByExternalIdsWithManager(
        transactionalEntityManager,
        params.processorId,
        params.externalProductId,
        params.externalBasePlanId
      );

      if (existing === null) {
        const processorProduct = await repository.save(
          repository.create({
            processor_id: params.processorId,
            external_product_id: params.externalProductId,
            external_base_plan_id: params.externalBasePlanId,
            billing_product_id: premiumProduct.id,
            billing_cadence: params.cadence,
            is_active: true,
          })
        );
        return { processorProduct, created: true };
      }

      existing.billing_product_id = premiumProduct.id;
      existing.billing_cadence = params.cadence;
      existing.is_active = true;
      return { processorProduct: await repository.save(existing), created: false };
    });
  }

  /**
   * Inserts the Premium mapping when that store id is new. An existing row, including one an
   * admin deactivated or edited, is left as it is.
   */
  async addPremiumProcessorProductIfMissing(
    params: UpsertPremiumProcessorProductParams
  ): Promise<AddPremiumProcessorProductIfMissingResult> {
    return this.dataSourceReadWrite.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.query(
        `
        INSERT INTO billing_product (product_code, name, is_active)
        SELECT $1, $2, TRUE
        WHERE NOT EXISTS (
          SELECT 1
          FROM billing_product
          WHERE product_code = $1
        )
        `,
        [PREMIUM_BILLING_PRODUCT_CODE, 'Premium Membership']
      );
      const inserted: unknown = await transactionalEntityManager.query(
        `
        INSERT INTO billing_processor_product (
          processor_id,
          external_product_id,
          external_base_plan_id,
          billing_product_id,
          billing_cadence,
          is_active
        )
        SELECT $1, $2, $3, bp.id, $4, TRUE
        FROM (
          SELECT id
          FROM billing_product
          WHERE product_code = $5
          ORDER BY id
          LIMIT 1
        ) bp
        ON CONFLICT ON CONSTRAINT billing_processor_product_external_key DO NOTHING
        RETURNING id
        `,
        [
          params.processorId,
          params.externalProductId,
          params.externalBasePlanId,
          params.cadence,
          PREMIUM_BILLING_PRODUCT_CODE,
        ]
      );
      const insertedId = readInsertedId(inserted);
      const repository = transactionalEntityManager.getRepository(BillingProcessorProduct);
      if (insertedId !== null) {
        const row = await repository.findOneOrFail({ where: { id: insertedId } });
        return { row, created: true };
      }

      const row = await this.getByExternalIdsWithManager(
        transactionalEntityManager,
        params.processorId,
        params.externalProductId,
        params.externalBasePlanId
      );
      if (row === null) {
        throw new Error('Billing processor product insert did not return a row');
      }
      return { row, created: false };
    });
  }
}

export type {
  AddPremiumProcessorProductIfMissingResult,
  UpsertPremiumProcessorProductParams,
  UpsertPremiumProcessorProductResult,
};
