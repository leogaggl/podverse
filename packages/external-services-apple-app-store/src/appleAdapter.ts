import type {
  JWSTransactionDecodedPayload,
  TransactionInfoResponse,
} from '@apple/app-store-server-library';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';

import type {
  BillingProcessorRecordRef,
  BillingWebhookParseResult,
  BillingWebhookRequest,
  IsMappedBillingProduct,
  NormalizedTransactionSnapshot,
  PaymentProcessorAdapter,
} from '@podverse/helpers';
import {
  BillingProcessorRecordNotFoundError,
  BillingWebhookVerificationError,
} from '@podverse/helpers';

import type {
  AppleSignedPayloadVerifier,
  CreateAppleClientConfig,
} from './AppStoreServerClient.js';
import { AppStoreServerClient, resolveAppleRuntimeEnvironment } from './AppStoreServerClient.js';
import {
  appleSoldTransactionType,
  appleUnsoldTransactionType,
  logUnmappedBillingProduct,
  mapVerifiedNotificationToEvents,
} from './verifyNotification.js';

export interface AppleAdapterConfig extends CreateAppleClientConfig {
  client?: AppStoreServerClient;
  /**
   * Whether `billing_processor_product` maps this store id. An inactive row still counts, so a
   * refund for a retired product still applies. An unmapped id produces no events.
   */
  isMappedProduct: IsMappedBillingProduct;
  /** Reads StoreKit Testing transactions when `appleEnvironment` is `xcode`. */
  xcodeVerifier?: Pick<AppleSignedPayloadVerifier, 'verifyAndDecodeTransaction'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRawPayload(value: unknown): Record<string, unknown> {
  const json = JSON.stringify(value);
  const parsed: unknown = JSON.parse(json);
  return isRecord(parsed) ? parsed : {};
}

function parseWebhookPayload(rawBody: Uint8Array | string): { signedPayload: string } {
  const text = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new BillingWebhookVerificationError('apple', 'Webhook body is not valid JSON');
  }
  if (!isRecord(payload)) {
    throw new BillingWebhookVerificationError('apple', 'Webhook body must be a JSON object');
  }
  const signedPayload = Reflect.get(payload, 'signedPayload');
  if (typeof signedPayload !== 'string' || signedPayload.length === 0) {
    throw new BillingWebhookVerificationError('apple', 'Webhook body is missing signedPayload');
  }
  return { signedPayload };
}

function toIsoTimestamp(value: number | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value).toISOString();
}

/** StoreKit Testing purchases charge nothing, so they count as sandbox. */
function isSandboxEnvironment(value: Environment | string | undefined): boolean {
  return (
    value === Environment.SANDBOX ||
    value === 'Sandbox' ||
    value === Environment.XCODE ||
    value === Environment.LOCAL_TESTING
  );
}

function resolveTransactionAmount(
  transaction: { price?: number; currency?: string } | null
): { value: string; currencyCode: string } | null {
  if (
    transaction === null ||
    typeof transaction.price !== 'number' ||
    !Number.isFinite(transaction.price) ||
    typeof transaction.currency !== 'string' ||
    transaction.currency.length === 0
  ) {
    return null;
  }

  const sign = transaction.price < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(transaction.price));
  const whole = Math.floor(absolute / 1000);
  const fractional = String(absolute % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const value = fractional.length > 0 ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
  return {
    value,
    currencyCode: transaction.currency,
  };
}

function ensureSignedTransactionInfo(
  response: TransactionInfoResponse,
  externalId: string
): string {
  const signedTransactionInfo = response.signedTransactionInfo;
  if (signedTransactionInfo === undefined || signedTransactionInfo.length === 0) {
    throw new BillingProcessorRecordNotFoundError('apple', externalId);
  }
  return signedTransactionInfo;
}

function mapTransactionSnapshot(
  externalId: string,
  externalProductId: string | null,
  environment: Environment,
  fetchedAt: string,
  transaction: {
    appAccountToken?: string;
    currency?: string;
    environment?: Environment | string;
    expiresDate?: number;
    originalPurchaseDate?: number;
    price?: number;
    productId?: string;
    purchaseDate?: number;
    revocationDate?: number;
    transactionId?: string;
  },
  rawPayload: Record<string, unknown>
): NormalizedTransactionSnapshot {
  const periodStart =
    toIsoTimestamp(transaction.purchaseDate) ?? toIsoTimestamp(transaction.originalPurchaseDate);
  const revokedAt = toIsoTimestamp(transaction.revocationDate);
  return {
    processor: 'apple',
    externalTransactionId: transaction.transactionId ?? externalId,
    accountBillingCustomerRef: transaction.appAccountToken ?? null,
    externalProductId: transaction.productId ?? externalProductId,
    externalBasePlanId: null,
    settledAt: toIsoTimestamp(transaction.purchaseDate) ?? fetchedAt,
    periodStart,
    periodEnd: toIsoTimestamp(transaction.expiresDate),
    amount: resolveTransactionAmount(transaction),
    revokedAt,
    revocationReason: revokedAt === null ? null : 'refund',
    isSandbox: isSandboxEnvironment(transaction.environment ?? environment),
    fetchedAt,
    schemaVersion: 'apple-transaction-v1',
    rawPayload,
  };
}

async function assertSoldTransaction(
  externalId: string,
  externalProductId: string | null,
  transaction: { productId?: string; type?: string },
  isMappedProduct: IsMappedBillingProduct
): Promise<void> {
  const productId = transaction.productId ?? externalProductId;
  const mapped =
    productId !== null && productId !== '' && (await isMappedProduct('apple', productId, null));
  if (
    transaction.type === appleUnsoldTransactionType() ||
    transaction.type !== appleSoldTransactionType() ||
    !mapped
  ) {
    logUnmappedBillingProduct('apple', productId, 'fetchTransaction');
    throw new BillingProcessorRecordNotFoundError('apple', externalId);
  }
}

async function decodeXcodeTransaction(
  verifier: Pick<AppleSignedPayloadVerifier, 'verifyAndDecodeTransaction'>,
  ref: BillingProcessorRecordRef
): Promise<JWSTransactionDecodedPayload> {
  const signedTransaction = ref.signedTransaction ?? '';
  if (signedTransaction === '') {
    throw new BillingProcessorRecordNotFoundError('apple', ref.externalId);
  }
  let transaction: JWSTransactionDecodedPayload;
  try {
    transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
  } catch {
    throw new BillingProcessorRecordNotFoundError('apple', ref.externalId);
  }
  if (
    transaction.transactionId !== ref.externalId &&
    transaction.originalTransactionId !== ref.externalId
  ) {
    throw new BillingProcessorRecordNotFoundError('apple', ref.externalId);
  }
  return transaction;
}

/**
 * Reads the signed transaction the device posts, because Xcode's StoreKit Testing purchases never
 * reach Apple's servers. Those transactions are signed by Xcode, not Apple, so nothing proves the
 * device did not write one itself; `resolveAppleRuntimeEnvironment` refuses this mode in
 * production. Reconciliation has no transaction to read and finds no record, and there are no
 * server notifications.
 */
function createXcodeAppleAdapter(
  config: Pick<AppleAdapterConfig, 'bundleId' | 'xcodeVerifier'>,
  isMappedProduct: IsMappedBillingProduct
): PaymentProcessorAdapter {
  const verifier =
    config.xcodeVerifier ?? new SignedDataVerifier([], false, Environment.XCODE, config.bundleId);
  const nowIso = (): string => new Date().toISOString();

  return {
    id: 'apple',

    async verifyAndParseWebhook(): Promise<BillingWebhookParseResult> {
      throw new BillingWebhookVerificationError(
        'apple',
        'StoreKit Testing in Xcode sends no App Store Server Notifications'
      );
    },

    async fetchTransaction(ref): Promise<NormalizedTransactionSnapshot> {
      const transaction = await decodeXcodeTransaction(verifier, ref);
      await assertSoldTransaction(
        ref.externalId,
        ref.externalProductId,
        transaction,
        isMappedProduct
      );
      return mapTransactionSnapshot(
        ref.externalId,
        ref.externalProductId,
        Environment.XCODE,
        nowIso(),
        transaction,
        toRawPayload({ transaction })
      );
    },
  };
}

export function createAppleAdapter(config: AppleAdapterConfig): PaymentProcessorAdapter {
  const isMappedProduct = config.isMappedProduct;
  if (resolveAppleRuntimeEnvironment(config.appleEnvironment, config.nodeEnv) === 'xcode') {
    return createXcodeAppleAdapter(config, isMappedProduct);
  }
  const client = config.client ?? AppStoreServerClient.fromConfig(config);
  const nowIso = (): string => new Date().toISOString();

  return {
    id: 'apple',

    async verifyAndParseWebhook(
      request: BillingWebhookRequest
    ): Promise<BillingWebhookParseResult> {
      const { signedPayload } = parseWebhookPayload(request.rawBody);
      const verified = await client.verifyAndDecodeNotification(signedPayload);
      const now = nowIso();
      return {
        schemaVersion: 'apple-asn-v2',
        rawPayload: toRawPayload({
          notification: verified.notification,
          transaction: verified.transaction,
        }),
        events: await mapVerifiedNotificationToEvents(verified, now, isMappedProduct),
      };
    },

    async fetchTransaction(ref): Promise<NormalizedTransactionSnapshot> {
      const fetchedAt = nowIso();
      const { response, environment } = await client.getTransactionInfoWithFallback(ref.externalId);
      const signedTransactionInfo = ensureSignedTransactionInfo(response, ref.externalId);
      const transaction = await client.verifyAndDecodeTransaction(
        signedTransactionInfo,
        environment
      );
      await assertSoldTransaction(
        ref.externalId,
        ref.externalProductId,
        transaction,
        isMappedProduct
      );
      return mapTransactionSnapshot(
        ref.externalId,
        ref.externalProductId,
        environment,
        fetchedAt,
        transaction,
        toRawPayload({ transactionInfoResponse: response, transaction })
      );
    },
  };
}
