import type { Account } from '@orm/entities/account/account.js';
import type { BillingProcessor } from '@orm/entities/billingProcessor.js';
import type { BillingProcessorProduct } from '@orm/entities/billingProcessorProduct.js';
import { ISO_4217_CURRENCY_CODE_CHAR_LENGTH } from '@orm/lib/billingLimits.js';
import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('billing_checkout_session')
@Unique('billing_checkout_session_processor_external_key', ['processor_id', 'external_id'])
export class BillingCheckoutSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  processor_id!: string;

  @ManyToOne('BillingProcessor', (billingProcessor: BillingProcessor) => billingProcessor.id)
  @JoinColumn({ name: 'processor_id' })
  billing_processor!: Relation<BillingProcessor>;

  @Column({ type: 'text' })
  external_id!: string;

  @Column({ type: 'integer' })
  account_id!: number;

  @ManyToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @Column({ type: 'integer' })
  billing_processor_product_id!: number;

  @ManyToOne(
    'BillingProcessorProduct',
    (billingProcessorProduct: BillingProcessorProduct) => billingProcessorProduct.id
  )
  @JoinColumn({ name: 'billing_processor_product_id' })
  billing_processor_product!: Relation<BillingProcessorProduct>;

  @Column({ type: 'numeric', precision: 19, scale: 4 })
  amount!: string;

  @Column({ type: 'char', length: ISO_4217_CURRENCY_CODE_CHAR_LENGTH })
  currency_code!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  settled_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;
}
