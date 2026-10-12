# Strike sandbox

Buy Premium with a Strike sandbox invoice and confirm the account received a grant.

API keys, the webhook secret, local env, and `billing_strike_ensure_webhook` are in
[BILLING-STRIKE.md](BILLING-STRIKE.md). Finish that setup through the webhook before any
walkthrough below. How a purchase is recorded is in [BILLING.md](BILLING.md).

**Dev** must be serving the API on `:3000` and web on `:3002`. **Billing Tunnel** must be
running (`cloudflared tunnel run podverse-local`) so a completed receive can reach the
API. Restart **Dev** after any change to `billing.env`.

Use the **Dev** env files. Those stay on `NODE_ENV=development`, so a sandbox purchase
grants every account and `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS` stays empty.

Strike product ids are fixed in code (`podverse-premium-monthly`,
`podverse-premium-annual`). Checkout sells a cadence only after that id is a row in
`billing_processor_product`. From **Workers**, with local Postgres up:

```bash
npm run build -w apps/workers
npm run billing_seed_processor_products_from_env -w apps/workers
```

The command refuses to run when `NODE_ENV` is `production`. PayPal ids are seeded by the
same command. Apple and Google ids come from `billing-products.env` and are skipped when
empty.

Set `BILLING_STRIKE_ENABLED` to `true` in
`~/.config/podverse/local-env-overrides/billing.env`, run `make local_env_setup` from
**Root**, and restart **Dev** before the first purchase.

Seeded app logins and the shared password are in the
[QUICKSTART seed table](/docs/QUICKSTART.md#3-recreate-infra-and-seed-the-database).
Write down **Expires On** before you pay. A later date is the proof.

The invoice expires 15 minutes after it is created. The page polls every 3 seconds.
**Payment detected, confirming…** means Strike reported a `PENDING` receive. That grants
nothing. Membership moves when the receive is `COMPLETED`.

## 1. Web

Enable the Strike `web` channel under **Billing → Checkout Channels**. Leave `ios` and
`android` alone for this pass.

1. Sign in at http://localhost:3002.
2. Open http://localhost:3002/settings?tab=account and note **Expires On**.
3. Open http://localhost:3002/checkout.
4. Choose a month or a year, then **Bitcoin (Lightning)** under **Choose a Payment Method**.
5. Pay the invoice from a Strike sandbox wallet (QR, copy, or **Open Wallet**).
6. The browser lands on http://localhost:3002/checkout/success, then opens Membership.
   **Expires On** should be later than the date you noted.

Second pass: wait until the invoice expires (or let the countdown reach `0:00`). The QR
and wallet actions go away. Choose **Get a New Invoice**, pay that one, and confirm the
expiration moved again.

If the sandbox wallet can show a payment that is not completed yet, leave it in that
state and look at the checkout page. **Payment detected, confirming…** is the `PENDING`
receive. **Expires On** stays where it was until the receive completes.

## 2. Mobile, in-app

This pass uses the unavailable billing client, which is the client F-Droid builds use.
The store sheet does not open. Checkout options use platform `foss`, and Membership shows
the invoice panel.

A F-Droid prebuild that omits `expo-iap` is a separate flavor. This walkthrough does not
require it.

Enable the Strike `foss` channel. `BILLING_STRIKE_ENABLED` is already `true` from the
setup above.

In `apps/mobile/.env`, set the billing client. Do not commit that file.

```text
EXPO_PUBLIC_MOBILE_BILLING="unavailable"
```

Restart **Mobile Metro** so the app reloads the env:

```bash
npm run mobile:dev
```

The invoice QR uses a native view. Install the dev client once after that dependency is
present. **Mobile iOS**:

```bash
npm run mobile:ios -- --device "iPhone 17 Pro"
```

**Mobile Android**:

```bash
npm run mobile:android -- --device Pixel_6_Pro_API_33
```

Metro stays in **Mobile Metro**. Sign in, open Membership, and pay the invoice in the app
(QR, copy, or **Open Wallet**). Confirm **Expires On** moved. **Payment detected,
confirming…** is the same `PENDING` state as on the website.

To get the store sheet back, set `EXPO_PUBLIC_MOBILE_BILLING="store"` in
`apps/mobile/.env` and restart **Mobile Metro**.

## 3. Mobile, App Store link

Use normal store billing (`EXPO_PUBLIC_MOBILE_BILLING="store"`, **Mobile Metro**
restarted). The store sheet is available. Enable Strike `ios` with allowlist `US` only.
Leave `android` off. The Play link is not part of this test.

`web` must already be on. The button opens the website, and the invoice is created there.

On `"iPhone 17 Pro"`, open Membership and tap **Pay with Bitcoin on the Web**. The app
opens web checkout. The invoice is the website's. The app does not show the invoice
panel.

Checked 2026-10-11: a plain link on the United States App Store is still allowed without
an entitlement
([App Review Guidelines 3.1.1](https://developer.apple.com/app-store/review/guidelines/)).
Do not add another storefront country. EU links need entitlements and disclosure APIs
this app does not call
([payment options in the EU](https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu)).

## What the sandbox does not prove

A sandbox payment does not prove App Review will accept the US link, an EU external-purchase
entitlement, Play billing choice, or a production settlement. Leave `android` off until
Play billing choice is integrated
([billing choice](https://developer.android.com/google/play/billing/billingchoice)).
Production uses a production key, `STRIKE_ENVIRONMENT=production`, and a new webhook
subscription, as in [BILLING-STRIKE.md](BILLING-STRIKE.md#8-production).
