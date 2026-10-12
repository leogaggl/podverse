# 01 — Contracts, schema, and config

**Cursor model:** Codex 5.3 · **Reasoning:** high

Read [00-SUMMARY.md](./00-SUMMARY.md) first. Read the **linear-sql-greenfield-only**,
**migration-readiness-marker-sync**, **orm**, **startup-validation-env-order**, and
**env-file-formatting** skills.

## 1. Processor id (`packages/helpers`)

- `lib/billing/paymentProcessorId.ts`: add `'strike'` to `PAYMENT_PROCESSOR_IDS`.
- `lib/billing/processorProductEnv.ts`: add Strike code-constant products
  (`podverse-premium-monthly` / `podverse-premium-annual`, cadence monthly / annual), mirroring
  how PayPal's constant products are declared. Update its test.
- Fix every exhaustive `switch` / `Record<PaymentProcessorId, …>` the new id breaks
  (`rg PaymentProcessorId` across `packages/` and `apps/`). Display names: `Strike`.
- `lib/billing/billingPlatform.ts`: the file comment says store builds sell through their store
  and `foss` ships without store billing. Keep that, and add that PayPal or Strike on `ios` or
  `android` is a link to web checkout. An empty storefront list is not a link in every country;
  prompt 03 enforces that on save.
- DTO for the checkout response, in `dtos/billing/billingPurchase.ts`:

```ts
export interface DTOBillingStrikeCheckout {
  checkout_id: number;
  /** BOLT11 invoice the buyer pays. */
  bolt11: string;
  amount: string;
  currency_code: string;
  expires_at: string;
  state: 'unpaid' | 'pending' | 'settled' | 'expired';
}
```

## 2. Env (`packages/helpers-config/src/billingProcessorEnv.ts`)

Add a Strike group: `enabledFlagKey: 'BILLING_STRIKE_ENABLED'`, required
`STRIKE_API_KEY`, `STRIKE_WEBHOOK_SECRET`, `STRIKE_ENVIRONMENT`. Parse `STRIKE_ENVIRONMENT`
to `'production' | 'sandbox'` and fail validation on any other value. Expose a typed
`strike` config the same way `paypal` is exposed. Add to `podverseTestEnv.ts` with
`BILLING_STRIKE_ENABLED` unset (tests inject a fake client, see 03).

## 3. Schema: `0014_billing_strike.sql`

New file in `infra/k8s/base/ops/source/database/linear-migrations/app/`:

- `CREATE TABLE public.billing_checkout_session` per 00-SUMMARY.md § Locked decisions 3:
  FKs to `account(id) ON DELETE CASCADE`, `billing_processor(id)`,
  `billing_processor_product(id)`; `amount numeric(19,4) NOT NULL CHECK (amount >= 0)`,
  `currency_code character(3) NOT NULL`, `expires_at timestamptz NOT NULL`,
  `settled_at timestamptz`, `created_at timestamptz DEFAULT now() NOT NULL`; unique
  `(processor_id, external_id)`; partial index `(processor_id, created_at) WHERE settled_at IS NULL`;
  index on `account_id`.
- Grants to `podverse_app_read_write` (SELECT, INSERT, UPDATE, DELETE) and `podverse_app_read`
  (SELECT), matching `0013`.
- Seed `billing_processor` row `('strike', 'Strike', true, …)` and `billing_checkout_channel`
  rows for `web`, `foss`, `ios`, `android`, all `enabled = false`, empty
  `storefront_allowlist`, using the fixed timestamps style `0013` uses. Do not turn any of
  them on in SQL.
- Header comment: what the table is for (a priced checkout attempt that maps a processor's
  payment id to the buyer before the payment exists), in future-forward terms.

Then update the readiness marker per **migration-readiness-marker-sync** and run, in this turn
(full permissions):

```bash
./scripts/nix/with-env make db_regen_linear_baseline
./scripts/nix/with-env make db_verify_linear_baseline
```

## 4. ORM (`packages/orm`)

- Entity `BillingCheckoutSession` (`src/entities/billingCheckoutSession.ts`), registered in the
  data source and exported.
- Service `BillingCheckoutSessionService` (`src/services/billingCheckoutSession.ts`):
  - `create(params)` → row
  - `findByExternalId(processorId, externalId)` → row or null
  - `getForAccount(id, accountId)` → row or null (ownership check for polling)
  - `markSettled(id, settledAt)` → idempotent (no-op when already settled)
  - `listUnsettledSince(processorId, since, limit)` → rows for reconcile
- Unit or integration test following how other billing services are tested in the package.

## 5. Products seed

`apps/workers/src/commands/billing/seedProcessorProductsFromEnv.ts` picks up the Strike
constants from step 1. Confirm no further change is needed; adjust if it filters by processor.

## 6. Secrets and env templates

- `infra/k8s/scripts/secret-generators/create_billing_strike_secret.sh` modeled on
  `create_billing_paypal_secret.sh`: Secret `podverse-billing-strike-opaque` with
  `STRIKE_API_KEY`, `STRIKE_WEBHOOK_SECRET`. Document it in
  `INFRA-K8S-SCRIPTS-SECRET-GENERATORS.md`.
- Mount it with `envFrom` (optional: true) wherever `podverse-billing-paypal-opaque` is mounted
  (API, management API, `worker-billing-reconcile`).
- `BILLING_STRIKE_ENABLED` and `STRIKE_ENVIRONMENT` (non-secret) go in
  `infra/k8s/base/{api,management-api,workers}/source/*.env` with empty or `"sandbox"` values
  as the PayPal keys do.
- `apps/{api,management-api,workers}/.env.example`, `dev/env-overrides/local/billing.env.example`,
  `scripts/local-env/setup.sh`: add the four keys following the PayPal pattern.
- `apps/{api,management-api,workers}/ENV.md`: document them.

## Operator commands

**Root**

```bash
npm run build:packages
npm run test -w packages/helpers
npm run test -w packages/helpers-config
make db_verify_linear_baseline
```
