import { BillingProcessorRecordNotFoundError } from '@podverse/helpers';
import { fetchWithTimeout } from '@podverse/helpers-backend';

export type StrikeEnvironment = 'production' | 'sandbox';

const STRIKE_BASE_URL_BY_ENVIRONMENT = {
  production: 'https://api.strike.me',
  sandbox: 'https://api.dev.strike.me',
} as const satisfies Record<StrikeEnvironment, string>;

interface StrikeClientRequestOptions {
  body?: Record<string, unknown>;
  context: string;
  method: 'GET' | 'PATCH' | 'POST';
  notFoundExternalId?: string;
  path: string;
}

export interface StrikeClientParams {
  apiKey: string;
  environment: StrikeEnvironment;
  timeoutMs?: number;
  fetchImpl?: typeof fetchWithTimeout;
}

export interface StrikeAmount {
  amount: string;
  currency: string;
}

export interface StrikeReceive {
  amountCredited: StrikeAmount | null;
  amountReceived: StrikeAmount;
  completed: string | null;
  created: string;
  receiveId: string;
  receiveRequestId: string;
  state: 'COMPLETED' | 'PENDING';
}

export interface StrikeReceiveRequest {
  bolt11: {
    description: string | null;
    expires: string | null;
    invoice: string | null;
    paymentHash: string | null;
    requestedAmount: StrikeAmount | null;
  } | null;
  created: string;
  receiveRequestId: string;
  targetCurrency: string | null;
}

export interface StrikeSubscription {
  created: string;
  enabled: boolean;
  eventTypes: string[];
  id: string;
  webhookUrl: string;
  webhookVersion: 'v1' | 'v2';
}

export interface CreateStrikeReceiveRequestParams {
  amount: string;
  currency: string;
  description: string;
  expiryInSeconds: number;
}

export interface StrikeReceiveRequestCheckout {
  bolt11: string;
  expiresAt: string;
  receiveRequestId: string;
}

export interface StrikeSubscriptionCreateParams {
  enabled: boolean;
  eventTypes: string[];
  secret: string;
  webhookUrl: string;
  webhookVersion: 'v1' | 'v2';
}

export interface StrikeSubscriptionUpdateParams {
  enabled?: boolean;
  eventTypes?: string[];
  secret?: string;
  webhookUrl?: string;
  webhookVersion?: 'v1' | 'v2';
}

export class StrikeApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly strikeMessage: string | null;

  constructor(params: {
    message: string;
    status: number;
    code: string | null;
    strikeMessage: string | null;
  }) {
    super(params.message);
    this.name = 'StrikeApiError';
    this.status = params.status;
    this.code = params.code;
    this.strikeMessage = params.strikeMessage;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = Reflect.get(record, key);
  return typeof value === 'boolean' ? value : null;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = Reflect.get(record, key);
  return isRecord(value) ? value : null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = Reflect.get(record, key);
  if (!Array.isArray(value)) {
    return null;
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      return null;
    }
    result.push(item);
  }
  return result;
}

function parseStrikeAmount(value: unknown): StrikeAmount | null {
  if (!isRecord(value)) {
    return null;
  }
  const amount = readString(value, 'amount');
  const currency = readString(value, 'currency');
  if (amount === null || currency === null) {
    return null;
  }
  return { amount, currency };
}

function parseStrikeReceiveRequest(payload: unknown, context: string): StrikeReceiveRequest {
  if (!isRecord(payload)) {
    throw new Error(`Strike ${context} response is not an object`);
  }

  const receiveRequestId = readString(payload, 'receiveRequestId');
  const created = readString(payload, 'created');
  if (receiveRequestId === null || created === null) {
    throw new Error(`Strike ${context} response is missing required fields`);
  }

  const bolt11Record = readRecord(payload, 'bolt11');
  const bolt11 =
    bolt11Record === null
      ? null
      : {
          invoice: readString(bolt11Record, 'invoice'),
          requestedAmount: parseStrikeAmount(Reflect.get(bolt11Record, 'requestedAmount')),
          description: readString(bolt11Record, 'description'),
          paymentHash: readString(bolt11Record, 'paymentHash'),
          expires: readString(bolt11Record, 'expires'),
        };

  return {
    receiveRequestId,
    created,
    targetCurrency: readString(payload, 'targetCurrency'),
    bolt11,
  };
}

function parseStrikeReceive(payload: unknown): StrikeReceive | null {
  if (!isRecord(payload)) {
    return null;
  }

  const state = readString(payload, 'state');
  if (state !== 'PENDING' && state !== 'COMPLETED') {
    return null;
  }

  const receiveId = readString(payload, 'receiveId');
  const receiveRequestId = readString(payload, 'receiveRequestId');
  const created = readString(payload, 'created');
  const amountReceived = parseStrikeAmount(Reflect.get(payload, 'amountReceived'));
  if (
    receiveId === null ||
    receiveRequestId === null ||
    created === null ||
    amountReceived === null
  ) {
    return null;
  }

  return {
    receiveId,
    receiveRequestId,
    state,
    amountReceived,
    amountCredited: parseStrikeAmount(Reflect.get(payload, 'amountCredited')),
    created,
    completed: readString(payload, 'completed'),
  };
}

function parseStrikeSubscription(payload: unknown, context: string): StrikeSubscription {
  if (!isRecord(payload)) {
    throw new Error(`Strike ${context} response is not an object`);
  }
  const id = readString(payload, 'id');
  const webhookUrl = readString(payload, 'webhookUrl');
  const webhookVersion = readString(payload, 'webhookVersion');
  const created = readString(payload, 'created');
  const enabled = readBoolean(payload, 'enabled');
  const eventTypes = readStringArray(payload, 'eventTypes');

  if (
    id === null ||
    webhookUrl === null ||
    created === null ||
    enabled === null ||
    eventTypes === null ||
    (webhookVersion !== 'v1' && webhookVersion !== 'v2')
  ) {
    throw new Error(`Strike ${context} response is missing required fields`);
  }

  return {
    id,
    webhookUrl,
    webhookVersion,
    created,
    enabled,
    eventTypes,
  };
}

function parseStrikeSubscriptions(payload: unknown): StrikeSubscription[] {
  if (!Array.isArray(payload)) {
    throw new Error('Strike list subscriptions response is not an array');
  }
  return payload.map((item) => parseStrikeSubscription(item, 'list subscriptions'));
}

export class StrikeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetchWithTimeout;
  private readonly timeoutMs: number | undefined;

  constructor(params: StrikeClientParams) {
    this.apiKey = params.apiKey;
    this.baseUrl = STRIKE_BASE_URL_BY_ENVIRONMENT[params.environment];
    this.fetchImpl = params.fetchImpl ?? fetchWithTimeout;
    this.timeoutMs = params.timeoutMs;
  }

  async createReceiveRequest(
    params: CreateStrikeReceiveRequestParams
  ): Promise<StrikeReceiveRequestCheckout> {
    const payload = await this.request({
      context: 'create receive request',
      method: 'POST',
      path: '/v1/receive-requests',
      body: {
        bolt11: {
          amount: {
            amount: params.amount,
            currency: params.currency,
          },
          description: params.description,
          expiryInSeconds: params.expiryInSeconds,
        },
        targetCurrency: 'USD',
      },
    });

    const receiveRequest = parseStrikeReceiveRequest(payload, 'create receive request');
    const bolt11 = receiveRequest.bolt11?.invoice ?? null;
    const expiresAt = receiveRequest.bolt11?.expires ?? null;
    if (bolt11 === null || expiresAt === null) {
      throw new Error('Strike create receive request response is missing bolt11 invoice fields');
    }

    return {
      receiveRequestId: receiveRequest.receiveRequestId,
      bolt11,
      expiresAt,
    };
  }

  async getReceiveRequest(receiveRequestId: string): Promise<StrikeReceiveRequest> {
    const payload = await this.request({
      context: 'get receive request',
      method: 'GET',
      path: `/v1/receive-requests/${encodeURIComponent(receiveRequestId)}`,
      notFoundExternalId: receiveRequestId,
    });

    return parseStrikeReceiveRequest(payload, 'get receive request');
  }

  async listReceives(receiveRequestId: string): Promise<StrikeReceive[]> {
    const payload = await this.request({
      context: 'list receives',
      method: 'GET',
      path: `/v1/receive-requests/${encodeURIComponent(receiveRequestId)}/receives`,
      notFoundExternalId: receiveRequestId,
    });

    if (!isRecord(payload)) {
      throw new Error('Strike list receives response is not an object');
    }
    const items = Reflect.get(payload, 'items');
    if (!Array.isArray(items)) {
      throw new Error('Strike list receives response is missing items');
    }

    const receives: StrikeReceive[] = [];
    for (const item of items) {
      const receive = parseStrikeReceive(item);
      if (receive !== null) {
        receives.push(receive);
      }
    }
    return receives;
  }

  async listSubscriptions(): Promise<StrikeSubscription[]> {
    const payload = await this.request({
      context: 'list subscriptions',
      method: 'GET',
      path: '/v1/subscriptions',
    });
    return parseStrikeSubscriptions(payload);
  }

  async createSubscription(params: StrikeSubscriptionCreateParams): Promise<StrikeSubscription> {
    const payload = await this.request({
      context: 'create subscription',
      method: 'POST',
      path: '/v1/subscriptions',
      body: {
        webhookUrl: params.webhookUrl,
        webhookVersion: params.webhookVersion,
        secret: params.secret,
        enabled: params.enabled,
        eventTypes: params.eventTypes,
      },
    });
    return parseStrikeSubscription(payload, 'create subscription');
  }

  async updateSubscription(
    subscriptionId: string,
    params: StrikeSubscriptionUpdateParams
  ): Promise<StrikeSubscription> {
    const body: Record<string, unknown> = {};
    if (params.webhookUrl !== undefined) {
      body.webhookUrl = params.webhookUrl;
    }
    if (params.webhookVersion !== undefined) {
      body.webhookVersion = params.webhookVersion;
    }
    if (params.secret !== undefined) {
      body.secret = params.secret;
    }
    if (params.enabled !== undefined) {
      body.enabled = params.enabled;
    }
    if (params.eventTypes !== undefined) {
      body.eventTypes = params.eventTypes;
    }

    const payload = await this.request({
      context: 'update subscription',
      method: 'PATCH',
      path: `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      body,
      notFoundExternalId: subscriptionId,
    });
    return parseStrikeSubscription(payload, 'update subscription');
  }

  private async request(options: StrikeClientRequestOptions): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${options.path}`, {
      method: options.method,
      timeoutMs: this.timeoutMs,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 404 && options.notFoundExternalId !== undefined) {
      throw new BillingProcessorRecordNotFoundError('strike', options.notFoundExternalId);
    }

    if (!response.ok) {
      throw await this.buildApiError(options.context, response);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Strike ${options.context} response was not JSON`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Strike ${options.context} response was not valid JSON`);
    }
    return payload;
  }

  private async buildApiError(context: string, response: Response): Promise<StrikeApiError> {
    let code: string | null = null;
    let strikeMessage: string | null = null;

    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        const data = readRecord(payload, 'data');
        if (data !== null) {
          code = readString(data, 'code');
          strikeMessage = readString(data, 'message');
        }
      }
    } catch {
      // Keep defaults when the error body is missing or not JSON.
    }

    const codeSuffix = code === null ? '' : ` (${code})`;
    return new StrikeApiError({
      message: `Strike ${context} failed with status ${response.status}${codeSuffix}`,
      status: response.status,
      code,
      strikeMessage,
    });
  }
}
