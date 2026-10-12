# 02 — Strike adapter package

**Cursor model:** Codex 5.3 · **Reasoning:** high

Security-sensitive integration with a clear spec. Read [00-SUMMARY.md](./00-SUMMARY.md) first.
Read the **build-order** and **docker-runtime-workspace-parity** skills, and use
`packages/external-services-paypal` as the structural model.

## 0. Verify the API

Read the current Strike reference for: create receive request, get receive request, get
receives for receive request, create / list / update subscriptions, and webhook signature
verification. Compare with 00-SUMMARY.md § Strike API facts. If anything differs (field names,
header name, signature encoding, scope names), follow the docs and list each difference at the
top of the response.

## 1. Package scaffold

`packages/external-services-strike` (`@podverse/external-services-strike`): `package.json`
(`type: module`, `build`, `test` scripts like the PayPal package), `tsconfig.json`,
`vitest.config.ts` if the PayPal package has one, `src/index.ts`.

- Register in root workspaces if they are not globbed, in `build:packages` ordering (same tier
  as the other `external-services-*`), and in the build-order docs the skill lists.
- Add it to every Dockerfile / runtime manifest that copies the other `external-services-*`
  packages (docker-runtime-workspace-parity).
- Add the dependency to `packages/billing` (or wherever adapters are registered) and to the
  apps that construct the adapter.
- Tell the operator to run `make sync_lockfile` and
  `./scripts/development/update-lockfile-linux.sh`.

## 2. Client (`src/StrikeClient.ts`)

Constructor: `{ apiKey, environment, timeoutMs? }`. Base URL from environment. All calls via
`fetchWithTimeout`. Methods:

- `createReceiveRequest({ amount, currency, description, expiryInSeconds })` → `{ receiveRequestId, bolt11, expiresAt }`
  with `bolt11` only and `targetCurrency: 'USD'`.
- `getReceiveRequest(id)` and `listReceives(receiveRequestId)` → typed results with `state`,
  `amountReceived`, `amountCredited`, `completed`.
- `listSubscriptions()`, `createSubscription(params)`, `updateSubscription(id, params)`.

Parse responses with narrow type guards (no `as`). Non-2xx → a typed `StrikeApiError` with
status and Strike's error code; never include the API key or full response body in error
messages or logs. 404 on a record → `BillingProcessorRecordNotFoundError`.

## 3. Webhook verification (`src/verifyWebhook.ts`)

- Compute the HMAC over the **raw request body bytes** with the subscription secret; compare
  with the header value using `crypto.timingSafeEqual` on equal-length buffers; mismatched
  length → invalid.
- Parse the JSON only after verification. Accept only `webhookVersion === 'v1'`.

## 4. Adapter (`src/strikeAdapter.ts`)

`createStrikeAdapter({ client, webhookSecret, environment, findCheckoutSession })` implementing
`PaymentProcessorAdapter`:

- `findCheckoutSession(externalId)` is injected (the ORM lives above this package) and returns
  `{ accountId, externalProductId, amount, currencyCode } | null`.
- `verifyAndParseWebhook`: verify; for `receive-request.receive-completed`, call
  `fetchTransaction({ externalId: data.entityId })` and return its events; other event types →
  no events. Use the payload `id` as the processor event id for inbox dedupe.
- `fetchTransaction({ externalId })`: load the session (unknown → no events with a log line);
  list receives; when one is `COMPLETED`, return a snapshot → `payment_settled` with
  `externalTransactionId = receiveRequestId`, `accountId`, product id, amount and currency from
  `amountCredited` (fall back to the session amount), `settledAt = completed`,
  `isSandbox = environment === 'sandbox'`. Otherwise return a snapshot with no settlement.
- No refund or revoke events (refunds are manual).
- `createCheckout({ amount, currencyCode, description })` → receive request with
  `expiryInSeconds: STRIKE_CHECKOUT_EXPIRY_SECONDS` (900, exported constant). Used by the API in
  03; keep it on a Strike-specific export, not on the shared adapter interface.
- `readCheckoutState(receiveRequestId)` → `'unpaid' | 'pending' | 'settled'` for polling.

## 5. Tests

Fixtures copied from the Strike docs examples (no real ids or keys). Cover:

1. Valid signature passes; one changed body byte fails; wrong-length signature fails.
2. `receive-completed` with a completed receive → one `payment_settled` keyed by the receive
   request id with the session's account.
3. Same webhook twice → same processor event id (inbox dedupe works).
4. Pending receive → no settlement; `readCheckoutState` is `pending`.
5. Unknown receive request (no session) → no events.
6. Non-2xx client response → `StrikeApiError` whose message has no API key.

## Operator commands

**Root**

```bash
make sync_lockfile
npm run build:packages
npm run test -w packages/external-services-strike
```
