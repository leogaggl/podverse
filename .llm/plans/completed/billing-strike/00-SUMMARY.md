# Billing Strike — summary

Add Strike so a member can buy a month or a year of Premium with Bitcoin over Lightning.

- **Web:** the checkout page shows a Lightning invoice (QR, copy, open wallet).
- **Mobile, no store billing** (`foss`, the F-Droid / unavailable-billing build): the same
  invoice inside the app. No store rule applies to that binary.
- **Mobile, App Store and Play builds:** a link that opens web checkout, same shape as PayPal.
  The Lightning invoice is not drawn inside those binaries. The link stays off until an operator
  names the storefront countries where a plain link is allowed.

**Starts after `billing-prepaid-only` is complete.** This set assumes one purchase kind, the
two-event normalized union (`payment_settled`, `refund_or_revoke`), and the
`billing-one-time-purchases` rule that set adds.

Model and reasoning per prompt: [COPY-PASTA.md](./COPY-PASTA.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## PayPal on mobile already exists

Do not add a second PayPal switch. `0013_membership_billing_ledger.sql` already seeds
`paypal` / `ios` and `paypal` / `android` with `enabled = false`, and `paypal` / `foss` and
`paypal` / `web` enabled. Management can turn a store row on and set
`storefront_allowlist`. The app already shows **Pay with PayPal on the Web** and opens
`/checkout` when checkout options for that platform include PayPal
(`MembershipStoreCheckout`, `openCheckout`).

What is missing, and what this set adds for **both** PayPal and Strike: a store row
(`ios` or `android`) cannot be saved enabled while `storefront_allowlist` is empty. An empty
list means every country. Apple and Google do not allow a plain external-purchase link in
every country. `web` and `foss` may stay enabled with an empty list.

Checked 2026-10-11. Prompt 06 re-reads these pages and writes the operator docs from whatever
they say then. If the US plain-link rule below has changed, the docs say so and tell the
operator to leave `ios` off.

- [App Review Guidelines 3.1.1](https://developer.apple.com/app-store/review/guidelines/): on the
  United States storefront, a button or link to another way to buy digital goods does not need
  an entitlement. Every other storefront needs a StoreKit external-purchase entitlement and, in
  the EU, the External Purchase disclosure APIs. This set does not add those APIs.
- [Apple payment options in the EU](https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu):
  in-app alternative processors and actionable links need that entitlement path.
- [Google Play billing choice](https://developer.android.com/google/play/billing/billingchoice):
  an external web link on Play must use Play Billing Library's choice and reporting APIs. This
  set does not add those APIs, so the Android Strike and PayPal link stays off.

The only storefront this set's plain link is written for is Apple **`US`**. Leave `android` off.

## Strike API facts this set relies on

Verify each against the current reference (`https://docs.strike.me/api/`) in prompt 02 before
coding; record any difference in the response and follow the docs.

- Base URLs: production `https://api.strike.me`, sandbox `https://api.dev.strike.me`. Sandbox
  keys work only in sandbox. Sandbox access is granted by Strike (partners@strike.me).
- Auth: `Authorization: Bearer <API key>`. Keys carry scopes chosen in the Strike dashboard.
- **Receive requests** (`POST /v1/receive-requests`) take
  `bolt11: { amount: { amount, currency }, description, expiryInSeconds }` and
  `targetCurrency`. A bolt11 invoice with an amount can only be paid in full, so under- and
  overpayment cannot happen. Without `expiryInSeconds` the invoice lasts 24 hours.
- `GET /v1/receive-requests/{id}` and `GET /v1/receive-requests/{id}/receives` report receives
  with `state` `PENDING` or `COMPLETED`, `amountReceived`, `amountCredited`, `completed`.
- Webhooks: subscribe with `POST /v1/subscriptions`
  (`webhookUrl`, `webhookVersion: "v1"`, `secret` 10–50 chars, `enabled`, `eventTypes`).
  Events used: `receive-request.receive-completed`. Payloads carry only `data.entityId` (the
  receive request id) and `receiveId`; the receiver fetches the record. Deliveries may repeat.
  The receiver must answer 2xx within 5 seconds. Requests are signed with the subscription
  secret (HMAC-SHA256 over the raw body, header `X-Webhook-Signature`; confirm the exact header
  and encoding on the signature-verification page).
- No refund endpoint. Refunds are sent manually from the Strike dashboard.

## Locked decisions

1. **Receive requests, not invoices.** Invoice quotes expire in 30 seconds for cross-currency
   amounts and need a re-quote loop; a receive request carries a USD amount with an expiry we
   choose. Expiry: `STRIKE_CHECKOUT_EXPIRY_SECONDS` constant of **900** in the adapter package
   (not env).
2. **Settlement currency:** `targetCurrency: 'USD'`. Price comes from
   `BillingPriceCatalogService.resolveProductMembership()`, the same source PayPal orders use.
3. **One checkout session per attempt.** New generic table `billing_checkout_session`
   (processor-neutral so a later processor can reuse it):
   `id`, `processor_id`, `external_id`, `account_id`, `billing_processor_product_id`,
   `amount`, `currency_code`, `expires_at`, `settled_at`, `created_at`; unique
   `(processor_id, external_id)`; index on `(processor_id, settled_at)` where unsettled. Account
   resolution for Strike goes through this row: the receive request id maps to the account.
4. **Transaction id = receive request id.** One receive request is one payment and one grant,
   so a repeated webhook or a second poll cannot add time twice.
5. **Settle on `COMPLETED` only.** `PENDING` is shown in the UI as "Payment detected" but grants
   nothing.
6. **Where Strike is offered.**

   | Platform | What the member sees | Channel seed |
   | -------- | -------------------- | ------------ |
   | `web` | Invoice on the checkout page | `enabled = false` |
   | `foss` | Invoice inside the app | `enabled = false` |
   | `ios`, `android` | **Pay with Bitcoin on the Web**, which opens `/checkout` | `enabled = false` |

   Store binaries never call `POST /billing/strike/checkouts`. That route accepts `platform`
   `web` or `foss` only. `ios` and `android` answer 404. The store button is only a link; the
   invoice is created by the website, so `web` must be enabled before the link does anything.
7. **Storefront guard.** Saving `paypal` or `strike` on `ios` or `android` with `enabled: true`
   and an empty `storefront_allowlist` returns **422**. Apple and Google Play rows are unchanged:
   an empty list there still means every storefront. Do not reject enabling Strike itself.
8. **Refunds** are manual in the Strike dashboard; the admin then uses the existing revoke-grant
   action. No refund adapter method.
9. **Webhook handling** stays inside the 5-second budget: verify the signature, write the inbox
   row, then process. A failed process leaves the row for the reconcile retry. Webhook route on
   the raw-body parser like the other processors.
10. **Missed webhooks:** `billingReconcile` gains a Strike step that re-checks unsettled,
    unexpired-plus-one-hour checkout sessions and settles completed ones.
11. **Webhook subscription setup** is a workers command `billingStrikeEnsureWebhook` that lists
    subscriptions, then creates or updates the one for our URL with the configured secret and
    event types. Idempotent.
12. **Env** (helpers-config processor group, same pattern as PayPal):
    `BILLING_STRIKE_ENABLED`; required when enabled: `STRIKE_API_KEY`, `STRIKE_WEBHOOK_SECRET`,
    `STRIKE_ENVIRONMENT` (`production` | `sandbox`, selects the base URL; sandbox marks
    transactions `is_sandbox`). Secrets live in a Kubernetes Secret
    `podverse-billing-strike-opaque`, never in ConfigMaps or committed env.
13. **Products** are code constants (like PayPal one-time ids): `podverse-premium-monthly`,
    `podverse-premium-annual` under processor `strike`, seeded by
    `billingSeedProcessorProductsFromEnv`. One pair for every platform.
14. **QR on web** uses the `qrcode` npm package to produce an SVG string rendered as an `<img>`
    data URL. Also show "Copy Invoice" and an "Open Wallet" `lightning:` link.
15. **QR in the FOSS app** uses `react-native-qrcode-svg` and `react-native-svg`. Same three
    actions as web: QR, copy, open wallet. A store binary does not render this panel.
16. **Schema:** new forward migration `0014_billing_strike.sql`; do not edit `0013`.
17. **Operator docs** (prompt 06), written so a person can follow them without this plan:
    `docs/billing/BILLING-STRIKE.md` (setup through production) and
    `docs/billing/BILLING-STRIKE-SANDBOX.md` (sandbox on web, in-app on the unavailable-billing
    mobile client, and the App Store link-out). Android in-app and Android link-out testing stay
    out of the sandbox doc except as a short "leave this off" note.

## API key scopes (operator sets in the Strike dashboard)

Confirm names in the dashboard: receive-request create and read
(`partner.receive-request.create`, `partner.receive-request.read`) and webhook management
(`partner.webhooks.manage`). Nothing else.

## Out of scope

On-chain payments, BTC settlement, automated refunds, a Lightning invoice inside an App Store or
Play binary, StoreKit external-purchase entitlements and disclosure sheets, and Google Play
billing-choice APIs (choice screen, external transaction token, fee reporting).
