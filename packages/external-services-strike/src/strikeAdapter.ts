import type {
  BillingAmount,
  BillingWebhookParseResult,
  BillingWebhookRequest,
  NormalizedBillingEvent,
  NormalizedTransactionSnapshot,
  PaymentProcessorAdapter,
} from '@podverse/helpers';
import {
  BillingProcessorRecordNotFoundError,
  BillingWebhookVerificationError,
} from '@podverse/helpers';

import type {
  CreateStrikeReceiveRequestParams,
  StrikeAmount,
  StrikeEnvironment,
  StrikeReceive,
} from './StrikeClient.js';
import { verifyAndParseStrikeWebhook } from './verifyWebhook.js';

export const STRIKE_CHECKOUT_EXPIRY_SECONDS = 900;

export interface StrikeCheckoutSessionRecord {
  accountId: number;
  amount: string;
  currencyCode: string;
  externalProductId: string;
}

export interface StrikeClientLike {
  createReceiveRequest(
    params: CreateStrikeReceiveRequestParams
  ): Promise<{ bolt11: string; expiresAt: string; receiveRequestId: string }>;
  listReceives(receiveRequestId: string): Promise<StrikeReceive[]>;
}

export interface StrikeAdapterConfig {
  client: StrikeClientLike;
  environment: StrikeEnvironment;
  findCheckoutSession: (externalId: string) => Promise<StrikeCheckoutSessionRecord | null>;
  webhookSecret: string;
  now?: () => Date;
}

export interface StrikeCheckoutResult {
  bolt11: string;
  expiresAt: string;
  receiveRequestId: string;
}

export type StrikeCheckoutState = 'pending' | 'settled' | 'unpaid';

export interface StrikeAdapter extends PaymentProcessorAdapter {
  createCheckout(params: {
    amount: string;
    currencyCode: string;
    description: string;
  }): Promise<StrikeCheckoutResult>;
  readCheckoutState(receiveRequestId: string): Promise<StrikeCheckoutState>;
}

interface SettledStrikeTransaction {
  accountId: number;
  snapshot: NormalizedTransactionSnapshot;
}

export class StrikeReceiveNotCompletedError extends Error {
  constructor(externalId: string) {
    super(`Strike receive request is not completed: ${externalId}`);
    this.name = 'StrikeReceiveNotCompletedError';
  }
}

function normalizeStrikeAmount(amount: StrikeAmount | null): BillingAmount | null {
  if (amount === null) {
    return null;
  }
  return {
    value: amount.amount,
    currencyCode: amount.currency,
  };
}

function findCompletedReceive(receives: StrikeReceive[]): StrikeReceive | null {
  for (const receive of receives) {
    if (receive.state === 'COMPLETED') {
      return receive;
    }
  }
  return null;
}

function hasPendingReceive(receives: StrikeReceive[]): boolean {
  return receives.some((receive) => receive.state === 'PENDING');
}

function mapSettlementEvent(params: {
  accountId: number;
  amount: BillingAmount | null;
  externalProductId: string;
  externalTransactionId: string;
  isSandbox: boolean;
  occurredAt: string;
  processorEventId: string;
}): NormalizedBillingEvent {
  return {
    type: 'payment_settled',
    processor: 'strike',
    processorEventId: params.processorEventId,
    accountBillingCustomerRef: null,
    accountId: params.accountId,
    occurredAt: params.occurredAt,
    isSandbox: params.isSandbox,
    externalTransactionId: params.externalTransactionId,
    externalProductId: params.externalProductId,
    externalBasePlanId: null,
    periodStart: null,
    periodEnd: null,
    amount: params.amount,
  };
}

function logUnknownCheckoutSession(externalId: string): void {
  // An authentic webhook can arrive for a checkout row we no longer have.
  // eslint-disable-next-line no-console -- info is the level for an ignored delivery
  console.info(
    `Billing webhook ignored because checkout session is missing processor=strike externalId=${externalId}`
  );
}

function logPendingReceive(externalId: string): void {
  // Receive-completed can race with eventual consistency when receives are listed.
  // eslint-disable-next-line no-console -- info is the level for a retryable pending state
  console.info(
    `Billing webhook has no completed receive yet processor=strike externalId=${externalId}`
  );
}

export function createStrikeAdapter(config: StrikeAdapterConfig): StrikeAdapter {
  const now = config.now ?? (() => new Date());
  const isSandbox = config.environment === 'sandbox';

  const fetchSettledTransaction = async (externalId: string): Promise<SettledStrikeTransaction> => {
    const session = await config.findCheckoutSession(externalId);
    if (session === null) {
      throw new BillingProcessorRecordNotFoundError('strike', externalId);
    }

    const receives = await config.client.listReceives(externalId);
    const completedReceive = findCompletedReceive(receives);
    if (completedReceive === null) {
      throw new StrikeReceiveNotCompletedError(externalId);
    }

    const fetchedAt = now().toISOString();
    const settledAt = completedReceive.completed ?? fetchedAt;
    const amount = normalizeStrikeAmount(completedReceive.amountCredited) ?? {
      value: session.amount,
      currencyCode: session.currencyCode,
    };

    return {
      accountId: session.accountId,
      snapshot: {
        processor: 'strike',
        externalTransactionId: externalId,
        accountBillingCustomerRef: null,
        externalProductId: session.externalProductId,
        externalBasePlanId: null,
        settledAt,
        periodStart: null,
        periodEnd: null,
        amount,
        revokedAt: null,
        revocationReason: null,
        isSandbox,
        fetchedAt,
        schemaVersion: 'strike-receive-request-v1',
        rawPayload: {
          receives,
        },
      },
    };
  };

  return {
    id: 'strike',

    async verifyAndParseWebhook(
      request: BillingWebhookRequest
    ): Promise<BillingWebhookParseResult> {
      const parsed = (() => {
        try {
          return verifyAndParseStrikeWebhook({
            rawBody: request.rawBody,
            headers: request.headers,
            secret: config.webhookSecret,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Strike webhook verification failed';
          throw new BillingWebhookVerificationError('strike', message);
        }
      })();

      if (parsed.eventType !== 'receive-request.receive-completed') {
        return {
          schemaVersion: 'strike-webhook-v1',
          rawPayload: parsed.rawPayload,
          events: [],
        };
      }

      try {
        const transaction = await fetchSettledTransaction(parsed.entityId);
        const externalProductId = transaction.snapshot.externalProductId;
        if (externalProductId === null) {
          return {
            schemaVersion: 'strike-webhook-v1',
            rawPayload: parsed.rawPayload,
            events: [],
          };
        }
        return {
          schemaVersion: 'strike-webhook-v1',
          rawPayload: parsed.rawPayload,
          events: [
            mapSettlementEvent({
              processorEventId: parsed.id,
              externalTransactionId: transaction.snapshot.externalTransactionId,
              externalProductId,
              accountId: transaction.accountId,
              occurredAt: transaction.snapshot.settledAt,
              amount: transaction.snapshot.amount,
              isSandbox,
            }),
          ],
        };
      } catch (error) {
        if (error instanceof StrikeReceiveNotCompletedError) {
          logPendingReceive(parsed.entityId);
          return {
            schemaVersion: 'strike-webhook-v1',
            rawPayload: parsed.rawPayload,
            events: [],
          };
        }
        if (error instanceof BillingProcessorRecordNotFoundError) {
          logUnknownCheckoutSession(parsed.entityId);
          return {
            schemaVersion: 'strike-webhook-v1',
            rawPayload: parsed.rawPayload,
            events: [],
          };
        }
        throw error;
      }
    },

    async fetchTransaction(ref): Promise<NormalizedTransactionSnapshot> {
      const transaction = await fetchSettledTransaction(ref.externalId);
      return transaction.snapshot;
    },

    async createCheckout(params): Promise<StrikeCheckoutResult> {
      return config.client.createReceiveRequest({
        amount: params.amount,
        currency: params.currencyCode,
        description: params.description,
        expiryInSeconds: STRIKE_CHECKOUT_EXPIRY_SECONDS,
      });
    },

    async readCheckoutState(receiveRequestId: string): Promise<StrikeCheckoutState> {
      const receives = await config.client.listReceives(receiveRequestId);
      if (findCompletedReceive(receives) !== null) {
        return 'settled';
      }
      if (hasPendingReceive(receives)) {
        return 'pending';
      }
      return 'unpaid';
    },
  };
}
