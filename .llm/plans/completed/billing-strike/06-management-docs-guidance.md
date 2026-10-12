# 06 — Management web, docs, guidance, and wrap-up

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Final prompt in the set. Read [00-SUMMARY.md](./00-SUMMARY.md) first. Re-read the Apple and
Google pages named there. If a plain link is no longer allowed on the United States App Store,
say that in both docs and tell the operator to leave `ios` off. Do not invent a country list.

## 1. Management web

- Checkout channels page: Strike rows appear for `web`, `foss`, `ios`, and `android`. Toggles
  work. When the API returns 422, show its `message`.
- On the PayPal and Strike `ios` and `android` rows, one sentence of help: a store build opens
  web checkout, and the row cannot be turned on until at least one storefront country is set.
  Apple and Google Play rows do not get that sentence.
- User billing page: Strike transactions show processor "Strike" and the receive request id.
  The revoke-grant action stays the refund path; add a one-line hint on Strike rows that the
  refund itself is sent from the Strike dashboard.
- Billing help: new article `strike-refunds` (send the refund in Strike, then revoke the grant
  here). Management originals in all four locales; do not edit `overrides/`.
- E2E: extend `billing-channels.spec.ts` (turning Strike `ios` on with an empty allowlist shows
  the 422 message; `web` still saves) and `billing-help.spec.ts` (new article).

## 2. Setup doc

New `docs/billing/BILLING-STRIKE.md`. A person who has not seen this plan can finish setup from
this file alone. Name the `.vscode/terminals.json` tab before each command. Sections:

1. What it sells: one month or one year, Lightning, USD credited to the Strike account.
2. Ask Strike for sandbox access (partners@strike.me), then a production key when sandbox passes.
3. Dashboard API key scopes from 00-SUMMARY.md. Webhook secret they choose (10–50 characters).
4. Local env: the four keys, home override file the PayPal keys use as the pattern, then
   `make local_env_setup` in **Root**. `BILLING_STRIKE_ENABLED` stays empty until they intend to
   sell. `STRIKE_ENVIRONMENT` is `sandbox` locally.
5. Kubernetes: `create_billing_strike_secret.sh`, Secret name, which workloads mount it.
6. `billingStrikeEnsureWebhook` in **Workers**, and the **Billing Tunnel** tab
   (`cloudflared tunnel run podverse-local`) so Strike can reach the local API. Local API in
   **Dev** must already be listening.
7. Checkout channels, in this order, after the sandbox doc passes: enable `web`; enable `foss`
   for the in-app invoice; enable `ios` only with allowlist `US` and only while Apple still
   allows a plain link on that storefront; leave `android` off. Say why Android stays off
   (Play billing choice is not integrated). Say that `web` has to be on or the store button
   opens a checkout page with no Strike method.
8. Production switch: new key and secret, `STRIKE_ENVIRONMENT=production`, rerun the ensure
   command, then enable channels. Sandbox purchases in production grant only for accounts in
   `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS`.
9. Refunds: Strike dashboard, then revoke the grant in management. Point at
   `BILLING-OPERATIONS.md`.

Link this file from `docs/billing/BILLING.md` next to the other processor docs. Add Strike to
the processor table, the checkout session table, the routes, the webhook, reconcile, and the
secret `podverse-billing-strike-opaque`. In `BILLING-OPERATIONS.md`, add the flag
`BILLING_STRIKE_ENABLED`, the reconcile step, and what to do when a buyer reports a paid but
unsettled invoice (run reconcile, then resync). One short paragraph there: PayPal on `ios` and
`android` was already a link to web checkout; the new 422 is the same storefront rule Strike uses.

## 3. Sandbox doc

New `docs/billing/BILLING-STRIKE-SANDBOX.md`. Follows the setup doc through the webhook. Three
walkthroughs, each with tab names and the exact commands:

1. **Web.** **Dev** API, **Billing Tunnel**, web app. Enable the Strike `web` channel. Open
   checkout, choose Bitcoin (Lightning), pay the sandbox invoice from a Strike sandbox wallet,
   confirm the membership expiry moved. Second pass: let an invoice expire and use Get a New
   Invoice. Say how to see `pending` if the sandbox wallet surfaces it.
2. **Mobile, in-app (permitted).** Set `EXPO_PUBLIC_MOBILE_BILLING="unavailable"` in
   `apps/mobile/.env` (do not commit that change) and restart **Mobile Metro**
   (`npm run mobile:dev`). That selects the unavailable billing client, so checkout options use
   `foss` and the invoice panel is what Membership shows. The store sheet does not open.
   **Mobile iOS** / **Mobile Android** use `"iPhone 17 Pro"` and `Pixel_6_Pro_API_33`. Enable
   the Strike `foss` channel and `BILLING_STRIKE_ENABLED`. Sign in, open Membership, pay the
   invoice in the app (QR or Open Wallet). Confirm the expiry. A F-Droid prebuild that omits
   `expo-iap` is a separate flavor; this walkthrough does not require it. Say that restoring
   `EXPO_PUBLIC_MOBILE_BILLING="store"` and restarting Metro returns the store sheet.
3. **Mobile, App Store link.** Normal billing mode (store sheet available). Enable Strike `ios`
   with allowlist `US` only. On `"iPhone 17 Pro"`, confirm **Pay with Bitcoin on the Web** opens
   web checkout and the invoice is the website's, not a panel inside the app. Leave `android`
   off and say the Play link is not part of this test.

Close with what the sandbox does not prove: App Review, an EU entitlement, Play billing choice,
or a production settlement.

## 4. Guidance

- `.cursor/rules/billing-processor-adapters.mdc`: Strike as the example of an adapter that
  needs an app-level checkout session for account resolution. One sentence: `ios` and `android`
  for PayPal and Strike are links to web checkout, and a store row cannot be enabled with an
  empty storefront list.
- `.cursor/rules/billing-one-time-purchases.mdc`: mention that processors without account
  metadata on the payment use `billing_checkout_session`.

## 5. Wrap-up

Move the remaining files to `.llm/plans/completed/billing-strike/`.

## Operator commands — cumulative for the whole set

Print this block in the response. **Root** unless labeled.

```bash
make sync_lockfile
./scripts/development/update-lockfile-linux.sh
npm install
npm run mobile:install
make local_env_setup
make db_verify_linear_baseline
npm run build:packages
npm run build -w apps/api
npm run build -w apps/management-api
npm run build -w apps/workers
npm run lint
npm run test:unit
npm --prefix apps/mobile run test
make test_deps
npm run test:e2e:api
make e2e_test_report_scoped WEB_SPEC=e2e/checkout-strike.spec.ts,e2e/checkout-membership.spec.ts MGMT_SPEC=e2e/billing-channels.spec.ts,e2e/billing-help.spec.ts,e2e/users-billing-membership.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

**Mobile Maestro** — **Mobile E2E Metro**, **Mobile E2E API**, and **Mobile E2E iOS** /
**Mobile E2E Android** already up. Do not paste those into the block.

```bash
npm run mobile:e2e:test -- membership-checkout
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

Then the operator follows `docs/billing/BILLING-STRIKE.md` and
`docs/billing/BILLING-STRIKE-SANDBOX.md` before enabling the `web` channel in production.
Rebuild the dev client first (**Mobile iOS** / **Mobile Android**):

```bash
npm run mobile:ios -- --device "iPhone 17 Pro"
npm run mobile:android -- --device Pixel_6_Pro_API_33
```
