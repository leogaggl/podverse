# 03 — API, management API, and workers

**Cursor model:** Codex 5.3 · **Reasoning:** high

Read [00-SUMMARY.md](./00-SUMMARY.md) first. Read the **api**, **api-testing**,
**management-api**, and **workers** skills. Use the PayPal order routes as the model.

## 1. Adapter registration

- `packages/billing/src/registerConfiguredBillingAdapters.ts` (or each app's
  `registerBillingAdapters.ts`, whichever registers PayPal): when the Strike env group is
  enabled, build `StrikeClient` and `createStrikeAdapter` with `findCheckoutSession` backed by
  `BillingCheckoutSessionService.findByExternalId('strike', id)`.
- Expose the Strike client and checkout helpers through each app's `billingContext.ts` the same
  way `paypalService` is exposed (null when disabled).
- Tests use an injected fake Strike client; no network.

## 2. API routes (`apps/api`)

Under `/billing`, `requireAccount`, the existing purchase rate limit:

- `POST /strike/checkouts` — Joi schema in `src/lib/validation/billingSchemas.ts`.
  1. Body `{ processor_product_id, platform? }`. `platform` defaults to `web`. Allowed values:
     `web` and `foss`. `ios` or `android` → 404 `productUnavailable` (store builds do not create
     an invoice; they open the website).
  2. 404 `processorUnavailable` when Strike is disabled; 404 `productUnavailable` when the
     product is not an active Strike product or that platform's Strike channel is disabled.
  3. Price from `resolveProductMembership()` by cadence; `currency_code` `USD`.
  4. `createCheckout` on Strike → insert `billing_checkout_session` with the receive request id,
     amount, currency, and `expires_at`.
  5. 201 with `DTOBillingStrikeCheckout` (`state: 'unpaid'`).
- `GET /strike/checkouts/:id` — load with `getForAccount` (404 when not the caller's).
  - Settled → `state: 'settled'`.
  - Otherwise ask the adapter for state. On `settled`, ingest through `fetchTransaction` and the
    same ingest path PayPal capture uses, mark the session settled, and return `settled` with
    the purchase result fields PayPal capture returns (new expiry).
  - Past `expires_at` and not settled → `expired`.
  - Rate limit polling (one request per 2 seconds per account is enough).
- `POST /webhooks/strike` — raw-body parser like the other webhooks; verify, write the inbox
  row, process. Return 200 for a verified delivery even when it produced no events; 400 for a
  bad signature. Must answer inside 5 seconds: if processing throws, leave the row failed for
  reconcile and still answer 200.
- Settlement from the webhook also marks the session settled (do it in the ingest path so both
  entry points share it).
- `openapi.yml`: document the three routes and the DTO.
- `GET /checkout-options`: Strike products appear on a platform when that platform's Strike
  channel is enabled (including `ios` and `android`). No other change to who is listed.

## 3. Management API (`apps/management-api`)

- `PATCH /checkout-channels/:id`: when the saved row would be `paypal` or `strike` on `ios` or
  `android`, `enabled: true`, and `storefront_allowlist` empty, return **422** with
  `{ message }` explaining that a store link needs at least one storefront country. Apply this
  when the patch sets `enabled: true` and when the row is already in that state and the patch
  leaves the list empty. Apple and Google Play rows are not part of this check. An empty list
  on those processors still means every storefront. Do not reject Strike on `web` or `foss`.
  Update `openapi.yml`.
- User billing detail already lists transactions; confirm Strike rows render (processor id
  `strike`). No refund action.
- Resync: Strike transactions re-fetch through `fetchTransaction` like the others.

## 4. Workers (`apps/workers`)

- `billingReconcile` gains a Strike step: `listUnsettledSince('strike', now − 25h, 200)`; for
  each session whose `expires_at` is within the last hour or later, call `fetchTransaction` and
  ingest; log counts. Skip when Strike is disabled.
- New command `billingStrikeEnsureWebhook` (npm script `billing_strike_ensure_webhook`):
  reads `API_PUBLIC_BASE_URL` (or the existing public API URL env — check `apps/workers` config)
  to build `<base>/billing/webhooks/strike`; lists subscriptions; creates or updates ours with
  `STRIKE_WEBHOOK_SECRET`, `webhookVersion: 'v1'`, `enabled: true`,
  `eventTypes: ['receive-request.receive-completed']`. Prints the subscription id, never the
  secret. Register its category in `categoriesForCommand.ts` (+ test) and startup validation.

## 5. Tests

API (`apps/api/src/test/billing.test.ts` or a new `billingStrike.test.ts`), with the fake client:

1. Create checkout → 201, session row exists, amount matches the price catalog.
2. Poll unpaid → `unpaid`; fake marks completed → poll → `settled`, expiry moves by one cadence.
3. Webhook with valid signature for the same receive request after poll settled → no extra time.
4. Webhook with a bad signature → 400, no inbox row.
5. Another account polling the session → 404.
6. Strike disabled → create returns 404.
7. `platform: 'ios'` → 404, no session row. `platform: 'foss'` with the foss channel disabled →
   404. `platform: 'foss'` with that channel enabled → 201.

Management API: enabling Strike on `ios` with an empty allowlist → 422; enabling Strike on `ios`
with allowlist `['US']` → 200; enabling Strike on `web` with an empty allowlist → 200; enabling
PayPal on `android` with an empty allowlist → 422. Disabling any of those rows → 200.

Workers: unit test the reconcile step's selection window with a fake service.

## Operator commands

**Root**

```bash
npm run build:packages
npm run build -w apps/api
npm run build -w apps/management-api
npm run build -w apps/workers
npm run test -w apps/workers
make test_deps
npm run test:e2e:api
```
